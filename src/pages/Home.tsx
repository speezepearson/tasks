import { Link } from "react-router-dom";
import { getProjectUrl } from "../routes";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Project from "./Project";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import moment from "moment";

function CreateTaskForm({ project }: { project?: Doc<'projects'> }) {
    const createTask = useMutation(api.tasks.create);
    const [text, setText] = useState("");
    const [working, setWorking] = useState(false);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (working) return;
        setWorking(true);
        (async () => {
            await createTask({ text, project: project?._id });
            setWorking(false)
            setText("");
        })().catch(console.error);
    }}>
        <input disabled={working} value={text} onChange={(e) => { setText(e.target.value) }} />
        <button className="btn btn-sm btn-outline-secondary" disabled={working} type="submit">+</button>
    </form>
}

function useNow(intervalMillis: number) {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, intervalMillis);
        return () => { clearInterval(interval) };
    }, [intervalMillis]);
    return now;
}

function textMatches(text: string, query: string): boolean {
    for (const word of query.split(/\s+/)) {
        if (!text.toLowerCase().includes(word.toLowerCase())) return false;
    }
    return true;
}

function AddBlockerForm({ task, allTasks, allMiscBlockers }: {
    task: Doc<'tasks'>,
    allTasks: List<Doc<'tasks'>>,
    allMiscBlockers: List<Doc<'miscBlockers'>>,
}) {
    const linkBlocker = useMutation(api.tasks.linkBlocker);
    const createMiscBlocker = useMutation(api.miscBlockers.create);
    const [field, setField] = useState<null | string>(null);
    const [working, setWorking] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const completionsRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [focused, setFocused] = useState(false);
    const [popoverHasMouse, setPopoverHasMouse] = useState(false);

    const matchingTasks = useMemo(() => {
        return field && field.length > 1 ? allTasks.filter((task) => textMatches(task.text, field)) : allTasks.take(0);
    }, [allTasks, field]);
    const matchingMiscBlockers = useMemo(() => {
        return field && field.length > 1 ? allMiscBlockers.filter((blocker) => textMatches(blocker.text, field)) : allMiscBlockers.take(0);
    }, [allMiscBlockers, field]);
    const matches = useMemo(() => {
        return List([
            ...matchingTasks.map(t => ({ id: t._id, text: t.text, link: () => linkBlocker({ id: task._id, blocker: { type: 'task', id: t._id } }) })),
            ...matchingMiscBlockers.map(b => ({ id: b._id, text: b.text, link: () => linkBlocker({ id: task._id, blocker: { type: 'misc', id: b._id } }) })),
        ]);
    }, [matchingTasks, matchingMiscBlockers, task, linkBlocker]);

    const submit = async (selectedIndex: number | null) => {
        if (field === null) return;
        if (working) return;
        if (selectedIndex === null) {
            const id = await createMiscBlocker({ text: field })
            await linkBlocker({ id: task._id, blocker: { type: 'misc', id } });
        } else {
            const match = matches.get(selectedIndex);
            if (match !== undefined) {
                await match.link();
            } else {
                console.error("No match found for selected index", selectedIndex);
            }
        }
        setField(null);
        setSelectedIndex(null);
    }
    const goDown = () => {
        setSelectedIndex(selectedIndex === null ? 0 : selectedIndex >= matches.size - 1 ? null : selectedIndex + 1);
    }
    const goUp = () => {
        setSelectedIndex(selectedIndex === null ? matches.size - 1 : selectedIndex <= 0 ? null : selectedIndex - 1);
    }

    return field === null
        ? <button className="btn btn-sm btn-outline-secondary" onClick={() => { setField("") }}>+blocker</button>
        : <div className="d-inline-block">
            <div ref={completionsRef} style={{
                top: '-9999px',
                left: '-9999px',
                position: 'absolute',
                zIndex: 1,
                padding: '3px',
                background: 'white',
                borderRadius: '4px',
                boxShadow: '0 1px 5px rgba(0,0,0,.2)',
                visibility: (focused || popoverHasMouse) && !matches.isEmpty() ? 'visible' : 'hidden',
            }}
                onMouseEnter={() => { setPopoverHasMouse(true) }}
                onMouseLeave={() => { setPopoverHasMouse(false) }}
            >
                <small className="text-muted">Select with &uarr;/&darr;, (Shift+)Tab; confirm with &#x23ce;</small>
                <ul className="list-group">
                    {matches.map((m, i) => <li key={m.id} className={`list-group-item ${i === selectedIndex ? 'active' : ''}`}
                        onMouseEnter={() => { setSelectedIndex(i) }}
                        onMouseLeave={() => { if (selectedIndex === i) setSelectedIndex(null) }}
                        onClick={() => { submit(i).catch(console.error) }}
                    >
                        {m.text}
                    </li>)}
                </ul>
            </div>
            <input
                ref={inputRef}
                autoFocus
                type="text"
                placeholder="blocker"
                disabled={working}
                value={field}
                onChange={(e) => {
                    setField(e.target.value);
                    if (completionsRef.current && inputRef.current) {
                        completionsRef.current.style.top = `${inputRef.current.offsetTop + inputRef.current.offsetHeight}px`;
                        completionsRef.current.style.left = `${inputRef.current.offsetLeft}px`;
                    }
                }}
                onFocus={() => { setFocused(true) }}
                onBlur={() => { setFocused(false) }}
                onKeyDown={(e) => {
                    if (working) return;
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            goDown();
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            goUp();
                            break;
                        case 'Tab':
                            e.preventDefault();
                            if (e.shiftKey) {
                                goUp();
                            } else {
                                goDown();
                            }
                            break;

                        case "Enter":
                            setWorking(true);
                            submit(selectedIndex).catch(console.error);
                            break;
                        case "Escape":
                            setField(null);
                            break;

                    }
                }}
            />
        </div>
}

function getOutstandingBlockers({ task, tasksById, miscBlockersById, now }: {
    task: Doc<'tasks'>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>,
    now: Date,
}): List<Doc<'tasks'>['blockers'][0]> {
    return List(task.blockers.filter((blocker) => {
        switch (blocker.type) {
            case "task":
                return tasksById.get(blocker.id)!.completedAtMillis === undefined;
            case "time":
                return blocker.millis > now.getTime();
            case "misc":
                return miscBlockersById.get(blocker.id)!.completedAtMillis === undefined;
        }
    }));
}

function Task({ task, tasksById, miscBlockersById }: {
    task: Doc<'tasks'>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>,
}) {
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setCompleted = useMutation(api.tasks.setCompleted);
    const setMiscBlockerCompleted = useMutation(api.miscBlockers.setCompleted);

    const now = useNow(10000);

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById, miscBlockersById, now });
    const blocked = outstandingBlockers.size > 0;
    return <div>
        <input
            type="checkbox"
            id={`task-${task._id}`}
            checked={task.completedAtMillis !== undefined}
            onChange={(e) => { setCompleted({ id: task._id, isCompleted: e.target.checked }).catch(console.error) }}
            disabled={blocked && task.completedAtMillis === undefined} />
        {" "}
        <label htmlFor={`task-${task._id}`} className={blocked ? "text-muted" : ""}>
            {task.text}
        </label>
        {" "}
        <AddBlockerForm task={task} allTasks={List(tasksById.values())} allMiscBlockers={List(miscBlockersById.values())} />
        {blocked
            && <div className="ms-4">
                blocked on:
                <ul className="list-group">
                    {outstandingBlockers.map((blocker) => {
                        const unlinkButton = <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => { unlinkBlocker({ id: task._id, blocker }).catch(console.error) }}>-</button>;
                        switch (blocker.type) {
                            case "task":
                                return <li key={blocker.id} className="list-group-item">
                                    {tasksById.get(blocker.id)!.text}
                                    {" "} {unlinkButton}
                                </li>
                            case "time":
                                return <li key="__time" className="list-group-item">
                                    {moment(blocker.millis).fromNow()}
                                    {" "} {unlinkButton}
                                </li>
                            case "misc":
                                return <li key={blocker.id} className="list-group-item">
                                    <input
                                        type="checkbox"
                                        id={`task-${task._id}--miscBlocker-${blocker.id}`}
                                        checked={miscBlockersById.get(blocker.id)!.completedAtMillis !== undefined}
                                        onChange={(e) => { setMiscBlockerCompleted({ id: blocker.id, isCompleted: e.target.checked }).catch(console.error) }}
                                    />
                                    {" "}
                                    <label htmlFor={`task-${task._id}--miscBlocker-${blocker.id}`}>
                                        {miscBlockersById.get(blocker.id)!.text}
                                    </label>
                                    {" "} {unlinkButton}
                                </li>
                        }
                    })}
                </ul>
            </div>
        }
    </div>
}

function mapundef<T, U>(x: T | undefined, f: (x: T) => U): U | undefined {
    return x === undefined ? undefined : f(x);
}
function byUniqueKey<T, K>(items: List<T>, key: (item: T) => K): Map<K, T> {
    let map = Map<K, T>();
    items.forEach((item) => {
        map = map.set(key(item), item);
    });
    return map;
}

function ProjectCard({
    project,
    projectTasks,
    tasksById,
    miscBlockersById,
    showCompleted,
    showBlocked,
}: {
    project: Doc<'projects'> | undefined,
    projectTasks: List<Doc<'tasks'>>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>,
    showCompleted: boolean,
    showBlocked: boolean,
}) {

    const now = useNow(10000);
    const outstandingBlockers = useMemo(() => {
        return Map(projectTasks.map((task) => [task._id, getOutstandingBlockers({ task, tasksById, miscBlockersById, now })]));
    }, [projectTasks, tasksById, miscBlockersById, now]);

    const [showTasks, tasksHiddenBecauseCompleted, tasksHiddenBecauseBlocked] = useMemo(() => {
        let tasksHiddenBecauseCompleted = List<Doc<'tasks'>>();
        let tasksHiddenBecauseBlocked = List<Doc<'tasks'>>();
        let showTasks = List<Doc<'tasks'>>();
        for (const task of projectTasks) {
            if (!showCompleted && task.completedAtMillis !== undefined) {
                tasksHiddenBecauseCompleted = tasksHiddenBecauseCompleted.push(task);
            } else if (!showBlocked && !outstandingBlockers.get(task._id, List()).isEmpty()) {
                tasksHiddenBecauseBlocked = tasksHiddenBecauseBlocked.push(task);
            } else {
                showTasks = showTasks.push(task);
            }
        }
        return [showTasks, tasksHiddenBecauseCompleted, tasksHiddenBecauseBlocked];
    }, [projectTasks, showCompleted, showBlocked, outstandingBlockers]);
    return <div key={project?._id ?? "<undef>"} className="mt-4 p-2 border-start border-3">
        <h3>
            {project === undefined
                ? "(misc)"
                : <Link to={getProjectUrl(project._id)} state={{ project } as Project.LinkState}>{project.name}</Link>
            }
        </h3>
        <ul className="list-group">
            {showTasks
                .map((task) => <li key={task._id} className="list-group-item">
                    <Task
                        task={task}
                        tasksById={tasksById}
                        miscBlockersById={miscBlockersById}
                    />
                </li>)}
            {(!tasksHiddenBecauseCompleted.isEmpty() || !tasksHiddenBecauseBlocked.isEmpty()) && <li className="list-group-item text-muted">
                <details>
                    <summary>
                        {!tasksHiddenBecauseCompleted.isEmpty() && <span className="me-2">+{tasksHiddenBecauseCompleted.size} completed</span>}
                        {!tasksHiddenBecauseBlocked.isEmpty() && <span className="me-2">+{tasksHiddenBecauseBlocked.size} blocked</span>}
                    </summary>

                    <ul className="list-group">
                        {tasksHiddenBecauseCompleted.concat(tasksHiddenBecauseBlocked).map((task) => <li key={task._id} className="list-group-item">
                            <Task
                                task={task}
                                tasksById={tasksById}
                                miscBlockersById={miscBlockersById}
                            />
                        </li>)}
                    </ul>
                </details>
            </li>}
            <li className="list-group-item"><CreateTaskForm project={project} /></li>
        </ul>
    </div>

}

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    const tasks = mapundef(useQuery(api.tasks.list), List);
    const blockers = mapundef(useQuery(api.miscBlockers.list), List);
    const setMiscBlockerCompleted = useMutation(api.miscBlockers.setCompleted);

    const projectsById = useMemo(() => projects && byUniqueKey(projects, (p) => p._id), [projects]);
    const tasksByProject = useMemo(() => projectsById && tasks?.groupBy(t => t.project && projectsById.get(t.project)), [tasks, projectsById]);
    const tasksById = useMemo(() => tasks && byUniqueKey(tasks, (t) => t._id), [tasks]);
    const miscBlockersById = useMemo(() => blockers && byUniqueKey(blockers, (b) => b._id), [blockers]);

    const now = useNow(10000);

    const [showCompleted, setShowCompleted] = useState(false);
    const [showBlocked, setShowBlocked] = useState(false);

    if (projects === undefined
        || tasks === undefined
        || blockers === undefined
        || projectsById === undefined
        || tasksByProject === undefined
        || tasksById === undefined
        || miscBlockersById === undefined
    ) {
        return <div>Loading...</div>
    }

    const showMiscBlocker = (blocker: Doc<'miscBlockers'>) => {
        return <div>
            <input
                type="checkbox"
                id={`miscBlocker-${blocker._id}`}
                checked={blocker.completedAtMillis !== undefined}
                onChange={(e) => { setMiscBlockerCompleted({ id: blocker._id, isCompleted: e.target.checked }).catch(console.error) }}
            />
            {" "}
            {blocker.completedAtMillis === undefined && blocker.timeoutMillis && blocker.timeoutMillis < now.getTime() &&
                <span className="text-danger">TIMED OUT: </span>}
            <label htmlFor={`miscBlocker-${blocker._id}`}>
                {blocker.text}
                {" "}
                {blocker.timeoutMillis !== undefined && <span className="text-muted">(timeout: {moment(blocker.timeoutMillis).fromNow()})</span>}
            </label>
        </div>
    }

    return <div>
        <div className="d-flex flex-row">
            <div className="me-4">
                <input type="checkbox" id="showCompleted" checked={showCompleted} onChange={(e) => { setShowCompleted(e.target.checked) }} />
                {" "}
                <label htmlFor="showCompleted">Show completed</label>
            </div>
            <div className="me-4">
                <input type="checkbox" id="showBlocked" checked={showBlocked} onChange={(e) => { setShowBlocked(e.target.checked) }} />
                {" "}
                <label htmlFor="showBlocked">Show blocked</label>
            </div>
        </div>
        <h1>Projects</h1>
        {tasksByProject.entrySeq()
            .sortBy(([p,]) => [p === undefined, p])
            .map(([project, projectTasks]) => (
                <ProjectCard
                    key={project?._id ?? "<undef>"}
                    project={project}
                    projectTasks={projectTasks}
                    tasksById={tasksById}
                    miscBlockersById={miscBlockersById}
                    showCompleted={showCompleted}
                    showBlocked={showBlocked}
                />
            ))}

        <h1 className="mt-4"> All misc blockers </h1>
        <ul className="list-group">
            {blockers
                .filter(b => showCompleted || b.completedAtMillis === undefined)
                .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text])
                .map((blocker) => <li key={blocker._id} className="list-group-item">{showMiscBlocker(blocker)}</li>)}
        </ul>
    </div>
}