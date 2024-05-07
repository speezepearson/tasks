import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { AutocompletingInput } from "../AutocompletingInput";
import { ReqStatus, textMatches, useNow, watchReqStatus } from "../common";
import { CreateProjectForm } from "../CreateProjectForm";
import { formatDate, parseISO } from "date-fns";
import { SingleLineMarkdown } from "../SingleLineMarkdown";
import { Button, Form, Modal } from "react-bootstrap";
import { Inbox } from "../Inbox";

function CreateTaskForm({ project }: { project?: Doc<'projects'> }) {
    const createTask = useMutation(api.tasks.create);
    const [text, setText] = useState("");
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
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
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createTask({ text, project: project?._id });
            setText("");
            setJustCreated(true);
        })()).catch(console.error);
    }}>
        <div className="d-flex flex-row">
            <input className="form-control form-control-sm d-inline-block" ref={inputRef} disabled={req.type === 'working'} value={text} onChange={(e) => { setText(e.target.value) }} placeholder="new task text" />
            <button className="btn btn-sm btn-primary ms-1" disabled={req.type === 'working'} type="submit">+task</button>
        </div>
    </form>
}

function guessTimeoutMillisFromText(text: string): { withoutDate: string; timeout: Date } | undefined {
    const regexp = /(\d{4}-\d{2}-\d{2})$/;
    const dateMatch = text.match(regexp);
    if (dateMatch === null) return undefined;
    return {
        withoutDate: text.replace(regexp, ''),
        timeout: parseISO(dateMatch[1]),
    };
}

function AddBlockerForm({ task, allTasks, allDelegations }: {
    task: Doc<'tasks'>,
    allTasks: List<Doc<'tasks'>>,
    allDelegations: List<Doc<'delegations'>>,
}) {
    const linkBlocker = useMutation(api.tasks.linkBlocker);
    const createDelegation = useMutation(api.delegations.create);

    const options = useMemo(() => List([
        ...allTasks.map(t => ({ id: t._id, text: t.text, link: () => linkBlocker({ id: task._id, blocker: { type: 'task', id: t._id } }) })),
        ...allDelegations.map(b => ({ id: b._id, text: b.text, link: () => linkBlocker({ id: task._id, blocker: { type: 'delegation', id: b._id } }) })),
    ]), [allTasks, allDelegations, linkBlocker, task._id]);
    const render = useCallback((x: { text: string }) => x.text, []);

    const [showInput, setShowInput] = useState(false);

    return showInput
        ? <AutocompletingInput
            options={options}
            render={render}
            onSubmit={async (val) => {
                switch (val.type) {
                    case "raw":
                        await (async () => {
                            const timeout = guessTimeoutMillisFromText(val.text);
                            const newDelegationId = await createDelegation(
                                timeout
                                    ? { text: timeout.withoutDate, timeoutMillis: timeout.timeout.getTime() }
                                    : { text: val.text }
                            );
                            await linkBlocker({
                                id: task._id,
                                blocker: { type: 'delegation', id: newDelegationId },
                            });
                        })();
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

function getOutstandingBlockers({ task, tasksById, delegationsById, now }: {
    task: Doc<'tasks'>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>,
    now: Date,
}): List<Doc<'tasks'>['blockers'][0]> {
    return List(task.blockers.filter((blocker) => {
        switch (blocker.type) {
            case "task":
                return tasksById.get(blocker.id)!.completedAtMillis === undefined;
            case "time":
                return blocker.millis > now.getTime();
            case "delegation":
                return delegationsById.get(blocker.id)!.completedAtMillis === undefined;
        }
    }));
}

function EditTaskModal({ task, projectsById, onHide }: {
    task: Doc<'tasks'>,
    projectsById: Map<Id<'projects'>, Doc<'projects'>>,
    onHide: () => unknown,
}) {
    const update = useMutation(api.tasks.update);

    const [newText, setNewText] = useState(task.text);
    const [newProjectId, setNewProjectId] = useState(task.project);

    const [saveReq, setSaveReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (saveReq.type === 'error') alert(saveReq.message);
    }, [saveReq]);

    const doSave = () => { watchReqStatus(setSaveReq, update({ id: task._id, text: newText, project: newProjectId }).then(onHide)).catch(console.error) }

    return <Modal show onHide={onHide}>
        <Modal.Header closeButton>
            <Modal.Title>Edit task</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form onSubmit={e => { e.preventDefault(); doSave() }}>

                <Form.Group className="mb-3">
                    <Form.Label>Task text</Form.Label>
                    <Form.Control
                        autoFocus
                        type="text"
                        value={newText}
                        onChange={(e) => { setNewText(e.target.value) }}
                    />
                    <Form.Text className="text-muted">
                        You can use markdown here.
                    </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Project</Form.Label>
                    <Form.Select
                        value={newProjectId}
                        onChange={(e) => { setNewProjectId(e.target.value === '' ? undefined : (e.target.value as Id<'projects'>)) }}
                    >
                        <option value="">(none)</option>
                        {projectsById.entrySeq()
                            .sortBy(([, project]) => project.name)
                            .map(([id, project]) => <option key={id} value={id}>{project.name}</option>)}
                    </Form.Select>
                </Form.Group>

            </Form>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="outline-secondary" onClick={onHide}>
                Close
            </Button>
            <Button variant="primary" onClick={doSave}>
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </Modal.Footer>
    </Modal>
}

function Task({ task, projectsById, tasksById, delegationsById: delegationsById }: {
    task: Doc<'tasks'>,
    projectsById: Map<Id<'projects'>, Doc<'projects'>>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>,
}) {
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setCompleted = useMutation(api.tasks.setCompleted);
    const setDelegationCompleted = useMutation(api.delegations.setCompleted);

    const [editing, setEditing] = useState(false);

    const now = useNow();
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById, delegationsById: delegationsById, now });
    const blocked = outstandingBlockers.size > 0;
    return <div>
        {editing && <EditTaskModal
            task={task}
            projectsById={projectsById}
            onHide={() => { setEditing(false) }}
        />}
        <div className="d-flex flex-row">
            <input
                className="align-self-start mt-1"
                type="checkbox"
                checked={task.completedAtMillis !== undefined}
                onChange={(e) => {
                    if (req.type === 'working') return;
                    watchReqStatus(setReq, setCompleted({ id: task._id, isCompleted: e.target.checked }))
                        .catch(console.error);
                }}
                style={{ width: '1em', height: '1em' }}
                disabled={req.type === 'working' || (blocked && task.completedAtMillis === undefined)} />
            {" "}
            <div className={`ms-1 overflow-hidden text-truncate flex-grow-1 ${blocked ? "text-muted" : ""}`}
                role="button"
                onClick={() => { setEditing(true) }}
            >
                <SingleLineMarkdown>{task.text}</SingleLineMarkdown>
            </div>
            <div className="ms-auto"></div>
            <div className="align-self-start">
                <AddBlockerForm task={task} allTasks={List(tasksById.values())} allDelegations={List(delegationsById.values())} />
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
                            case "delegation":
                                return <div key={blocker.id}>
                                    <input
                                        type="checkbox"
                                        checked={delegationsById.get(blocker.id)!.completedAtMillis !== undefined}
                                        onChange={(e) => { setDelegationCompleted({ id: blocker.id, isCompleted: e.target.checked }).catch(console.error) }}
                                        style={{ width: '1em', height: '1em' }}
                                    />
                                    {" "}
                                    <SingleLineMarkdown>{delegationsById.get(blocker.id)!.text}</SingleLineMarkdown>
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

function EditProjectModal({ project, onHide }: {
    project: Doc<'projects'>,
    onHide: () => unknown,
}) {
    const update = useMutation(api.projects.update);

    const [newName, setNewName] = useState(project.name);
    const [newColor, setNewColor] = useState(project.color);

    const [saveReq, setSaveReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (saveReq.type === 'error') alert(saveReq.message);
    }, [saveReq]);

    const doSave = () => { watchReqStatus(setSaveReq, update({ id: project._id, name: newName, color: newColor }).then(onHide)).catch(console.error) }

    return <Modal show onHide={onHide}>
        <Modal.Header closeButton>
            <Modal.Title>Edit project</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: newColor }}>
            <Form onSubmit={e => { e.preventDefault(); doSave() }}>

                <Form.Group className="mb-3">
                    <Form.Label>Project name</Form.Label>
                    <Form.Control
                        autoFocus
                        type="text"
                        value={newName}
                        onChange={(e) => { setNewName(e.target.value) }}
                    />
                    <Form.Text className="text-muted">
                        You can use markdown here.
                    </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Color</Form.Label>
                    <Form.Control
                        type="color"
                        value={newColor}
                        onChange={(e) => { setNewColor(e.target.value) }}
                    />
                </Form.Group>

            </Form>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="outline-secondary" onClick={onHide}>
                Close
            </Button>
            <Button variant="primary" onClick={doSave}>
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </Modal.Footer>
    </Modal>
}

function ProjectCard({
    project,
    projectTasks,
    projectsById,
    tasksById,
    delegationsById,
}: {
    project: Doc<'projects'> | undefined,
    projectTasks: List<Doc<'tasks'>>,
    projectsById: Map<Id<'projects'>, Doc<'projects'>>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>,
}) {

    const [editing, setEditing] = useState(false);

    const showTasks = projectTasks.sortBy(t => [t.completedAtMillis !== undefined, -t._creationTime], listcmp);

    return <details open={!projectTasks.isEmpty()} className="card p-2" style={project?.color ? { backgroundColor: project.color } : {}}>
        <summary>
            <div className="fs-5 d-inline-block" role="button" onClick={(e) => { e.preventDefault(); setEditing(true) }}>
                {project === undefined
                    ? "(misc)"
                    : project.name
                }
            </div>
        </summary>
        {editing && <EditProjectModal
            project={project!}
            onHide={() => { setEditing(false) }}
        />}
        <div className="ms-4">
            <div className="py-1"><CreateTaskForm project={project} /></div>
            {showTasks.map((task) =>
                <div key={task._id} className="" >
                    <Task
                        task={task}
                        projectsById={projectsById}
                        tasksById={tasksById}
                        delegationsById={delegationsById}
                    />
                </div>
            )}
        </div>
    </details>;
}

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    const tasks = mapundef(useQuery(api.tasks.list), List);
    const blockers = mapundef(useQuery(api.delegations.list), List);

    const projectsById = useMemo(() => projects && byUniqueKey(projects, (p) => p._id), [projects]);
    const tasksGroupedByProject = useMemo(() => {
        if (projectsById === undefined || tasks === undefined) return undefined;
        let res = tasks.groupBy(t => t.project && projectsById.get(t.project));
        projectsById.forEach((project) => {
            if (!res.has(project)) res = res.set(project, List());
        });
        if (!res.has(undefined)) res = res.set(undefined, List());
        return res.entrySeq()
            .sortBy(([p, pt]) => [
                p === undefined, // towards the end if p is 'misc'
                pt.isEmpty(), // towards the end if there are no tasks
                pt.filter(t => t.completedAtMillis === undefined).size > 0, // towards the end if there are no incomplete tasks
                p !== undefined && -p._creationTime // towards the end if p is older
            ], listcmp);
    }, [tasks, projectsById]);
    const tasksById = useMemo(() => tasks && byUniqueKey(tasks, (t) => t._id), [tasks]);
    const delegationsById = useMemo(() => blockers && byUniqueKey(blockers, (b) => b._id), [blockers]);

    const now = useNow();

    const outstandingBlockers = useMemo(() => {
        return tasksById && delegationsById && tasks && Map(
            tasks
                .map((task) => [task._id, getOutstandingBlockers({ task, tasksById, delegationsById, now })])
        );
    }, [tasks, tasksById, delegationsById, now]);

    const [nextActionFilterField, setNextActionFilterField] = useState("");

    const timedOutBlockers = useMemo(
        () => blockers?.filter(b => b.completedAtMillis === undefined && b.timeoutMillis && b.timeoutMillis < now.getTime()),
        [blockers, now],
    );

    return <div>
        <div>
            <h1 className="text-center">Inbox</h1>
            <Inbox />
        </div>

        <div className="mt-4">
            <h1 className="text-center"> Timed Out </h1>
            <ul className="list-group">
                {timedOutBlockers === undefined
                    ? <li className="list-group-item">Loading...</li>
                    : timedOutBlockers
                        .map((blocker) => <li key={blocker._id} className="list-group-item">
                            <Delegation delegation={blocker} />
                        </li>)}
            </ul>
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
                {(tasksGroupedByProject === undefined
                    || outstandingBlockers === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                    || delegationsById === undefined
                )
                    ? <div>Loading...</div>
                    : tasksGroupedByProject
                        .map(([p, projectTasks]) => (
                            <ProjectCard
                                key={p?._id ?? "<undef>"}
                                project={p}
                                projectTasks={projectTasks.filter((task) =>
                                    task.completedAtMillis === undefined &&
                                    outstandingBlockers.get(task._id)!.isEmpty() &&
                                    textMatches(task.text, nextActionFilterField)
                                )}
                                projectsById={projectsById}
                                tasksById={tasksById}
                                delegationsById={delegationsById}
                            />
                        ))}
            </div>
        </div>

        <div className="mt-4">
            <div className="text-center">
                <h1>Projects</h1>
            </div>
            {(tasksGroupedByProject === undefined
                || outstandingBlockers === undefined
                || projectsById === undefined
                || tasksById === undefined
                || delegationsById === undefined
            )
                ? <div>Loading...</div>
                : tasksGroupedByProject
                    .map(([project, projectTasks]) => (
                        <ProjectCard
                            key={project?._id ?? "<undef>"}
                            project={project}
                            projectTasks={projectTasks}
                            projectsById={projectsById}
                            tasksById={tasksById}
                            delegationsById={delegationsById}
                        />
                    ))}
            <div className="text-center mt-2">
                <CreateProjectForm />
            </div>
        </div>

        <div className="mt-4">
            <h1 className="text-center"> Delegations </h1>
            <div className="card p-2">
                <div className="ms-4">
                    {blockers === undefined
                        ? <div>Loading...</div>
                        : blockers
                            .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text], listcmp)
                            .map((blocker) => <div key={blocker._id}>
                                <Delegation delegation={blocker} />
                            </div>)}
                    <div>
                        <CreateDelegationForm />
                    </div>
                </div>
            </div>
        </div>
    </div>
}

function listcmp<T>(a: T[], b: T[]): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] < b[i]) return -1;
        if (a[i] > b[i]) return 1;
    }
    return a.length - b.length;
}

function EditDelegationModal({ delegation, onHide }: {
    delegation: Doc<'delegations'>,
    onHide: () => unknown,
}) {
    const update = useMutation(api.delegations.update);

    const [newText, setNewText] = useState(delegation.text);
    const [newTimeoutMillis, setNewTimeoutMillis] = useState(delegation.timeoutMillis);

    const [saveReq, setSaveReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (saveReq.type === 'error') alert(saveReq.message);
    }, [saveReq]);

    const doSave = () => { watchReqStatus(setSaveReq, update({ id: delegation._id, text: newText, timeoutMillis: newTimeoutMillis }).then(onHide)).catch(console.error) }

    return <Modal show onHide={onHide}>
        <Modal.Header closeButton>
            <Modal.Title>Edit delegation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Form onSubmit={e => { console.log('submitting'); e.preventDefault(); doSave() }}>

                <Form.Group className="mb-3">
                    <Form.Label>Text</Form.Label>
                    <Form.Control
                        autoFocus
                        type="text"
                        value={newText}
                        onChange={(e) => { setNewText(e.target.value) }}
                    />
                    <Form.Text className="text-muted">
                        You can use markdown here.
                    </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Timeout</Form.Label>
                    <Form.Control
                        type="date"
                        value={newTimeoutMillis === undefined ? '' : formatDate(new Date(newTimeoutMillis), 'yyyy-MM-dd')}
                        onChange={(e) => { setNewTimeoutMillis(e.target.value === '' ? undefined : parseISO(e.target.value).getTime()) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSave() } }} // not sure why this is necessary, as opposed to it triggering a Submit naturally
                    />
                </Form.Group>

            </Form>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="outline-secondary" onClick={onHide}>
                Close
            </Button>
            <Button variant="primary" onClick={doSave}>
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </Modal.Footer>
    </Modal>
}

function Delegation({ delegation }: { delegation: Doc<'delegations'> }) {
    const setCompleted = useMutation(api.delegations.setCompleted);
    const now = useNow();

    const [editing, setEditing] = useState(false);

    return <div className="d-flex flex-row">
        {editing && <EditDelegationModal
            delegation={delegation}
            onHide={() => { setEditing(false) }}
        />}
        <div>
            <input
                type="checkbox"
                checked={delegation.completedAtMillis !== undefined}
                onChange={(e) => { setCompleted({ id: delegation._id, isCompleted: e.target.checked }).catch(console.error) }}
                style={{ width: '1em', height: '1em' }}
            />
        </div>
        <div className="ms-1 flex-grow-1" role="button" onClick={() => { setEditing(true) }}>
            {delegation.completedAtMillis === undefined && delegation.timeoutMillis && delegation.timeoutMillis < now.getTime() &&
                <span className="text-danger">TIMED OUT: </span>}
            <SingleLineMarkdown>{delegation.text}</SingleLineMarkdown>
            {" "}
            {delegation.timeoutMillis !== undefined && <span className="text-muted">(by {formatDate(delegation.timeoutMillis, 'yyyy-MM-dd')})</span>}
        </div>
    </div>
}

function CreateDelegationForm() {
    const createDelegation = useMutation(api.delegations.create);
    const [text, setText] = useState("");
    const [timeout, setTimeout] = useState(formatDate(new Date(), 'yyyy-MM-dd'));
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createDelegation({ text, timeoutMillis: timeout ? parseISO(timeout).getTime() : undefined });
            setText("");
            setTimeout("");
        })()).catch(console.error);
    }}>
        <div className="d-flex flex-row">
            <input className="form-control form-control-sm d-inline-block" value={text} onChange={(e) => {
                const timeout = guessTimeoutMillisFromText(e.target.value);
                if (timeout) {
                    setTimeout(formatDate(timeout.timeout, 'yyyy-MM-dd'));
                    setText(timeout.withoutDate);
                } else {
                    setText(e.target.value);
                }
            }} placeholder="new blocker text" />
            <input className="form-control form-control-sm d-inline-block ms-1" type="date" style={{ maxWidth: '10em' }} value={timeout} onChange={(e) => { setTimeout(e.target.value) }} placeholder="timeout" />
            <button className="btn btn-sm btn-primary ms-1" type="submit">+blocker</button>
        </div>
    </form>
}