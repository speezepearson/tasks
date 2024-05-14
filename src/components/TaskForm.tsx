import { useCallback, useEffect, useMemo, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, must, parseISOMillis, useMapify, useNow, useParsed, watchReqStatus } from "../common";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { List, Map } from "immutable";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { TagAutocomplete } from "./TagAutocomplete";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDate } from "date-fns";
import { BlockerAutocomplete } from "./BlockerAutocomplete";
import { NewBlockers } from "../../convex/tasks";
import SubjectIcon from "@mui/icons-material/Subject";
import Markdown from "react-markdown";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export interface TaskFormProps {
    init?: Doc<'tasks'>;
    forceProject?: Doc<'projects'>;
    recommendedProject?: Doc<'projects'>;
    projectsById?: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'tasks'>, 'text' | 'details' | 'project' | 'tags' | 'blockedUntilMillis'> & { blockers: NewBlockers }) => Promise<unknown>;
}

export function TaskForm({ init, forceProject, recommendedProject, projectsById, onSubmit }: TaskFormProps) {
    const allTasks = useMapify(useQuery(api.tasks.list), '_id');
    const now = useNow();

    const defaultProject = useMemo(() => {
        if (forceProject) return forceProject;
        if (recommendedProject) return recommendedProject;
        if (init) return must(projectsById?.get(init.project), "task references nonexistent project");
        if (projectsById) return must(projectsById.valueSeq().find(p => p.name === 'Inbox'), "everybody must have an Inbox project");
        return undefined;
    }, [init, forceProject, recommendedProject, projectsById]);

    const [project, setProject] = useState(defaultProject);
    useEffect(() => {
        if (project === undefined) setProject(defaultProject);
    }, [defaultProject, project]);

    const [projectFieldValid, setProjectFieldValid] = useState(true);

    const [text, textF, setTextF] = useParsed(init?.text ?? "", useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [details, detailsF, setDetailsF] = useParsed(init?.details ?? "", useCallback(detailsF => {
        return { type: 'ok', value: detailsF.trim() };
    }, []));

    const [blockedUntilMillis, blockedUntilF, setBlockedUntilF] = useParsed(init?.blockedUntilMillis ? formatDate(init.blockedUntilMillis, 'yyyy-MM-dd') : '', useCallback(blockedUntilF => {
        const millis = parseISOMillis(blockedUntilF);
        if (millis === undefined) return { type: 'ok', value: undefined };
        if (init !== undefined) return { type: 'ok', value: millis }; // editing an existing task, it's okay if the date is in the past
        if (millis < now.getTime()) return { type: 'err', message: "New task's blocked-until must be in the future" };
        return { type: 'ok', value: millis };
    }, [init, now]));
    const blockerOptions = useMemo(
        () => allTasks?.valueSeq().filter(
            t => t.project === project?._id
                && t._id !== init?._id
                && t.completedAtMillis === undefined).toList(),
        [allTasks, init, project]);
    const [blockers, setBlockers] = useState<List<Doc<'tasks'> | string>>(List());
    useEffect(() => { init?.blockers && setBlockers(List(init.blockers).map(b => must(allTasks?.get(b.id), 'blocker not found'))) }, [init?.blockers, allTasks]);

    const [tags, setTags] = useState(init?.tags && List(init.tags))

    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });

    const canSubmit = req.type !== 'working'
        && project !== undefined
        && text.type === 'ok'
        && details.type === 'ok'
        && blockedUntilMillis.type === 'ok'
        && projectFieldValid;

    const submit = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await onSubmit({
                text: text.value,
                details: details.value,
                project: project._id,
                tags: List(tags).sort().toArray(),
                blockedUntilMillis: blockedUntilMillis.value,
                blockers: blockers.map(b => typeof b === 'string' ? { type: 'newTask' as const, text: b } : { type: 'task' as const, id: b._id }).toArray(),
            }).then(() => {
                if (!init) {
                    setTextF("");
                    setDetailsF("");
                    setProject(defaultProject);
                    setBlockedUntilF('');
                    setBlockers(List());
                    setTags(List());
                }
            })
        })());
    }, [canSubmit, text, details, project, tags, onSubmit, init, defaultProject, setTextF, setDetailsF, blockedUntilMillis, setBlockedUntilF, blockers, setBlockers]);

    const [showEditableDetails, setShowEditableDetails] = useState(false);

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
                    // no error={!!textErr} because the necessity is obvious
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

                {showEditableDetails
                    ? <TextField
                        label="Details"
                        autoFocus
                        sx={{ mt: 5 }}
                        InputLabelProps={{ shrink: true }}
                        multiline minRows={2} maxRows={6}
                        disabled={req.type === 'working'}
                        value={detailsF}
                        onChange={(e) => { setDetailsF(e.target.value); }}
                        onBlur={() => { setShowEditableDetails(false) }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowEditableDetails(false);
                            }
                        }}
                    />
                    : <Box onClick={(e) => { if (!(e.target instanceof HTMLAnchorElement)) setShowEditableDetails(true) }}>
                        <Stack sx={{ pl: 2 }} direction="row" spacing={1} alignItems="top" color="GrayText">
                            <SubjectIcon fontSize="small" />
                            {details.type === 'ok' && details.value !== ""
                                ? <Box sx={{ fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
                                    <Markdown>{details.value}</Markdown>
                                </Box>
                                : <Typography>Details...</Typography>}
                        </Stack>
                    </Box>}
            </Stack>

            {forceProject !== undefined
                ? null
                : projectsById === undefined || project === undefined
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
                    />
            }

            <TagAutocomplete
                value={tags ?? List()}
                onChange={setTags}
                disabled={req.type === 'working'}
            />

            <Accordion defaultExpanded={init?.blockedUntilMillis !== undefined || (init?.blockers.length ?? 0) > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography>Blocked?</Typography></AccordionSummary>
                <AccordionDetails>
                    <TextField
                        label="Until date"
                        InputLabelProps={{ shrink: true }}
                        error={blockedUntilMillis.type === 'err'}
                        fullWidth
                        type="date"
                        value={blockedUntilF}
                        onChange={(e) => { setBlockedUntilF(e.target.value) }}
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
                {init ? "Save" : "Create"}
            </Button></Box>
        </Stack>
    </form>;
}
