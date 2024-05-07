import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, textMatches, useNow, watchReqStatus } from "../common";
import { formatDate, parseISO } from "date-fns";
import { SingleLineMarkdown } from "../SingleLineMarkdown";
import { Inbox } from "../Inbox";
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Autocomplete, Box, Button, Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, Grid, InputLabel, Stack, TextField, Typography } from "@mui/material";
import { CreateProjectForm } from "../CreateProjectForm";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
        <Stack direction="row">
            <TextField size="small" sx={{ flexGrow: 1 }} ref={inputRef} disabled={req.type === 'working'} value={text} onChange={(e) => { setText(e.target.value) }} label="New task text" />
            <Button sx={{ ml: 1 }} variant="contained" size="small" disabled={req.type === 'working'} disableRipple type="submit">+task</Button>
        </Stack>
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

    const optionsByText = useMemo(() => Map([
        ...allTasks.map(t => [t.text, () => linkBlocker({ id: task._id, blocker: { type: 'task', id: t._id } })] as [string, () => Promise<null>]),
        ...allDelegations.map(b => [b.text, () => linkBlocker({ id: task._id, blocker: { type: 'delegation', id: b._id } })] as [string, () => Promise<null>]),
    ]), [allTasks, allDelegations, linkBlocker, task._id]);

    const [text, setText] = useState("");
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    const [showInput, setShowInput] = useState(false);

    return <>{showInput
        ? <form
            onSubmit={(e) => {
                e.preventDefault();
                watchReqStatus(setReq,
                    (async () => {
                        const link = optionsByText.get(text);
                        if (link === undefined) {
                            const timeout = guessTimeoutMillisFromText(text);
                            const newDelegationId = await createDelegation(
                                timeout
                                    ? { text: timeout.withoutDate, timeoutMillis: timeout.timeout.getTime() }
                                    : { text }
                            );
                            await linkBlocker({
                                id: task._id,
                                blocker: { type: 'delegation', id: newDelegationId },
                            });
                        } else {
                            console.log("awaiting link for", text);
                            await link();
                        }
                        setShowInput(false);
                    })()).catch(console.error);
            }}
        >
            <Autocomplete
                freeSolo
                blurOnSelect={false}
                onBlur={() => { setShowInput(false) }}
                size="small"
                options={optionsByText.keySeq().sort().toArray()}
                renderInput={(params) => <TextField {...params} label="Blocker" />}
                value={text}
                onChange={(_, value) => { setText(value ?? "") }}
            />
        </form>
        : <Button size="small" variant="outlined" sx={{ py: 0 }} onClick={() => { setShowInput(true) }}>+blocker</Button>
    }
    </>
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

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);

    const [newText, setNewText] = useState(task.text);
    const [newProjectId, setNewProjectId] = useState(task.project);

    const [saveReq, setSaveReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (saveReq.type === 'error') alert(saveReq.message);
    }, [saveReq]);

    const doSave = () => { watchReqStatus(setSaveReq, update({ id: task._id, text: newText, project: newProjectId }).then(onHide)).catch(console.error) }

    return <Dialog open onClose={onHide} fullWidth PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave() },
    }}>
        <DialogTitle>Edit task</DialogTitle>
        <DialogContent>
            <FormControl fullWidth>
                <TextField autoFocus margin="normal" label="Task text" type="text" value={newText} onChange={(e) => { setNewText(e.target.value) }} />
                <FormHelperText>You can use markdown here.</FormHelperText>
            </FormControl>

            <Autocomplete
                sx={{ mt: 4 }}
                options={projectsByName.entrySeq()
                    .sortBy(([name]) => name)
                    .map((([name]) => name))
                    .toList()
                    .toArray()}
                renderInput={(params) => <TextField {...params} label="Project" />}
                value={newProjectId ? projectsById.get(newProjectId)!.name : null}
                onChange={(_, projectName) => { setNewProjectId(projectName ? projectsByName.get(projectName)!._id : undefined) }}
            />
        </DialogContent>

        <DialogActions>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>

            <Button variant="contained" type="submit">
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </DialogActions>
    </Dialog>
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
    return <Box>
        {editing && <EditTaskModal
            task={task}
            projectsById={projectsById}
            onHide={() => { setEditing(false) }}
        />}
        <Stack direction="row" alignItems="center">
            <Checkbox
                checked={task.completedAtMillis !== undefined}
                onChange={(e) => {
                    if (req.type === 'working') return;
                    watchReqStatus(setReq, setCompleted({ id: task._id, isCompleted: e.target.checked }))
                        .catch(console.error);
                }}
                style={{ width: '1em', height: '1em' }}
                disabled={req.type === 'working' || (blocked && task.completedAtMillis === undefined)} />
            {" "}
            <Typography noWrap sx={{ ml: 1, flexGrow: 1, color: blocked ? 'gray' : 'inherit' }}
                role="button"
                onClick={() => { setEditing(true) }}
            >
                <SingleLineMarkdown>{task.text}</SingleLineMarkdown>
            </Typography>
            <AddBlockerForm task={task} allTasks={List(tasksById.values())} allDelegations={List(delegationsById.values())} />
        </Stack>
        {blocked
            && <Box sx={{ ml: 4 }}>
                blocked on:
                <Box sx={{ ml: 2 }}>
                    {outstandingBlockers.map((blocker) => {
                        const unlinkButton = <Button
                            size="small" sx={{ py: 0 }} variant="outlined"
                            onClick={() => { unlinkBlocker({ id: task._id, blocker }).catch(console.error) }}>unlink</Button>;
                        switch (blocker.type) {
                            case "task":
                                return <Box key={blocker.id}>
                                    <SingleLineMarkdown>{tasksById.get(blocker.id)!.text}</SingleLineMarkdown>
                                    {" "} {unlinkButton}
                                </Box>
                            case "time":
                                return <Box key="__time">
                                    {formatDate(blocker.millis, 'yyyy-MM-dd')}
                                    {" "} {unlinkButton}
                                </Box>
                            case "delegation":
                                return <Box key={blocker.id}>
                                    <Checkbox
                                        checked={delegationsById.get(blocker.id)!.completedAtMillis !== undefined}
                                        onChange={(e) => { setDelegationCompleted({ id: blocker.id, isCompleted: e.target.checked }).catch(console.error) }}
                                        style={{ width: '1em', height: '1em' }}
                                    />
                                    {" "}
                                    <SingleLineMarkdown>{delegationsById.get(blocker.id)!.text}</SingleLineMarkdown>
                                    {" "} {unlinkButton}
                                </Box>
                        }
                    })}
                </Box>
            </Box>
        }
    </Box>
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

    return <Dialog open fullWidth onClose={onHide} PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave() },

    }}>
        <DialogTitle>Edit project</DialogTitle>
        <DialogContent>
            <TextField margin="normal" fullWidth autoFocus label="Project name" type="text" value={newName} onChange={(e) => { setNewName(e.target.value) }} />

            <FormControl sx={{ mt: 4 }}>
                <InputLabel>Color</InputLabel>
                <TextField
                    type="color"
                    margin="normal"
                    sx={{ minWidth: "5em", height: "2em" }}
                    value={newColor}
                    onChange={(e) => { setNewColor(e.target.value) }}
                />
            </FormControl>
        </DialogContent >

        <DialogActions>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>

            <Button variant="contained" type="submit">
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </DialogActions>
    </Dialog>;
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

    const [expanded, setExpanded] = useState(!projectTasks.isEmpty());
    const [editing, setEditing] = useState(false);

    const showTasks = projectTasks.sortBy(t => [t.completedAtMillis !== undefined, -t._creationTime], listcmp);

    return <>
        {editing && <EditProjectModal
            project={project!}
            onHide={() => { setEditing(false) }}
        />}
        <Accordion sx={{ backgroundColor: project?.color ?? 'none' }} expanded={expanded}>
            <AccordionSummary onClick={() => { setExpanded(!expanded) }} expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                    {project === undefined
                        ? "(misc)"
                        : project.name
                    }
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                <CreateTaskForm project={project} />
                {showTasks.map((task) =>
                    <Box key={task._id} sx={{ ":hover": { outline: '1px solid gray' } }}>
                        <Task
                            task={task}
                            projectsById={projectsById}
                            tasksById={tasksById}
                            delegationsById={delegationsById}
                        />
                    </Box>
                )}
            </AccordionDetails>
            <AccordionActions>
                <Button size="small" onClick={() => { setEditing(true) }}>Edit Project</Button>
            </AccordionActions>
        </Accordion>
    </>;
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

    return <Stack direction="column">
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Inbox />
            </Grid>

            <Grid item xs={12} sm={6}>
                <Card>
                    <CardContent>
                        <Box sx={{ textAlign: 'center' }}><h1> Timed Out </h1></Box>
                        <Box>
                            {timedOutBlockers === undefined
                                ? <Box>Loading...</Box>
                                : timedOutBlockers
                                    .map((blocker) => <Box key={blocker._id} sx={{ ":hover": { outline: "1px solid gray" } }}>
                                        <Delegation delegation={blocker} />
                                    </Box>)}
                        </Box>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
                <h1>Next Actions</h1>
                <TextField
                    size="small"
                    value={nextActionFilterField}
                    onChange={(e) => { setNextActionFilterField(e.target.value) }}
                    label="filter"
                    style={{ maxWidth: '10em' }}
                />
            </Box>
            <Box>
                {(tasksGroupedByProject === undefined
                    || outstandingBlockers === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                    || delegationsById === undefined
                )
                    ? <Box>Loading...</Box>
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
            </Box>
        </Box>

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
                <h1>Projects</h1>
                <CreateProjectForm />
            </Box>
            {(tasksGroupedByProject === undefined
                || outstandingBlockers === undefined
                || projectsById === undefined
                || tasksById === undefined
                || delegationsById === undefined
            )
                ? <Box>Loading...</Box>
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
        </Box>

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}><h1> Delegations </h1></Box>
            <Card><CardContent>
                {blockers === undefined
                    ? <Box>Loading...</Box>
                    : blockers
                        .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text], listcmp)
                        .map((blocker) => <Box key={blocker._id} sx={{ ":hover": { outline: '1px solid gray' } }}>
                            <Delegation delegation={blocker} />
                        </Box>
                        )}
                <CreateDelegationForm />
            </CardContent></Card>
        </Box>
    </Stack>
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

    return <Dialog open fullWidth onClose={onHide} PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave() },
    }}>
        <DialogTitle>Edit delegation</DialogTitle>
        <DialogContent>
            <TextField fullWidth autoFocus margin="normal" label="Text" type="text" value={newText} onChange={(e) => { setNewText(e.target.value) }} />
            <FormHelperText>You can use markdown here.</FormHelperText>

            <TextField sx={{ mt: 4 }} fullWidth margin="normal" label="Timeout" type="date" value={newTimeoutMillis === undefined ? '' : formatDate(new Date(newTimeoutMillis), 'yyyy-MM-dd')} onChange={(e) => { setNewTimeoutMillis(e.target.value === '' ? undefined : parseISO(e.target.value).getTime()) }} />
        </DialogContent>

        <DialogActions>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>

            <Button variant="contained" type="submit">
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </DialogActions>
    </Dialog>;
}

function Delegation({ delegation }: { delegation: Doc<'delegations'> }) {
    const setCompleted = useMutation(api.delegations.setCompleted);

    const [editing, setEditing] = useState(false);

    return <Stack direction="row">
        {editing && <EditDelegationModal
            delegation={delegation}
            onHide={() => { setEditing(false) }}
        />}
        <Checkbox
            checked={delegation.completedAtMillis !== undefined}
            onChange={(e) => { setCompleted({ id: delegation._id, isCompleted: e.target.checked }).catch(console.error) }}
            style={{ width: '1em', height: '1em' }}
        />
        <Box sx={{ ml: 1, flexGrow: 1 }} role="button" onClick={() => { setEditing(true) }}>
            <SingleLineMarkdown>{delegation.text}</SingleLineMarkdown>
            {" "}
            {delegation.timeoutMillis !== undefined && <Typography sx={{ color: 'gray' }}>(by {formatDate(delegation.timeoutMillis, 'yyyy-MM-dd')})</Typography>}
        </Box>
    </Stack>
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
        <Stack direction="row">
            <TextField size="small" sx={{ flexGrow: 1 }} value={text} onChange={(e) => {
                const timeout = guessTimeoutMillisFromText(e.target.value);
                if (timeout) {
                    setTimeout(formatDate(timeout.timeout, 'yyyy-MM-dd'));
                    setText(timeout.withoutDate);
                } else {
                    setText(e.target.value);
                }
            }} placeholder="New delegation text" />
            <TextField size="small" type="date" style={{ maxWidth: '10em' }} value={timeout} onChange={(e) => { setTimeout(e.target.value) }} placeholder="timeout" />
            <Button size="small" variant="contained" type="submit">+delegation</Button>
        </Stack>
    </form>
}