import { useCallback, useMemo, useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, useNow, useParsed, watchReqStatus } from "../common";
import { addDays, formatDate } from "date-fns";
import { Autocomplete, Box, Button, FormControl, FormHelperText, Stack, TextField } from "@mui/material";
import { parseISOMillis } from "../common";

export function DelegationForm({ init, initProject, projectsById, onSubmit }: {
    init?: Doc<'delegations'>;
    initProject?: Doc<'projects'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'delegations'>, 'text' | 'timeoutMillis' | 'project'>) => Promise<unknown>;
}) {
    initProject = useMemo(() =>
        initProject ?? (init?.project
            ? must(projectsById.get(init.project), "delegation's project does not actually exist")
            : must(projectsById.valueSeq().find(p => p.name === 'Misc'), 'must have a misc project')),
        [init, initProject, projectsById])

    const now = useNow();

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);

    const [newText, textF, setTextF] = useParsed(init?.text ?? '', useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [newTimeoutMillis, timeoutF, setTimeoutF] = useParsed(formatDate(init?.timeoutMillis ?? addDays(now, 1), 'yyyy-MM-dd'), useCallback(timeoutF => {
        const millis = parseISOMillis(timeoutF);
        // don't check whether it's in the future, because we're editing an existing delegation, which might have already timed out
        return millis === undefined
            ? { type: 'err', message: "Invalid date" }
            : { type: 'ok', value: millis };
    }, []));

    const [newProjectId, projectNameF, setProjectNameF] = useParsed(initProject.name as string | null, useCallback((projectNameF: string | null) => {
        if (projectNameF === null || projectNameF == '') return { type: 'ok', value: undefined };
        const project = projectsByName.get(projectNameF);
        if (project === undefined) return { type: 'err', message: "Project not found" };
        return { type: 'ok', value: project._id };
    }, [projectsByName]));
    // This field isn't "really" used -- it's whatever the user's typed in the autocomplete field.
    // If they have "unsaved" changes (i.e. they've typed since they selected), we disable submit:
    // it feels kinda janky to be able to submit when you've typed a garbage project name.
    const [projectNameScratchF, setProjectNameScratchF] = useState('');

    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && newText.type === 'ok'
        && newTimeoutMillis.type === 'ok'
        && newProjectId.type === 'ok'
        && newProjectId.value !== undefined
        && projectNameScratchF === (projectNameF ?? '');

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        watchReqStatus(setReq, onSubmit({ text: newText.value, timeoutMillis: newTimeoutMillis.value, project: newProjectId.value }).then(() => {
            if (!init) {
                setTextF("");
            }
        }));
    }}>
        <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <FormControl>
                <TextField
                    label="Text"
                    // no error={!!textErr} because the necessity is obvious
                    sx={{ mt: 1 }}
                    fullWidth
                    autoFocus
                    type="text"
                    value={textF}
                    onChange={(e) => { setTextF(e.target.value); }}
                />
                <FormHelperText>You can use markdown here.</FormHelperText>
            </FormControl>

            <Autocomplete
                options={projectsByName.entrySeq()
                    .sortBy(([name]) => name)
                    .map((([name]) => name))
                    .toList()
                    .toArray()}
                renderInput={(params) => <TextField {...params} label="Project" error={newProjectId.type === 'err'} />}
                value={projectNameF}
                onChange={(_, name) => { setProjectNameF(name) }}
                inputValue={projectNameScratchF}
                onInputChange={(_, name) => { setProjectNameScratchF(name) }}
            />

            <TextField
                label="Timeout"
                error={newTimeoutMillis.type === 'err'}
                fullWidth
                type="date"
                value={timeoutF}
                onChange={(e) => { setTimeoutF(e.target.value) }} />

            <Box sx={{ ml: 'auto' }}><Button variant="contained" type="submit" disabled={!canSubmit} sx={{ py: 1 }}>
                {req.type === 'working' ? 'Saving...' : 'Save'}
            </Button></Box>
        </Stack>
    </form >;
}
