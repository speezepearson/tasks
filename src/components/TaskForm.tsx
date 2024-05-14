import { useCallback, useEffect, useMemo, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, must, parseISOMillis, useMapify, useNow, useParsed, watchReqStatus } from "../common";
import { Box, Button, FormControl, FormHelperText, Stack, TextField } from "@mui/material";
import { List, Map } from "immutable";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { TagAutocomplete } from "./TagAutocomplete";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDate } from "date-fns";
import { BlockerAutocomplete } from "./BlockerAutocomplete";
import { NewBlockers } from "../../convex/tasks";

export function TaskForm({ init, forceProject, projectsById, onSubmit }: {
    init?: Doc<'tasks'>;
    forceProject?: Doc<'projects'>;
    projectsById?: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'tasks'>, 'text' | 'project' | 'tags' | 'blockedUntilMillis'> & { blockers: NewBlockers }) => Promise<unknown>;
}) {
    const inbox = useQuery(api.projects.getInbox);
    const allTasks = useMapify(useQuery(api.tasks.list), '_id');
    const now = useNow();

    const defaultProject = useMemo(() => {
        if (forceProject) return forceProject;
        if (init) return must(projectsById?.get(init.project), "task references nonexistent project");
        return inbox;
    }, [inbox, init, forceProject, projectsById]);

    const [project, setProject] = useState(() => {
        if (forceProject) return forceProject;
        if (init) return must(projectsById?.get(init.project), "task references nonexistent project");
        return inbox;
    });
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
        && blockedUntilMillis.type === 'ok'
        && projectFieldValid;

    const submit = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await onSubmit({
                text: text.value,
                project: project._id,
                tags: List(tags).sort().toArray(),
                blockedUntilMillis: blockedUntilMillis.value,
                blockers: blockers.map(b => typeof b === 'string' ? { type: 'newTask' as const, text: b } : { type: 'task' as const, id: b._id }).toArray(),
            }).then(() => {
                if (!init) {
                    setTextF("");
                    setProject(defaultProject);
                    setBlockedUntilF('');
                    setBlockers(List());
                    setTags(List());
                }
            })
        })());
    }, [canSubmit, text, project, tags, onSubmit, init, defaultProject, setTextF, blockedUntilMillis, setBlockedUntilF, blockers, setBlockers]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        submit();
    }}>
        <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <FormControl>
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
                <FormHelperText>You can use markdown here.</FormHelperText>
            </FormControl>

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

            <TextField
                label="Blocked until"
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

            <Box sx={{ ml: 'auto' }}><Button sx={{ mt: 2, py: 1 }} variant="contained"
                disabled={!canSubmit}
                type="submit"
            >
                {init ? "Save" : "Create"}
            </Button></Box>
        </Stack>
    </form>;
}
