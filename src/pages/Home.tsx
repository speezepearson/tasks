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
        return () => clearInterval(interval);
    }, []);
    return now;
}

function AddBlockerForm({ linkBlocker, tasks, miscBlockers }: {
    linkBlocker: (id: typeof api.tasks.linkBlocker._args.blocker) => Promise<unknown>,
    tasks: List<Doc<'tasks'>>,
    miscBlockers: List<Doc<'miscBlockers'>>,
}) {
    const createMiscBlocker = useMutation(api.miscBlockers.create);
    const [field, setField] = useState<null | string>(null);
    const [working, setWorking] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const completionsRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    const matchingTasks = useMemo(() => {
        return tasks.filter((task) => field && task.text.toLowerCase().includes(field.toLowerCase()));
    }, [tasks, field]);
    const matchingMiscBlockers = useMemo(() => {
        return miscBlockers.filter((blocker) => field && blocker.text.toLowerCase().includes(field.toLowerCase()));
    }, [miscBlockers, field]);
    const matches = useMemo(() => {
        return List([
            ...matchingTasks.map(t => ({ type: 'task', item: t })),
            ...matchingMiscBlockers.map(b => ({ type: 'misc', item: b })),
        ] as ({ type: 'task', item: Doc<'tasks'> } | { type: 'misc', item: Doc<'miscBlockers'> })[]);
    }, [matchingTasks, matchingMiscBlockers]);

    const submit = async (selectedIndex: number | null) => {
        if (field === null) return;
        if (working) return;
        if (selectedIndex === null) {
            const id = await createMiscBlocker({ text: field })
            await linkBlocker({ type: 'misc', id });
        } else {
            const match = matches.get(selectedIndex)!;
            switch (match.type) {
                case "misc":
                    await linkBlocker({ type: 'misc', id: match.item._id });
                    break;
                case "task":
                    await linkBlocker({ type: 'task', id: match.item._id });
                    break;
            }
        }
        setField(null);
        setSelectedIndex(null);

    }

    return field === null
        ? <button className="btn btn-sm btn-outline-secondary" onClick={() => setField("")}>+blocker</button>
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
            }}>
                {matches.map((m, i) => <div key={m.item._id} className={i === selectedIndex ? 'bg-primary text-white' : ''}
                    onMouseEnter={() => setSelectedIndex(i)}
                    onMouseLeave={() => { if (selectedIndex === i) setSelectedIndex(null) }}
                    onClick={() => submit(i)}
                >
                    {m.item.text}
                </div>)}
            </div>
            <input
                ref={inputRef}
                autoFocus
                type="text"
                disabled={working}
                value={field}
                onChange={(e) => {
                    setField(e.target.value);
                    if (completionsRef.current && inputRef.current) {
                        completionsRef.current.style.top = `${inputRef.current.offsetTop + inputRef.current.offsetHeight}px`;
                        completionsRef.current.style.left = `${inputRef.current!.offsetLeft}px`;
                    }
                }}
                onKeyDown={(e) => {
                    if (working) return;
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            setSelectedIndex(selectedIndex === null ? 0 : selectedIndex >= matches.size - 1 ? null : selectedIndex + 1);
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            setSelectedIndex(selectedIndex === null ? matches.size - 1 : selectedIndex <= 0 ? null : selectedIndex - 1);
                            break;

                        case "Enter":
                            setWorking(true);
                            submit(selectedIndex).catch(console.error);
                            break;
                        case "Escape":
                            setField(null);
                            break;

                    };
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

function Task({ task, tasksById, miscBlockersById, setCompleted, setMiscBlockerCompleted, linkBlocker, unlinkBlocker }: {
    task: Doc<'tasks'>,
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>,
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>,
    setCompleted: (isCompleted: boolean) => Promise<unknown>,
    setMiscBlockerCompleted: (id: Id<'miscBlockers'>, isCompleted: boolean) => Promise<unknown>,
    linkBlocker: (id: typeof api.tasks.linkBlocker._args.blocker) => Promise<unknown>,
    unlinkBlocker: (blocker: Doc<'tasks'>['blockers'][0]) => Promise<unknown>,
}) {
    const now = useNow(10000);

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById, miscBlockersById, now });
    const blocked = outstandingBlockers.size > 0;
    return <div>
        <input type="checkbox" id={`task-${task._id}`} checked={task.completedAtMillis !== undefined} onChange={(e) => setCompleted(e.target.checked)} disabled={blocked && task.completedAtMillis === undefined} />
        {" "}
        <label htmlFor={`task-${task._id}`} className={blocked ? "text-muted" : ""}>{task.text}</label>
        {" "}
        <AddBlockerForm tasks={List(tasksById.values())} miscBlockers={List(miscBlockersById.values())} linkBlocker={linkBlocker} />
        {blocked
            && <div>
                blocked on:
                <ul>
                    {outstandingBlockers.map((blocker) => {
                        const unlinkButton = <button className="btn btn-sm btn-outline-secondary" onClick={() => unlinkBlocker(blocker)}>-</button>;
                        switch (blocker.type) {
                            case "task":
                                return <li key={blocker.id}>
                                    {tasksById.get(blocker.id)!.text}
                                    {unlinkButton}
                                </li>
                            case "time":
                                return <li key="__time">
                                    {moment(blocker.millis).fromNow()}
                                    {unlinkButton}
                                </li>
                            case "misc":
                                return <li key={blocker.id}>
                                    <input type="checkbox" id={`miscBlocker-${blocker.id}`} checked={miscBlockersById.get(blocker.id)!.completedAtMillis !== undefined} onChange={(e) => setMiscBlockerCompleted(blocker.id, e.target.checked)} />
                                    {" "}
                                    {miscBlockersById.get(blocker.id)!.text}
                                    {unlinkButton}
                                </li>
                        }
                    })}
                </ul>
            </div>
        }
    </div>
}

export function Page() {
    const projects = useQuery(api.projects.list);
    const tasks = useQuery(api.tasks.list);
    const blockers = useQuery(api.miscBlockers.list);
    const createProject = useMutation(api.projects.create);
    const createTask = useMutation(api.tasks.create);
    const createBlocker = useMutation(api.miscBlockers.create);
    const linkBlocker = useMutation(api.tasks.linkBlocker);
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setTaskCompleted = useMutation(api.tasks.setCompleted);
    const setMiscBlockerCompleted = useMutation(api.miscBlockers.setCompleted);

    const tasksByProject = useMemo(() => {
        let tasksByProject: Map<string | undefined, List<Doc<'tasks'>>> = Map();
        tasks?.forEach((task) => {
            tasksByProject = tasksByProject.update(task.project, List(), (tasks) => tasks.push(task));
        });
        return tasksByProject;
    }, [tasks]);
    const tasksById = useMemo(() => {
        let tasksById: Map<Id<'tasks'>, Doc<'tasks'>> = Map();
        tasks?.forEach((task) => {
            tasksById = tasksById.set(task._id, task);
        });
        return tasksById;
    }, [tasks]);
    const miscBlockersById = useMemo(() => {
        let blockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>> = Map();
        blockers?.forEach((blocker) => {
            blockersById = blockersById.set(blocker._id, blocker);
        });
        return blockersById;
    }, [blockers]);

    const now = useNow(10000);

    if (projects === undefined || tasks === undefined || blockers === undefined) {
        return <div>Loading...</div>
    }

    const showMiscBlocker = (blocker: Doc<'miscBlockers'>) => {
        return <div>
            <input type="checkbox" id={`miscBlocker-${blocker._id}`} checked={blocker.completedAtMillis !== undefined} onChange={(e) => setMiscBlockerCompleted({ id: blocker._id, isCompleted: e.target.checked })} />
            {" "}
            {blocker.completedAtMillis === undefined && blocker.timeoutMillis && blocker.timeoutMillis < now.getTime() && <span className="text-danger">TIMED OUT: </span>}
            <label htmlFor={`miscBlocker-${blocker._id}`}>
                {blocker.text}
                {" "}
                {blocker.timeoutMillis !== undefined && <span className="text-muted">(timeout: {moment(blocker.timeoutMillis).fromNow()})</span>}
            </label>
        </div>
    }

    return <div>
        <h1>Projects</h1>
        {projects.map((project) => <div key={project._id} className="card p-2">
            <h3><Link to={getProjectUrl(project._id)} state={{ project } as Project.LinkState}>{project.name}</Link></h3>
            <ul>
                {tasksByProject.get(project._id)!
                    .sortBy(t => [t.completedAtMillis !== undefined, getOutstandingBlockers({ task: t, tasksById, miscBlockersById, now }).size > 0, t.text])
                    .map((task) => <li key={task._id}>
                        <Task
                            task={task}
                            tasksById={tasksById}
                            miscBlockersById={miscBlockersById}
                            setCompleted={(isCompleted) => setTaskCompleted({ id: task._id, isCompleted })}
                            setMiscBlockerCompleted={(id, isCompleted) => setMiscBlockerCompleted({ id, isCompleted })}
                            linkBlocker={async (blocker) => {
                                await linkBlocker({ id: task._id, blocker });
                            }}
                            unlinkBlocker={async (blocker) => {
                                await unlinkBlocker({ id: task._id, blocker });
                            }}
                        />
                    </li>)}
                <li><CreateTaskForm project={project} /></li>
            </ul>
        </div>)}

        <h1 className="mt-4"> All misc blockers </h1>
        <ul>
            {List(blockers)
                .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text])
                .map((blocker) => <li key={blocker._id}>{showMiscBlocker(blocker)}</li>)}
        </ul>
    </div>
}