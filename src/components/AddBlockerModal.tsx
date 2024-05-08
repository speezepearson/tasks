import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { Doc } from "../../convex/_generated/dataModel";
import { Result, parseISOMillis, useLoudRequestStatus, useNow, watchReqStatus } from "../common";
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { formatDate, startOfDay } from "date-fns";

export function AddBlockerModal({ onHide, task, allTasks, allDelegations }: {
    onHide: () => unknown;
    task: Doc<'tasks'>;
    allTasks: List<Doc<'tasks'>>;
    allDelegations: List<Doc<'delegations'>>;
}) {
    const linkBlocker = useMutation(api.tasks.linkBlocker);
    const createTask = useMutation(api.tasks.create);
    const createDelegation = useMutation(api.delegations.create);
    const today = startOfDay(useNow());

    const tasksByText = useMemo(() => Map(allTasks
        .filter(t => t._id !== task._id && (t.project === task.project))
        .map(t => [t.text, t]),
    ), [allTasks, task]);

    const delegationsByText = useMemo(() => Map(allDelegations
        .filter(d => (d.project === task.project))
        .map(d => [d.text, d]),
    ), [allDelegations, task]);

    const allOptionTexts = useMemo(() => tasksByText.keySeq().concat(delegationsByText.keySeq()).sort().toArray(), [tasksByText, delegationsByText]);

    const [textF, setTextF] = useState("");
    const [timeoutF, setTimeoutF] = useState(formatDate(today, 'yyyy-MM-dd'));

    const intent: Result<{ type: 'raw', text: string } | { type: 'task', task: Doc<'tasks'> } | { type: 'delegation', delegation: Doc<'delegations'> }> = useMemo(() => {
        if (textF.trim() === "") return { type: 'err', message: "Text is required" };
        const task = tasksByText.get(textF);
        if (task) return { type: 'ok', value: { type: 'task', task } };
        const delegation = delegationsByText.get(textF);
        if (delegation) return { type: 'ok', value: { type: 'delegation', delegation } };
        return { type: 'ok', value: { type: 'raw', text: textF } };
    }, [textF, tasksByText, delegationsByText]);
    const timeoutMillis: Result<number> = useMemo(() => {
        const n = parseISOMillis(timeoutF);
        if (n === undefined) return { type: 'err', message: "Invalid date" };
        if (n < today.getTime()) return { type: 'err', message: "Date is in the past" };
        return { type: 'ok', value: n };
    }, [timeoutF, today]);

    useEffect(() => {
        const day = parseISOMillis(textF);
        if (day) {
            setTimeoutF(formatDate(day, 'yyyy-MM-dd'));
            setTextF("");
        }
    }, [setTimeoutF, setTextF, textF])

    const [req, setReq] = useLoudRequestStatus();

    // HACK: autofocus doesn't work without this ref hack.
    // Probably related to https://github.com/mui/material-ui/issues/33004
    // but the `disableRestoreFocus` workaround doesn't work here --
    // maybe because this is an Autocomplete, not a TextField?
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        setTimeout(() => {
            inputRef.current?.getElementsByTagName('input')[0].focus();
        }, 0);
    }, [inputRef]);

    const taskButton = useMemo(() => {
        if (intent.type === 'ok') {
            const value = intent.value;
            if (value.type === 'task') {
                return <Button variant="outlined" disabled={req.type === 'working'} onClick={() => {
                    watchReqStatus(setReq, linkBlocker({
                        id: task._id,
                        blocker: { type: 'task', id: value.task._id },
                    }).then(onHide));
                }}>Link task</Button>
            } else if (value.type === 'raw') {
                return <Button variant="outlined" disabled={req.type === 'working'} onClick={() => {
                    watchReqStatus(setReq, (async () => {
                        const newTaskId = await createTask({
                            text: value.text,
                            project: task.project,
                        });
                        await linkBlocker({
                            id: task._id,
                            blocker: { type: 'task', id: newTaskId },
                        });
                        onHide();
                    })());
                }}>Create task</Button>
            }
        }
        return <Button variant="outlined" disabled>Create task</Button>
    }, [intent, req, linkBlocker, task, createTask, onHide, setReq]);

    const delegationButton = useMemo(() => {
        if (intent.type === 'ok') {
            const value = intent.value;
            if (value.type === 'delegation') {
                return <Button variant="outlined" disabled={req.type === 'working'} onClick={() => {
                    watchReqStatus(setReq, linkBlocker({
                        id: task._id,
                        blocker: { type: 'delegation', id: value.delegation._id },
                    }).then(onHide));
                }}>Link delegation</Button>
            } else if (value.type === 'raw' && timeoutMillis.type === 'ok') {
                return <Button variant="outlined" disabled={req.type === 'working'} onClick={() => {
                    watchReqStatus(setReq, (async () => {
                        const newDelegationId = await createDelegation({
                            text: value.text,
                            project: task.project,
                            timeoutMillis: timeoutMillis.value,
                        });
                        await linkBlocker({
                            id: task._id,
                            blocker: { type: 'delegation', id: newDelegationId },
                        });
                        onHide();
                    })());
                }}>Delegate</Button>
            }
        }
        return <Button variant="outlined" disabled>Delegate</Button>
    }, [intent, req, linkBlocker, task, createDelegation, timeoutMillis, onHide, setReq]);

    return <Dialog open onClose={onHide} fullWidth>
        <DialogTitle>Add blocker to {'"'}{task.text}{'"'}</DialogTitle>
        <DialogContent>
            <Stack direction="column" spacing={2}>
                <Autocomplete
                    freeSolo
                    fullWidth
                    ref={inputRef}
                    autoFocus
                    blurOnSelect={false}
                    options={allOptionTexts}
                    renderInput={(params) => <TextField {...params} label="Blocker" sx={{ mt: 1 }} />}
                    inputValue={textF}
                    onInputChange={(_, value) => { setTextF(value) }}
                />
                <Stack direction="row" alignItems="center">
                    <Box sx={{ flexGrow: 1 }} />
                    {taskButton}
                </Stack>
                <Stack direction="row" alignItems="center">
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography sx={{ mx: 1 }}>or</Typography>
                    {delegationButton}
                    <Typography sx={{ mx: 1 }}>due</Typography>
                    {<TextField
                        label="Timeout"
                        type="date"
                        error={timeoutMillis.type === 'err'}
                        value={timeoutF}
                        sx={{ ml: 1, visibility: intent.type === 'ok' && intent.value.type === 'delegation' ? 'hidden' : 'visible' }}
                        onChange={(e) => { setTimeoutF(e.target.value) }}
                    />}
                </Stack>
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button variant="outlined" color="secondary" onClick={onHide}>
                Close
            </Button>
        </DialogActions>
    </Dialog>;
}
