import { Link } from "react-router-dom";
import { getProjectUrl } from "../routes";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import * as Project from "./Project";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import moment from "moment";
import { QuickCaptureForm } from "./QuickCapture";
import { BlockersForm } from "../BlockersForm";
import { getOutstandingBlockers, useNow } from "../common";

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

function Task({ task, tasksById, miscBlockersById }: {
    task: Doc<'tasks'>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>,
}) {
    const setBlockers = useMutation(api.tasks.setBlockers);
    const setCompleted = useMutation(api.tasks.setCompleted);

    const now = useNow(10000);
    const [showBlockersForm, setShowBlockersForm] = useState(false);

    const outstandingBlockers = useMemo(() => getOutstandingBlockers({ task, tasksById, miscBlockersById, now }), [task, tasksById, miscBlockersById, now]);
    const blocked = outstandingBlockers.size > 0;

    const otherTasks = tasksById.remove(task._id);

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
        {(blocked || showBlockersForm)
            ? <div className="ms-4">
                <BlockersForm
                    existingTask={task}
                    allTasks={otherTasks}
                    allBlockers={miscBlockersById}
                    onSubmit={async (blockers) => {
                        await setBlockers({ id: task._id, blockers });
                        setShowBlockersForm(false);
                    }}
                    onCancel={() => { setShowBlockersForm(false) }}
                />
            </div>
            : <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setShowBlockersForm(true) }}
                disabled={blocked}
            >blocked</button>
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
        <h1>Inbox</h1>
        <Inbox />

        <hr />

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

function Inbox() {
    const captures = useQuery(api.captures.list);

    return <div>
        <ul className="list-group">

            <li className="list-group-item">
                <QuickCaptureForm />
            </li>

            {captures?.map((capture) => <li key={capture._id} className="list-group-item">
                <details>
                    <summary>{capture.text}</summary>
                    <DissolveForm capture={capture} />
                </details>
            </li>)}
        </ul>

    </div>
}

function DissolveForm({ capture }: {
    capture: Doc<'captures'>,
}) {
    const dissolve = useMutation(api.captures.dissolve);

    const [dissolveInto, setDissolveInto] = useState<{
        tasks: { text: string }[],
        miscBlockers: { text: string }[],
    }>({ tasks: [], miscBlockers: [] });
    const [dissolveIntoTaskText, setDissolveIntoTaskText] = useState("");
    const [dissolveIntoMiscBlockerText, setDissolveIntoMiscBlockerText] = useState("");

    const [working, setWorking] = useState(false);

    return <div>
        <form onSubmit={(e) => {
            e.preventDefault();
            if (working) return;
            setWorking(true);
            (async () => {
                await dissolve({ id: capture._id, tasks: dissolveInto.tasks.map(t => ({ ...t, blockers: [] })), miscBlockers: dissolveInto.miscBlockers })
                setDissolveInto({ tasks: [], miscBlockers: [] })
            })().catch(console.error).finally(() => { setWorking(false) });
        }}>
            <div className="row">
                <div className="col-6">
                    Create tasks:
                    <ul className="list-group">
                        {dissolveInto.tasks.map((task, i) => <li key={i} className="list-group-item">
                            {task.text}
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                setDissolveInto({
                                    ...dissolveInto,
                                    tasks: dissolveInto.tasks.filter((_, j) => i !== j),
                                });
                            }}>-</button>
                        </li>)}
                        <li className="list-group-item">
                            <input
                                value={dissolveIntoTaskText}
                                onChange={(e) => { setDissolveIntoTaskText(e.target.value) }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        setDissolveInto({
                                            ...dissolveInto,
                                            tasks: [...dissolveInto.tasks, { text: dissolveIntoTaskText }],
                                        });
                                        setDissolveIntoTaskText("");
                                    }
                                }}
                            />
                        </li>
                    </ul>
                </div>
                <div className="col-6">
                    Create misc blockers:
                    <ul className="list-group">
                        {dissolveInto.miscBlockers.map((miscBlocker, i) => <li key={i} className="list-group-item">
                            {miscBlocker.text}
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                setDissolveInto({
                                    ...dissolveInto,
                                    miscBlockers: dissolveInto.miscBlockers.filter((_, j) => i !== j),
                                });
                            }}>-</button>
                        </li>)}
                        <li className="list-group-item">
                            <input
                                value={dissolveIntoMiscBlockerText}
                                onChange={(e) => { setDissolveIntoMiscBlockerText(e.target.value) }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        setDissolveInto({
                                            ...dissolveInto,
                                            miscBlockers: [...dissolveInto.miscBlockers, { text: dissolveIntoMiscBlockerText }],
                                        });
                                        setDissolveIntoMiscBlockerText("");
                                    }
                                }}
                            />
                        </li>
                    </ul>
                </div>
            </div>
            <button className="btn btn-sm btn-outline-primary" type="submit">dissolve</button>
        </form>
    </div>
}
