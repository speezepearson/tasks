import { List, Map } from "immutable";
import { Doc, Id } from "../convex/_generated/dataModel";
import { useCallback, useMemo, useState } from "react";
import { AutocompletingInput } from "./AutocompletingInput";
import { vBlocker, vPendingMiscBlockerSpec, vPendingTaskSpec, vPendingBlocker } from "../convex/schema";
import moment from "moment";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { getOutstandingBlockers, isBlockerOutstanding, useNow } from "./common";

export function BlockersForm({ existingTask, allTasks, allBlockers, onSubmit, onCancel }: {
    existingTask?: Doc<'tasks'>,
    allTasks: Map<Id<'tasks'>, Doc<'tasks'>>,
    allBlockers: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>,
    onSubmit: (blockers: typeof api.tasks.setBlockers._args.blockers) => Promise<unknown>,
    onCancel?: () => void,
}) {
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setTaskCompleted = useMutation(api.tasks.setCompleted);
    const setMiscBlockerCompleted = useMutation(api.miscBlockers.setCompleted);

    const [newTasks, setNewTasks] = useState<(typeof vPendingTaskSpec.type)[]>([]);
    const [newMiscBlockers, setNewMiscBlockers] = useState<(typeof vPendingMiscBlockerSpec.type)[]>([]);
    const [blockers, setBlockers] = useState<List<typeof vPendingBlocker.type>>(List(existingTask?.blockers ?? []));

    const uid = useMemo(() => Math.random().toString(36).slice(2), []);

    const now = useNow(10000);

    const autocompleteOptions: List<typeof vPendingBlocker.type> = useMemo(() => List([
        ...allTasks.valueSeq().map((task) => ({ type: 'task' as const, id: task._id })),
        ...allBlockers.valueSeq().map((blocker) => ({ type: 'misc' as const, id: blocker._id })),
        ...newTasks.map((_, index) => ({ type: 'relTask' as const, index })),
        ...newMiscBlockers.map((_, index) => ({ type: 'relMisc' as const, index })),
    ]), [allTasks, allBlockers, newTasks, newMiscBlockers]);
    const renderAutocompleteOption = useCallback((opt: typeof vPendingBlocker.type) => {
        switch (opt.type) {
            case "misc": return allBlockers.find((b) => b._id === opt.id)?.text ?? "???";
            case "task": return allTasks.find((t) => t._id === opt.id)?.text ?? "???";
            case "relTask": return newTasks[opt.index].text;
            case "relMisc": return newMiscBlockers[opt.index].text;
            case "time": return moment(opt.millis).fromNow();
        }
    }, [allTasks, allBlockers, newTasks, newMiscBlockers]);

    const blockersHiddenBecauseCompleted = useMemo(() => blockers.filter((blocker) => {
        if ((blocker.type === "time" || blocker.type === "task" || blocker.type === "misc") && !isBlockerOutstanding({ blocker, tasksById: allTasks, miscBlockersById: allBlockers, now })) {
            return true;
        }
        return false;
    }), [blockers, allTasks, allBlockers, now]);

    return <div>
        Blocked on:
        <ul className="list-group">
            {blockers.map((blocker, index) => {
                if ((blocker.type === "time" || blocker.type === "task" || blocker.type === "misc") && !isBlockerOutstanding({ blocker, tasksById: allTasks, miscBlockersById: allBlockers, now })) {
                    return null;
                }
                const content = (() => {
                    switch (blocker.type) {
                        case "task": return <>
                            <input type="checkbox" id={`${uid}-blocker-${index}`} checked={allTasks.get(blocker.id)?.completedAtMillis !== undefined} onChange={(e) => setTaskCompleted({ id: blocker.id, isCompleted: e.target.checked })} />
                            {" "}
                            <label htmlFor={`${uid}-blocker-${index}`}>{allTasks.get(blocker.id)?.text ?? "???"}</label>
                        </>;
                        case "misc": return <>
                            <input type="checkbox" id={`${uid}-blocker-${index}`} checked={allBlockers.get(blocker.id)?.completedAtMillis !== undefined} onChange={(e) => setMiscBlockerCompleted({ id: blocker.id, isCompleted: e.target.checked })} />
                            {" "}
                            <label htmlFor={`${uid}-blocker-${index}`}>{allBlockers.get(blocker.id)?.text ?? "???"}</label>
                        </>;
                        case "time": return moment(blocker.millis).fromNow();
                        case "relTask": return newTasks[blocker.index].text;
                        case "relMisc": return newMiscBlockers[blocker.index].text;
                    }
                })();
                return <li key={index} className="list-group-item">
                    {content}
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setBlockers(res => res.delete(index))}>-</button>
                </li>
            })}
            <>
                {newTasks.map((task, index) => <li key={index} className="list-group-item">
                    <div>{task.text}</div>
                    <ul>
                        {task.blockers.map((blocker, index) => <li key={index}>
                            {(() => {
                                switch (blocker.type) {
                                    case "task": return allTasks.get(blocker.id)?.text ?? "???";
                                    case "misc": return allBlockers.get(blocker.id)?.text ?? "???";
                                    case "time": return moment(blocker.millis).fromNow();
                                    case "relTask": return newTasks[blocker.index].text;
                                    case "relMisc": return newMiscBlockers[blocker.index].text;
                                }
                            })()}
                        </li>)}
                    </ul>
                </li>)}
                {newMiscBlockers.map((blocker, index) => <li key={index} className="list-group-item">
                    <div>{blocker.text}</div>
                    <div>{blocker.timeoutMillis ? moment(blocker.timeoutMillis).fromNow() : "No timeout"}</div>
                </li>)}
            </>
            {!blockersHiddenBecauseCompleted.isEmpty() && <li className="list-group-item text-muted">
                +{blockersHiddenBecauseCompleted.size} completed
            </li>}
        </ul>
        <form onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
                blockers: blockers.toArray(),
                newTasks,
                newMiscBlockers,
            }).then(() => {
                setNewTasks([]);
                setNewMiscBlockers([]);
                setBlockers(List());
            }).catch(console.error);
        }}>
            <AutocompletingInput
                options={autocompleteOptions}
                render={renderAutocompleteOption}
                onSubmit={async (val) => {
                    switch (val.type) {
                        case "raw":
                            setNewTasks([...newTasks, { text: val.text, blockers: [] }]); // TODO: what if the user wants to add a miscBlocker?
                            setBlockers(res => res.push({ type: "relTask", index: newTasks.length - 1 }));
                            break;
                        case "option":
                            setBlockers(res => res.push(val.value));
                            break;
                    }
                }}
                onCancel={onCancel}
            />
            <button className="btn btn-sm btn-outline-secondary" type="submit">+</button>
        </form>
    </div>;
}