import { useCallback, useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, useMiscProject, useNow, useParsed, watchReqStatus } from "../common";
import { addDays, formatDate } from "date-fns";
import { Box, Button, FormControl, FormHelperText, Stack, TextField } from "@mui/material";
import { parseISOMillis } from "../common";
import { ProjectAutocomplete } from "./ProjectAutocomplete";

export function DelegationForm({ init, initProject, projectsById, onSubmit }: {
    init?: Doc<'delegations'>;
    initProject?: Doc<'projects'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'delegations'>, 'text' | 'timeoutMillis' | 'project'>) => Promise<unknown>;
}) {
    const now = useNow();

    const [newText, textF, setTextF] = useParsed(init?.text ?? '', useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const miscProject = useMiscProject(projectsById);
    const [project, setProject] = useState(
        initProject ?? (init?.project
            ? must(projectsById.get(init.project), "delegation's project does not actually exist")
            : miscProject));
    const [projectFieldValid, setProjectFieldValid] = useState(true);

    const [newTimeoutMillis, timeoutF, setTimeoutF] = useParsed(formatDate(init?.timeoutMillis ?? addDays(now, 1), 'yyyy-MM-dd'), useCallback(timeoutF => {
        const millis = parseISOMillis(timeoutF);
        // don't check whether it's in the future, because we're editing an existing delegation, which might have already timed out
        return millis === undefined
            ? { type: 'err', message: "Invalid date" }
            : { type: 'ok', value: millis };
    }, []));

    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && newText.type === 'ok'
        && newTimeoutMillis.type === 'ok'
        && projectFieldValid;

    const submit = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, onSubmit({ text: newText.value, timeoutMillis: newTimeoutMillis.value, project: project._id }).then(() => {
            if (!init) {
                setTextF("");
            }
        }));
    }, [canSubmit, newText, newTimeoutMillis, project, onSubmit, init, setTextF, setReq]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        submit();
    }}>
        <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <FormControl>
                <TextField
                    label="Text"
                    // no error={!!textErr} because the necessity is obvious
                    multiline maxRows={6}
                    fullWidth
                    autoFocus
                    type="text"
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

            <ProjectAutocomplete
                value={project}
                projectsById={projectsById}
                onChange={setProject}
                onValid={setProjectFieldValid}
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
