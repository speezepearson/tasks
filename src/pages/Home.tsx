import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, textMatches, useNow, watchReqStatus } from "../common";
import { addDays, formatDate, parseISO } from "date-fns";
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
            <Button sx={{ ml: 1 }} variant="contained" size="small" disabled={req.type === 'working'} type="submit">+task</Button>
        </Stack>
    </form>
}

function guessTimeoutMillisFromText(text: string): { withoutDate: string; timeout: Date } | undefined {
    const regexp = /(\d{4}-\d{2}-\d{2})$/;
    const dateMatch = text.match(regexp);
    if (dateMatch === null) return undefined;
    const timeoutMillis = parseISOMillis(dateMatch[1]);
    if (timeoutMillis === undefined) return undefined;
    return {
        withoutDate: text.replace(regexp, ''),
        timeout: new Date(timeoutMillis),
    };
}

function AddBlockerModal({ onHide, task, allTasks, allDelegations }: {
    onHide: () => unknown,
    task: Doc<'tasks'>,
    allTasks: List<Doc<'tasks'>>,
    allDelegations: List<Doc<'delegations'>>,
}) {
    const linkBlocker = useMutation(api.tasks.linkBlocker);
    const createDelegation = useMutation(api.delegations.create);

    const optionsByText = useMemo(() => Map([
        ...allTasks
            .filter(t => t._id !== task._id && (t.project === task.project || task.project === undefined))
            .map(t => [t.text, () => linkBlocker({ id: task._id, blocker: { type: 'task', id: t._id } })] as [string, () => Promise<null>]),
        ...allDelegations
            .filter(d => d.project === task.project || task.project === undefined)
            .map(b => [b.text, () => linkBlocker({ id: task._id, blocker: { type: 'delegation', id: b._id } })] as [string, () => Promise<null>]),
    ]), [allTasks, allDelegations, linkBlocker, task._id]);

    const [text, setText] = useState("");
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    // HACK: autofocus doesn't work without this ref hack.
    // Probably related to https://github.com/mui/material-ui/issues/33004
    // but the `disableRestoreFocus` workaround doesn't work here --
    // maybe because this is an Autocomplete, not a TextField?
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        setTimeout(() => {
            inputRef.current?.getElementsByTagName('input')[0].focus();
        }, 0);
    }, [inputRef])

    const doSave = () => {
        watchReqStatus(setReq,
            (async () => {
                const link = optionsByText.get(text);
                if (link === undefined) {
                    const timeout = guessTimeoutMillisFromText(text);
                    if (timeout === undefined) {
                        throw new Error("unable to guess your new delegation's timeout date; end your text with a date like '2022-12-31'");
                    }
                    if (timeout.withoutDate.trim() === "") {
                        await linkBlocker({
                            id: task._id,
                            blocker: { type: 'time', millis: timeout.timeout.getTime() },
                        });
                    } else {
                        const newDelegationId = await createDelegation(
                            { text: timeout.withoutDate, project: task.project, timeoutMillis: timeout.timeout.getTime() }
                        );
                        await linkBlocker({
                            id: task._id,
                            blocker: { type: 'delegation', id: newDelegationId },
                        });
                    }
                } else {
                    await link();
                }
                onHide();
            })()).catch(console.error);
    };

    return <Dialog open onClose={onHide} fullWidth PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave() },
    }}>
        <DialogTitle>Add blocker to "{task.text}"</DialogTitle>
        <DialogContent>
            <Autocomplete
                freeSolo
                ref={inputRef}
                autoFocus
                blurOnSelect={false}
                size="small"
                sx={{ my: 1 }}
                options={optionsByText.keySeq().sort().toArray()}
                renderInput={(params) => <TextField {...params} label="Blocker" />}
                value={text}
                onChange={(_, value) => { setText(value ?? "") }}
            />
        </DialogContent>
        <DialogActions>
            {/* <Button variant="outlined" onClick={onHide}>
                Close
            </Button> */}
            <Button variant="contained" type="submit">
                {req.type === 'working' ? 'Linking...' : 'Link blocker'}
            </Button>
        </DialogActions>
    </Dialog>;
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
    const [showBlockerModal, setShowBlockerModal] = useState(false);

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
            {showBlockerModal && <AddBlockerModal onHide={() => { setShowBlockerModal(false) }} task={task} allTasks={List(tasksById.values())} allDelegations={List(delegationsById.values())} />}
            <Button size="small" variant="outlined" sx={{ py: 0 }} onClick={() => { setShowBlockerModal(true) }}>+blocker</Button>
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
                                return <Box key={`__time-${blocker.millis}`}>
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

    const archive = useMutation(api.projects.archive);
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

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
                <Button size="small" onClick={() => {
                    watchReqStatus(setReq, archive({ id: project!._id })).catch(console.error)
                }}>Archive Project</Button>
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
            .filter(([p]) => p?.archivedAtMillis === undefined)
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
                            {(timedOutBlockers === undefined || projectsById === undefined)
                                ? <Box>Loading...</Box>
                                : timedOutBlockers
                                    .map((blocker) => <Box key={blocker._id} sx={{ ":hover": { outline: "1px solid gray" } }}>
                                        <Delegation delegation={blocker} projectsById={projectsById} />
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
                        .map(([p, projectTasks]) => {
                            projectTasks = projectTasks.filter((task) =>
                                task.completedAtMillis === undefined &&
                                outstandingBlockers.get(task._id)!.isEmpty() &&
                                textMatches(task.text, nextActionFilterField)
                            );
                            if (projectTasks.isEmpty()) return null;
                            return <ProjectCard
                                key={p?._id ?? "<undef>"}
                                project={p}
                                projectTasks={projectTasks}
                                projectsById={projectsById}
                                tasksById={tasksById}
                                delegationsById={delegationsById}
                            />
                        })}
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
                {blockers === undefined || projectsById === undefined
                    ? <Box>Loading...</Box>
                    : blockers
                        .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text], listcmp)
                        .map((blocker) => <Box key={blocker._id} sx={{ ":hover": { outline: '1px solid gray' } }}>
                            <Delegation delegation={blocker} projectsById={projectsById} />
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

function EditDelegationModal({ delegation, projectsById, onHide }: {
    delegation: Doc<'delegations'>,
    projectsById: Map<Id<'projects'>, Doc<'projects'>>,
    onHide: () => unknown,
}) {
    const update = useMutation(api.delegations.update);

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);

    const [newText, setNewText] = useState(delegation.text);
    const [newTimeoutMillis, setNewTimeoutMillis] = useState(delegation.timeoutMillis);
    const [newProjectId, setNewProjectId] = useState(delegation.project);

    const [saveReq, setSaveReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (saveReq.type === 'error') alert(saveReq.message);
    }, [saveReq]);

    const doSave = () => { watchReqStatus(setSaveReq, update({ id: delegation._id, text: newText, timeoutMillis: newTimeoutMillis, project: newProjectId }).then(onHide)).catch(console.error) }

    return <Dialog open fullWidth onClose={onHide} PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave() },
    }}>
        <DialogTitle>Edit delegation</DialogTitle>
        <DialogContent>
            <TextField fullWidth autoFocus margin="normal" label="Text" type="text" value={newText} onChange={(e) => { setNewText(e.target.value) }} />
            <FormHelperText>You can use markdown here.</FormHelperText>

            <TextField sx={{ mt: 4 }} fullWidth margin="normal" label="Timeout"
                type="date"
                value={formatDate(newTimeoutMillis, 'yyyy-MM-dd')}
                onChange={(e) => {
                    const timeoutMillis = parseISOMillis(e.target.value);
                    if (timeoutMillis !== undefined) setNewTimeoutMillis(timeoutMillis);
                }}
            />

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
    </Dialog>;
}

function Delegation({ delegation, projectsById }: { delegation: Doc<'delegations'>, projectsById: Map<Id<'projects'>, Doc<'projects'>> }) {
    const setCompleted = useMutation(api.delegations.setCompleted);

    const [editing, setEditing] = useState(false);

    return <Stack direction="row" sx={{ backgroundColor: delegation.project && projectsById.get(delegation.project)?.color }}>
        {editing && <EditDelegationModal
            delegation={delegation}
            projectsById={projectsById}
            onHide={() => { setEditing(false) }}
        />}
        <Checkbox
            checked={delegation.completedAtMillis !== undefined}
            onChange={(e) => { setCompleted({ id: delegation._id, isCompleted: e.target.checked }).catch(console.error) }}
            style={{ width: '1em', height: '1em' }}
        />
        <Box sx={{ ml: 1, flexGrow: 1 }} role="button" onClick={() => { setEditing(true) }}>
            <SingleLineMarkdown>{delegation.text}</SingleLineMarkdown>
        </Box>
        {delegation.timeoutMillis !== undefined && <Typography sx={{ color: 'gray' }}>(by {formatDate(delegation.timeoutMillis, 'yyyy-MM-dd')})</Typography>}
    </Stack>
}

function CreateDelegationForm() {
    const createDelegation = useMutation(api.delegations.create);
    const [text, setText] = useState("");
    const [timeoutMillis, setTimeoutMillis] = useState(parseISOMillis(formatDate(addDays(new Date(), 1), 'yyyy-MM-dd'))!);
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createDelegation({ text, timeoutMillis });
            setText("");
        })()).catch(console.error);
    }}>
        <Stack direction="row">
            <TextField size="small" sx={{ flexGrow: 1 }} value={text} onChange={(e) => {
                const timeout = guessTimeoutMillisFromText(e.target.value);
                if (timeout) {
                    setTimeoutMillis(timeout.timeout.getTime());
                    setText(timeout.withoutDate);
                } else {
                    setText(e.target.value);
                }
            }} placeholder="New delegation text" />
            <TextField size="small" type="date" style={{ maxWidth: '10em' }}
                value={formatDate(timeoutMillis, 'yyyy-MM-dd')}
                onChange={(e) => {
                    const timeoutMillis = parseISOMillis(e.target.value);
                    if (timeoutMillis !== undefined) setTimeoutMillis(timeoutMillis);
                }} placeholder="timeout"
            />
            <Button size="small" variant="contained" type="submit">+delegation</Button>
        </Stack>
    </form>
}

function parseISOMillis(date: string): number | undefined {
    try {
        const res = parseISO(date).getTime();
        if (isNaN(res)) return undefined;
        return res;
    } catch (e) {
        return undefined;
    }
}