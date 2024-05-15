import { useCallback, useEffect, useMemo, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, must, useMapify, useNow, useParsed, watchReqStatus } from "../common";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { List, Map, Set } from "immutable";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { TagAutocomplete } from "./TagAutocomplete";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BlockerAutocomplete } from "./BlockerAutocomplete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DetailsEditor } from "./DetailsEditor";
import { OptionalDateField } from "./OptionalDateField";

export interface CreateTaskFormProps {
    forceProject?: Doc<'projects'>;
    recommendedProject?: Doc<'projects'>;
    projectsById?: Map<Id<'projects'>, Doc<'projects'>>;
    onUpdate?: () => void;
}

export function CreateTaskForm({ forceProject, recommendedProject, projectsById, onUpdate }: CreateTaskFormProps) {
    const inbox = projectsById?.valueSeq().find(p => p.name === 'Inbox');
    const createTask = useMutation(api.tasks.create);

    const allTasks = useMapify(useQuery(api.tasks.list, useConvexAuth().isAuthenticated ? {} : 'skip'), '_id');
    const now = useNow();

    const [project, setProject] = useState(forceProject ?? recommendedProject ?? inbox);
    const [projectFieldValid, setProjectFieldValid] = useState(true);
    useEffect(() => {
        if (project === undefined) setProject(inbox);
    }, [project, inbox]);

    const [text, textF, setTextF] = useParsed('' as string, useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [detailsF, setDetailsF] = useState('');

    const [blockedUntilMillis, blockedUntilF, setBlockedUntilF] = useParsed(undefined as number | undefined, useCallback(blockedUntilF => {
        if (blockedUntilF !== undefined && blockedUntilF < now.getTime()) {
            return { type: 'err', message: "Blocked until date must be in the future" };
        }
        return { type: 'ok', value: blockedUntilF };
    }, [now]));
    const blockerOptions = useMemo(
        () => allTasks?.valueSeq().filter(
            t => t.project === project?._id
                && t.completedAtMillis === undefined).toList(),
        [allTasks, project]);
    const [blockers, setBlockers] = useState<List<Doc<'tasks'> | string>>(List());

    const [tags, setTags] = useState(List<string>())

    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });

    const canSubmit = req.type !== 'working'
        && project !== undefined
        && text.type === 'ok'
        && blockedUntilMillis.type === 'ok'
        && projectFieldValid;

    const submit = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await createTask({
                text: text.value,
                details: detailsF,
                project: project._id,
                tags: tags.sort().toArray(),
                blockedUntilMillis: blockedUntilMillis.value,
                blockers: blockers.map(b => typeof b === 'string' ? { type: 'newTask' as const, text: b } : { type: 'task' as const, id: b._id }).toArray(),
            }).then(onUpdate)
        })());
    }, [canSubmit, text, detailsF, project, tags, blockedUntilMillis, blockers, createTask, onUpdate]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        submit();
    }}>
        <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <Stack direction="column" spacing={0.5}>
                <TextField
                    label="Text"
                    autoFocus
                    multiline maxRows={6}
                    error={text.type === 'err'}
                    disabled={req.type === 'working'}
                    value={textF}
                    onChange={(e) => { setTextF(e.target.value); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />

                <DetailsEditor
                    value={detailsF}
                    onChange={setDetailsF}
                    disabled={req.type === 'working'}
                />
            </Stack>

            {projectsById === undefined || project === undefined
                ? <TextField
                    label="Project"
                    fullWidth
                    disabled
                    value="Loading projects..."
                />
                : <ProjectAutocomplete
                    value={project}
                    projectsById={projectsById}
                    onChange={setProject}
                    onValid={setProjectFieldValid}
                    disabled={req.type === 'working'}
                />}

            <TagAutocomplete
                value={tags}
                onChange={setTags}
                disabled={req.type === 'working'}
            />

            <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Blocked?</Typography></AccordionSummary>
                <AccordionDetails>
                    <OptionalDateField
                        label="Until date"
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        type="date"
                        value={blockedUntilF}
                        onChange={setBlockedUntilF}
                        disabled={req.type === 'working'}
                    />

                    <BlockerAutocomplete
                        options={blockerOptions ?? List()}
                        value={blockers}
                        onChange={setBlockers}
                    />
                </AccordionDetails>
            </Accordion>

            <Box sx={{ ml: 'auto' }}><Button sx={{ mt: 2, py: 1 }} variant="contained"
                disabled={!canSubmit}
                type="submit"
            >
                Create
            </Button></Box>
        </Stack>
    </form>;
}

export interface EditTaskFormProps {
    init: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onUpdate: () => void;
}

export function EditTaskForm({ init, projectsById, onUpdate }: EditTaskFormProps) {
    const updateTask = useMutation(api.tasks.update);

    const allTasks = useMapify(useQuery(api.tasks.list), '_id');

    const [project, setProject] = useState(must(projectsById.get(init.project), "task references nonexistent project"));
    const [projectFieldValid, setProjectFieldValid] = useState(true);

    const [text, textF, setTextF] = useParsed(init.text, useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [detailsF, setDetailsF] = useState(init.details);

    const [blockedUntil, setBlockedUntil] = useState(init.blockedUntilMillis);

    const blockerOptions = useMemo(
        () => allTasks?.valueSeq().filter(
            t => t.project === project._id
                && t._id !== init._id
                && t.completedAtMillis === undefined).toList(),
        [allTasks, init, project]);

    // We can't properly render the blockers-field until we have allTasks,
    // so we initialize the field value as undefined, and set it to the actual value
    // once allTasks comes in.
    const [blockers, setBlockers] = useState<List<Doc<'tasks'> | string> | undefined>(undefined);
    useEffect(() => {
        if (blockers === undefined && allTasks !== undefined) {
            setBlockers(List(init.blockers.map(b => must(allTasks.get(b.id), "task references nonexistent blocker-task"))));
        }
    }, [blockers, allTasks, init, setBlockers])

    const [tags, setTags] = useState(List(init.tags))

    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });

    const canSubmit = req.type !== 'working'
        && text.type === 'ok'
        && blockers !== undefined
        && projectFieldValid;

    const submit = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            console.log("updating", { detailsF })
            await updateTask({
                id: init._id,
                text: text.value,
                details: detailsF,
                project: project._id,
                addTags: Set(tags).subtract(Set(init.tags)).toArray(),
                delTags: Set(init.tags).subtract(Set(tags)).toArray(),
                blockedUntilMillis: { new: blockedUntil },
                blockers: blockers.map(b => typeof b === 'string' ? { type: 'newTask' as const, text: b } : { type: 'task' as const, id: b._id }).toArray(),
            }).then(onUpdate)
        })());
    }, [canSubmit, text, detailsF, project, tags, init, blockedUntil, blockers, onUpdate, updateTask]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        submit();
    }}>
        <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <Stack direction="column" spacing={0.5}>
                <TextField
                    label="Text"
                    autoFocus
                    multiline maxRows={6}
                    error={text.type === 'err'}
                    disabled={req.type === 'working'}
                    value={textF}
                    onChange={(e) => { setTextF(e.target.value); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />

                <DetailsEditor
                    value={detailsF}
                    onChange={setDetailsF}
                    disabled={req.type === 'working'}
                />
            </Stack>

            <ProjectAutocomplete
                value={project}
                projectsById={projectsById}
                onChange={setProject}
                onValid={setProjectFieldValid}
                disabled={req.type === 'working'}
            />

            <TagAutocomplete
                value={tags}
                onChange={setTags}
                disabled={req.type === 'working'}
            />

            <Accordion defaultExpanded={init.blockedUntilMillis !== undefined || init.blockers.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Blocked?</Typography></AccordionSummary>
                <AccordionDetails>
                    <OptionalDateField
                        label="Until date"
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        type="date"
                        value={blockedUntil}
                        onChange={setBlockedUntil}
                        disabled={req.type === 'working'}
                    />

                    <BlockerAutocomplete
                        options={blockerOptions ?? List()}
                        value={blockers ?? List()}
                        onChange={setBlockers}
                        disabled={req.type === 'working' || blockers === undefined}
                    />
                </AccordionDetails>
            </Accordion>

            <Box sx={{ ml: 'auto' }}><Button sx={{ mt: 2, py: 1 }} variant="contained"
                disabled={!canSubmit}
                type="submit"
            >
                Save
            </Button></Box>
        </Stack>
    </form>;
}
