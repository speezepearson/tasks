import { Link } from "react-router-dom";
import { getProjectUrl } from "../routes";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Project from "./Project";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { QuickCaptureForm } from "./QuickCapture";
import { AutocompletingInput } from "../AutocompletingInput";
import { textMatches, useNow } from "../common";
import { CreateProjectForm } from "../CreateProjectForm";
import { formatDate } from "date-fns";
import { SingleLineMarkdown } from "../SingleLineMarkdown";

function CreateTaskForm({ project }: { project?: Doc<'projects'> }) {
    const createTask = useMutation(api.tasks.create);
    const [text, setText] = useState("");
    const [working, setWorking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const [justCreated, setJustCreated] = useState(false);

    useEffect(() => {
        if (justCreated) {
            setJustCreated(false);
            inputRef.current?.focus();
        }
    }, [justCreated]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (working) return;
        setWorking(true);
        (async () => {
            await createTask({ text, project: project?._id });
            setText("");
        })().catch(console.error).finally(() => {
            setWorking(false);
            setJustCreated(true);
        });
    }}>
        <div className="d-flex flex-row">
            <input className="form-control form-control-sm d-inline-block" ref={inputRef} disabled={working} value={text} onChange={(e) => { setText(e.target.value) }} placeholder="new task text" />
            <button className="btn btn-sm btn-primary ms-1" disabled={working} type="submit">+task</button>
        </div>
    </form>
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

    const [showInput, setShowInput] = useState(false);

    return showInput
        ? <AutocompletingInput
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
            onCancel={() => { setShowInput(false) }}
        />
        : <button className="btn btn-sm btn-outline-secondary py-0" onClick={() => { setShowInput(true) }}>+blocker</button>;
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

    const reword = useMutation(api.tasks.reword);
    const [editField, setEditField] = useState<string | null>(null);

    const now = useNow();

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById, miscBlockersById, now });
    const blocked = outstandingBlockers.size > 0;
    return <div>
        <div className="d-flex flex-row">
            <input
                className="align-self-start mt-1"
                type="checkbox"
                id={`task-${task._id}`}
                checked={task.completedAtMillis !== undefined}
                onChange={(e) => { setCompleted({ id: task._id, isCompleted: e.target.checked }).catch(console.error) }}
                disabled={blocked && task.completedAtMillis === undefined} />
            {" "}
            {editField === null
                ? <label
                    htmlFor={`task-${task._id}`}
                    className={`ms-1 overflow-hidden text-truncate ${blocked ? "text-muted" : ""}`}
                    style={{}}>
                    <SingleLineMarkdown>{task.text}</SingleLineMarkdown>
                </label>
                : <input
                    type="text"
                    className="form-control form-control-sm ms-1"
                    value={editField}
                    onChange={(e) => { setEditField(e.target.value) }}
                    onKeyDown={(e) => {
                        switch (e.key) {
                            case "Enter":
                                e.preventDefault();
                                (async () => {
                                    await reword({ id: task._id, text: editField }).catch(console.error);
                                })().catch(console.error);
                                setEditField(null);
                                break;
                            case "Escape":
                                e.preventDefault();
                                setEditField(null);
                                break;
                        }
                    }}
                    autoFocus
                />}
            <div className="ms-auto"></div>
            <div className="align-self-start">
                <button className="btn btn-sm btn-outline-secondary py-0" onClick={() => { setEditField(task.text) }}>edit</button>
            </div>
            <div className="align-self-start">
                <AddBlockerForm task={task} allTasks={List(tasksById.values())} allMiscBlockers={List(miscBlockersById.values())} />
            </div>
        </div>
        {blocked
            && <div className="ms-4">
                blocked on:
                <div className="ms-4">
                    {outstandingBlockers.map((blocker) => {
                        const unlinkButton = <button
                            className="btn btn-sm btn-outline-secondary py-0"
                            onClick={() => { unlinkBlocker({ id: task._id, blocker }).catch(console.error) }}>-</button>;
                        switch (blocker.type) {
                            case "task":
                                return <div key={blocker.id}>
                                    <SingleLineMarkdown>{tasksById.get(blocker.id)!.text}</SingleLineMarkdown>
                                    {" "} {unlinkButton}
                                </div>
                            case "time":
                                return <div key="__time">
                                    {formatDate(blocker.millis, 'yyyy-MM-dd')}
                                    {" "} {unlinkButton}
                                </div>
                            case "misc":
                                return <div key={blocker.id}>
                                    <input
                                        type="checkbox"
                                        id={`task-${task._id}--miscBlocker-${blocker.id}`}
                                        checked={miscBlockersById.get(blocker.id)!.completedAtMillis !== undefined}
                                        onChange={(e) => { setMiscBlockerCompleted({ id: blocker.id, isCompleted: e.target.checked }).catch(console.error) }}
                                    />
                                    {" "}
                                    <label htmlFor={`task-${task._id}--miscBlocker-${blocker.id}`}>
                                        <SingleLineMarkdown>{miscBlockersById.get(blocker.id)!.text}</SingleLineMarkdown>
                                    </label>
                                    {" "} {unlinkButton}
                                </div>
                        }
                    })}
                </div>
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
}: {
    project: Doc<'projects'> | undefined,
    projectTasks: List<Doc<'tasks'>>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>,
}) {

    const showTasks = projectTasks.sortBy(t => [t.completedAtMillis !== undefined, -t._creationTime]);

    return <details open={!projectTasks.isEmpty()} className="card p-2" style={project?.color ? { backgroundColor: project.color } : {}}>
        <summary>
            <div className="fs-5 d-inline-block">
                {project === undefined
                    ? "(misc)"
                    : <Link to={getProjectUrl(project._id)} state={{ project } as Project.LinkState} className="text-decoration-none">{project.name}</Link>
                }
            </div>
        </summary>
        <div className="ms-4">
            <div className="py-1"><CreateTaskForm project={project} /></div>
            {showTasks.map((task) =>
                <div key={task._id} className="" >
                    <Task
                        task={task}
                        tasksById={tasksById}
                        miscBlockersById={miscBlockersById}
                    />
                </div>
            )}
        </div>
    </details>;
}

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    const tasks = mapundef(useQuery(api.tasks.list), List);
    const blockers = mapundef(useQuery(api.miscBlockers.list), List);
    const setMiscBlockerCompleted = useMutation(api.miscBlockers.setCompleted);

    const projectsById = useMemo(() => projects && byUniqueKey(projects, (p) => p._id), [projects]);
    const tasksByProject = useMemo(() => {
        if (projectsById === undefined || tasks === undefined) return undefined;
        let res = tasks.groupBy(t => t.project && projectsById.get(t.project));
        projectsById.forEach((project) => {
            if (!res.has(project)) res = res.set(project, List());
        });
        if (!res.has(undefined)) res = res.set(undefined, List());
        return res;
    }, [tasks, projectsById]);
    const tasksById = useMemo(() => tasks && byUniqueKey(tasks, (t) => t._id), [tasks]);
    const miscBlockersById = useMemo(() => blockers && byUniqueKey(blockers, (b) => b._id), [blockers]);

    const now = useNow();

    const outstandingBlockers = useMemo(() => {
        return tasksById && miscBlockersById && tasks && Map(
            tasks
                .map((task) => [task._id, getOutstandingBlockers({ task, tasksById, miscBlockersById, now })])
        );
    }, [tasks, tasksById, miscBlockersById, now]);

    const nextActions = useMemo(() => {
        return outstandingBlockers && tasks
            ?.sortBy((task) => [task.project === undefined, task.project])
            .filter((task) => task.completedAtMillis === undefined && outstandingBlockers.get(task._id)!.isEmpty());
    }, [tasks, outstandingBlockers]);

    const [nextActionFilterField, setNextActionFilterField] = useState("");

    if (projects === undefined
        || tasks === undefined
        || blockers === undefined
        || projectsById === undefined
        || tasksByProject === undefined
        || tasksById === undefined
        || miscBlockersById === undefined
        || nextActions === undefined
        || outstandingBlockers === undefined
    ) {
        return <div>Loading...</div>
    }

    const showMiscBlocker = (blocker: Doc<'miscBlockers'>) => {
        return <div className="d-flex flex-row">
            <div>
                <input
                    type="checkbox"
                    id={`miscBlocker-${blocker._id}`}
                    checked={blocker.completedAtMillis !== undefined}
                    onChange={(e) => { setMiscBlockerCompleted({ id: blocker._id, isCompleted: e.target.checked }).catch(console.error) }}
                />
            </div>
            <div className="ms-1">
                <label htmlFor={`miscBlocker-${blocker._id}`}>
                    {blocker.completedAtMillis === undefined && blocker.timeoutMillis && blocker.timeoutMillis < now.getTime() &&
                        <span className="text-danger">TIMED OUT: </span>}
                    <SingleLineMarkdown>{blocker.text}</SingleLineMarkdown>
                    {" "}
                    {blocker.timeoutMillis !== undefined && <span className="text-muted">(by {formatDate(blocker.timeoutMillis, 'yyyy-MM-dd')})</span>}
                </label>
            </div>
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
                <input
                    className="form-control form-control-sm d-inline-block"
                    value={nextActionFilterField}
                    onChange={(e) => { setNextActionFilterField(e.target.value) }}
                    placeholder="filter"
                    style={{ maxWidth: '10em' }}
                />
            </div>
            <div className="mt-1">
                {tasksByProject.entrySeq()
                    .sortBy(([p, pt]) => [p === undefined, pt.isEmpty(), pt.filter(t => t.completedAtMillis).size > 0, p?._creationTime])
                    .map(([p, projectTasks]) => (
                        <ProjectCard
                            key={p?._id ?? "<undef>"}
                            project={p}
                            projectTasks={projectTasks.filter((task) =>
                                task.completedAtMillis === undefined &&
                                outstandingBlockers.get(task._id)!.isEmpty() &&
                                textMatches(task.text, nextActionFilterField)
                            )}
                            tasksById={tasksById}
                            miscBlockersById={miscBlockersById}
                        />
                    ))}
            </div>
        </div>

        <div className="mt-4">
            <div className="text-center">
                <h1>Projects</h1>
            </div>
            {tasksByProject.entrySeq()
                .sortBy(([p, pt]) => [p === undefined, pt.isEmpty(), pt.filter(t => t.completedAtMillis).size > 0, p?._creationTime])
                .map(([project, projectTasks]) => (
                    <ProjectCard
                        key={project?._id ?? "<undef>"}
                        project={project}
                        projectTasks={projectTasks}
                        tasksById={tasksById}
                        miscBlockersById={miscBlockersById}
                    />
                ))}
            <div className="text-center mt-2">
                <CreateProjectForm />
            </div>
        </div>

        <div className="mt-4">
            <h1 className="text-center"> Misc blockers </h1>
            <ul className="list-group">
                {blockers
                    .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text])
                    .map((blocker) => <li key={blocker._id} className="list-group-item">{showMiscBlocker(blocker)}</li>)}
                <li className="list-group-item">
                    <CreateMiscBlockerForm />
                </li>
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
                <SingleLineMarkdown>{capture.text}</SingleLineMarkdown>
                <button className="btn btn-sm btn-outline-secondary ms-2" onClick={() => { archive({ id: capture._id }).catch(console.error) }}>Archive</button>
            </li>)}
        </ul>

    </div>
}

function CreateMiscBlockerForm() {
    const createMiscBlocker = useMutation(api.miscBlockers.create);
    const [text, setText] = useState("");
    const [timeout, setTimeout] = useState(formatDate(new Date(), 'yyyy-MM-dd'));
    const [working, setWorking] = useState(false);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (working) return;
        setWorking(true);
        (async () => {
            await createMiscBlocker({ text, timeoutMillis: timeout ? new Date(timeout).getTime() : undefined });
            setText("");
            setTimeout("");
        })().catch(console.error).finally(() => {
            setWorking(false);
        });
    }}>
        <div className="d-flex flex-row">
            <input className="form-control form-control-sm d-inline-block" value={text} onChange={(e) => { setText(e.target.value) }} placeholder="new blocker text" />
            <input className="form-control form-control-sm d-inline-block ms-1" type="date" style={{ maxWidth: '10em' }} value={timeout} onChange={(e) => { setTimeout(e.target.value) }} placeholder="timeout" />
            <button className="btn btn-sm btn-primary ms-1" type="submit">+blocker</button>
        </div>
    </form>
}