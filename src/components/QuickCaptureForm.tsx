import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Result, parseISOMillis, useLoudRequestStatus, useNow, watchReqStatus } from "../common";
import { Autocomplete, Box, Button, Stack, TextField, Typography, Alert } from "@mui/material";
import { formatDate, startOfDay } from "date-fns";


export function QuickCaptureForm({ fixedProject, allProjects, autofocus = false }: {
    fixedProject?: Doc<'projects'>,
    allProjects: List<Doc<'projects'>>,
    autofocus?: boolean,
}) {

    const createCapture = useMutation(api.captures.create);
    const createTask = useMutation(api.tasks.create);
    const createDelegation = useMutation(api.delegations.create);
    const today = startOfDay(useNow());

    const [textF, setTextF] = useState("");
    const [timeoutF, setTimeoutF] = useState(formatDate(today, 'yyyy-MM-dd'));
    const [projectNameF, setProjectNameF] = useState<string | null>("Misc");
    // This field isn't "really" used -- it's whatever the user's typed in the autocomplete field.
    // If they have "unsaved" changes (i.e. they've typed since they selected), we disable submit:
    // it feels kinda janky to be able to submit when you've typed a garbage project name.
    const [projectNameScratchF, setProjectNameScratchF] = useState('');

    const projectAutocompleteOptions = useMemo(() =>
        allProjects
            .map(p => p.name)
            .sort()
            .toArray(),
        [allProjects],
    );

    const text: Result<string> = useMemo(() => {
        if (textF.trim() === "") return { type: 'err', message: "Text is required" };
        return { type: 'ok', value: textF };
    }, [textF]);
    const timeoutMillis: Result<number> = useMemo(() => {
        const n = parseISOMillis(timeoutF);
        if (n === undefined) return { type: 'err', message: "Invalid date" };
        if (n < today.getTime()) return { type: 'err', message: "Date is in the past" };
        return { type: 'ok', value: n };
    }, [timeoutF, today]);
    const projectId: Result<Id<'projects'>> = useMemo(() => {
        const project = fixedProject ?? allProjects.find(p => p.name === projectNameF);
        if (project === undefined) return { type: 'err', message: "Project not found" };
        return { type: 'ok', value: project._id };
    }, [fixedProject, projectNameF, allProjects]);

    useEffect(() => {
        const day = parseISOMillis(textF);
        if (day) {
            setTimeoutF(formatDate(day, 'yyyy-MM-dd'));
            setTextF("");
        }
    }, [setTimeoutF, setTextF, textF])

    const [req, setReq] = useLoudRequestStatus();

    const canCreateCapture = req.type !== 'working'
        && text.type === 'ok';
    const canCreateTask = req.type !== 'working'
        && text.type === 'ok'
        && projectId.type === 'ok'
        && ((fixedProject !== undefined || projectNameScratchF === (projectNameF ?? '')));
    const canCreateDelegation = req.type !== 'working'
        && text.type === 'ok'
        && timeoutMillis.type === 'ok'
        && projectId.type === 'ok'
        && ((fixedProject !== undefined || projectNameScratchF === (projectNameF ?? '')));

    const projectAutocompleter = <Autocomplete
        sx={{ mt: 1, width: '10em' }}
        options={projectAutocompleteOptions}
        renderInput={(params) => <TextField {...params} label="Project" error={projectId.type === 'err'} />}
        value={projectNameF}
        onChange={(_, projectName) => { setProjectNameF(projectName) }}
        inputValue={projectNameScratchF}
        onInputChange={(_, projectName) => { setProjectNameScratchF(projectName) }}
    />;

    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const omniboxRef = useRef<HTMLInputElement>(null);
    const done = (msg: string) => {
        omniboxRef.current?.focus();
        setTextF("");
        setAlertMsg(msg);
    }

    // for some reason autofocus on the TextField doesn't work for project-specific
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    useEffect(() => {
        if (autofocus && omniboxRef.current && isFirstLoad) {
            omniboxRef.current.focus();
            setIsFirstLoad(false);
        }
    }, [autofocus, omniboxRef, isFirstLoad])

    return <Box component="form" onSubmit={(e) => {
        e.preventDefault();
        if (!canCreateCapture) return;
        watchReqStatus(setReq, createCapture({
            text: text.value,
        }).then(() => { done("Captured!") }));
    }}>
        <Stack direction="column">
            <TextField
                label="New text"
                autoFocus={autofocus}
                error={text.type === 'err' && textF !== ''}
                inputRef={omniboxRef}
                fullWidth
                sx={{ mt: 1 }}
                value={textF}
                onChange={(e) => { setTextF(e.target.value) }}
            />

            {!fixedProject && <Button variant="contained" type="submit" disabled={!canCreateCapture}>
                Capture
            </Button>
            }

            <Stack direction="row" alignContent="center" sx={{ mt: 1 }}>
                {!fixedProject && <Typography sx={{ textAlign: 'center', mt: 0.5, minWidth: '2em' }}>or</Typography>}
                <Button sx={{ width: '9em', }} variant="outlined" disabled={!canCreateTask} onClick={() => {
                    if (!canCreateTask) return;
                    watchReqStatus(setReq, createTask({
                        text: text.value,
                        project: projectId.value,
                    }).then(() => { done("Created task!") }));
                }}>Create task</Button>
                {!fixedProject && projectAutocompleter}
            </Stack>

            <Stack direction="row" alignContent="center" sx={{ mt: 1 }}>
                <Typography sx={{ textAlign: 'center', mt: 0.5, minWidth: '2em' }}>or</Typography>
                <Button sx={{ width: '9em', }} variant="outlined" disabled={!canCreateDelegation} onClick={() => {
                    if (!canCreateDelegation) return;
                    watchReqStatus(setReq, createDelegation({
                        text: text.value,
                        project: projectId.value,
                        timeoutMillis: timeoutMillis.value,
                    }).then(() => { done("Delegated!") }));
                }}>Delegate</Button>
                {!fixedProject && projectAutocompleter}
                <TextField
                    label="Timeout"
                    type="date"
                    error={timeoutMillis.type === 'err'}
                    value={timeoutF}
                    sx={{ mt: 1 }}
                    onChange={(e) => { setTimeoutF(e.target.value) }}
                />
            </Stack>
            {alertMsg && <Alert sx={{ mt: 1 }} severity="info">{alertMsg}</Alert>}
        </Stack>
    </Box>;
}