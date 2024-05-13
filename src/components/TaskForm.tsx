import { useCallback, useEffect, useMemo, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, must, parseISOMillis, useMapify, useParsed, watchReqStatus } from "../common";
import { Box, Button, FormControl, FormHelperText, Stack, TextField } from "@mui/material";
import { List, Map } from "immutable";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { TagAutocomplete } from "./TagAutocomplete";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDate } from "date-fns";
import { BlockerAutocomplete } from "./BlockerAutocomplete";

export function TaskForm({ init, initProject, projectsById, onSubmit }: {
    init?: Doc<'tasks'>;
    initProject?: Doc<'projects'>;
    projectsById?: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'tasks'>, 'text' | 'project' | 'tags' | 'blockedUntilMillis' | 'blockers'>) => Promise<unknown>;
}) {
    const inbox = useQuery(api.projects.getInbox);
    const createTask = useMutation(api.tasks.create);

    initProject = useMemo(() => {
        if (init) return must(projectsById?.get(init.project), "task references nonexistent project");
        if (initProject) return initProject;
        return inbox;
    }, [inbox, init, initProject, projectsById]);

    const [project, setProject] = useState(initProject);
    const [projectFieldValid, setProjectFieldValid] = useState(true);

    const [text, textF, setTextF] = useParsed(init?.text ?? "", useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [blockedUntilMillis, blockedUntilF, setBlockedUntilF] = useParsed(init?.blockedUntilMillis ? formatDate(init.blockedUntilMillis, 'yyyy-MM-dd') : '', useCallback(blockedUntilF => {
        const millis = parseISOMillis(blockedUntilF);
        // don't check whether it's in the future, because we're editing an existing delegation, which might have already timed out
        return millis === undefined
            ? { type: 'ok', value: undefined }
            : { type: 'ok', value: millis };
    }, []));
    const projectTasks = useMapify(useQuery(api.tasks.listProject, project ? { project: project._id } : 'skip'), '_id');
    const blockerOptions = useMemo(() => projectTasks?.valueSeq().filter(t => t._id !== init?._id && t.completedAtMillis === undefined).toList(), [projectTasks, init]);
    const [blockers, setBlockers] = useState<List<Doc<'tasks'> | string>>(List());
    useEffect(() => {
        if (!blockers.isEmpty()) return;
        if (init === undefined) return;
        if (projectTasks === undefined) return;
        setBlockers(List(init.blockers).map(b => must(projectTasks.get(b.id), 'blocker not found')));
    }, [init, projectTasks, blockers]);

    const [tags, setTags] = useState(List(init?.tags ?? []))

    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });

    const canSubmit = req.type !== 'working'
        && project !== undefined
        && text.type === 'ok'
        && blockedUntilMillis.type === 'ok'
        && projectFieldValid;

    const submit = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            const fullBlockers: Doc<'tasks'>['blockers'] = await Promise.all(blockers.map(async blocker => {
                if (typeof blocker === 'string') {
                    const id = await createTask({ text: blocker, project: project._id });
                    return { type: 'task' as const, id };
                }
                return { type: 'task' as const, id: blocker._id };
            }));
            console.log('settingblcokers', fullBlockers)
            await onSubmit({
                text: text.value,
                project: project._id,
                tags: List(tags).sort().toArray(),
                blockedUntilMillis: blockedUntilMillis.value,
                blockers: fullBlockers,
            }).then(() => {
                if (!init) {
                    setTextF("");
                    setProject(initProject);
                    setBlockedUntilF('');
                    setBlockers(List());
                    setTags(List());
                }
            })
        })());
    }, [canSubmit, text, project, tags, onSubmit, init, initProject, setTextF, blockedUntilMillis, setBlockedUntilF, blockers, setBlockers, createTask]);

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

            {projectsById !== undefined && project !== undefined && <ProjectAutocomplete
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
