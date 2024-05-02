import { Link } from "react-router-dom";
import { getProjectUrl } from "../routes";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Project from "./Project";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import moment from "moment";
import { QuickCaptureForm } from "./QuickCapture";
import { AutocompletingInput } from "../AutocompletingInput";

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
            setText("");
        })().catch(console.error).finally(() => { setWorking(false) });
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

function AddBlockerForm({ task, allTasks, allMiscBlockers }: {
    task: Doc<'tasks'>,
    allTasks: List<Doc<'tasks'>>,
    allMiscBlockers: List<Doc<'miscBlockers'>>,
}) {
    const linkBlocker = useMutation(api.tasks.linkBlocker);
    const createMiscBlocker = useMutation(api.miscBlockers.create);

    const options = useMemo(() => List([
        ...allTasks.map(t => ({ id: t._id, text: t.text, link: () => linkBlocker({ id: task._id, blocker: { type: 'task', id: t._id } }) })),
        ...allMiscBlockers.map(b => ({ id: b._id, text: b.text, link: () => linkBlocker({ id: task._id, blocker: { type: 'misc', id: b._id } }) })),
    ]), [allTasks, allMiscBlockers, linkBlocker, task._id]);
    const render = useCallback((x: { text: string }) => x.text, []);

    return <AutocompletingInput
        options={options}
        render={render}
        onSubmit={async (val) => {
            switch (val.type) {
                case "raw":
                    await linkBlocker({
                        id: task._id,
                        blocker: {
                            type: 'misc',
                            id: await createMiscBlocker({ text: val.text }),
                        },
                    });
                    break;
                case "option":
                    await val.value.link();
                    break;
            }
        }}
    />;
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

    const nextActions = useMemo(() => {
        return tasksById && miscBlockersById && tasks
            ?.sortBy((task) => [task.project === undefined, task.project])
            ?.filter((task) => task.completedAtMillis === undefined && getOutstandingBlockers({ task, tasksById, miscBlockersById, now }).isEmpty());
    }, [tasks, tasksById, miscBlockersById, now]);

    if (projects === undefined
        || tasks === undefined
        || blockers === undefined
        || projectsById === undefined
        || tasksByProject === undefined
        || tasksById === undefined
        || miscBlockersById === undefined
        || nextActions === undefined
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
        <div>
            <h1 className="text-center">Inbox</h1>
            <Inbox />
        </div>

        <div className="mt-4">
            <div className="text-center">
                <h1>Next Actions</h1>
            </div>
            <ul className="list-group">
                {nextActions
                    .map((task) => <li key={task._id} className="list-group-item">
                        <Task
                            task={task}
                            tasksById={tasksById}
                            miscBlockersById={miscBlockersById}
                        />
                    </li>)
                }
            </ul>
        </div>

        <div className="mt-4">
            <div className="text-center">
                <h1>Projects</h1>
                <div>
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
            </div>
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
        </div>

        <div className="mt-4">
            <h1 className="text-center"> All misc blockers </h1>
            <ul className="list-group">
                {blockers
                    .filter(b => showCompleted || b.completedAtMillis === undefined)
                    .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text])
                    .map((blocker) => <li key={blocker._id} className="list-group-item">{showMiscBlocker(blocker)}</li>)}
            </ul>
        </div>
    </div>
}

function Inbox() {
    const captures = useQuery(api.captures.list, { limit: 10 });
    const archive = useMutation(api.captures.archive);

    return <div>
        <ul className="list-group">

            <li className="list-group-item text-center">
                <QuickCaptureForm />
            </li>

            {captures?.map((capture) => <li key={capture._id} className="list-group-item">
                {capture.text}
                <button className="btn btn-sm btn-outline-secondary ms-2" onClick={() => { archive({ id: capture._id }).catch(console.error) }}>Archive</button>
            </li>)}
        </ul>

    </div>
}
