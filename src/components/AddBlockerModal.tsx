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
        .filter(t => t._id !== task._id && (t.project === task.project) && t.completedAtMillis === undefined)
        .map(t => [t.text, t]),
    ), [allTasks, task]);

    const delegationsByText = useMemo(() => Map(allDelegations
        .filter(d => (d.project === task.project) && d.completedAtMillis === undefined)
        .map(d => [d.text, d]),
    ), [allDelegations, task]);

    const allOptionTexts = useMemo(() => tasksByText.keySeq().concat(delegationsByText.keySeq()).sort().toArray(), [tasksByText, delegationsByText]);

    const [textF, setTextF] = useState("");
    const [timeoutF, setTimeoutF] = useState(formatDate(today, 'yyyy-MM-dd'));

    const text = textF.trim();

    const matchingTask = useMemo(() => tasksByText.get(text), [text, tasksByText]);
    const matchingDelegation = useMemo(() => delegationsByText.get(text), [text, delegationsByText]);

    const timeoutMillis: Result<number> = useMemo(() => {
        const n = parseISOMillis(timeoutF);
        if (n === undefined) return { type: 'err', message: "Invalid date" };
        if (n < today.getTime()) return { type: 'err', message: "Date is in the past" };
        return { type: 'ok', value: n };
    }, [timeoutF, today]);

    useEffect(() => {
        const day = parseISOMillis(text);
        if (day) {
            setTimeoutF(formatDate(day, 'yyyy-MM-dd'));
            setTextF("");
        }
    }, [setTimeoutF, setTextF, text])

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

    const { onSubmit, actionsSection } = (() => {
        if (matchingTask !== undefined)
            return {
                onSubmit: () => {
                    watchReqStatus(setReq, linkBlocker({
                        id: task._id,
                        blocker: { type: 'task', id: matchingTask._id },
                    }).then(onHide))
                },
                actionsSection: <Box><Button type="submit" variant="contained" disabled={req.type === 'working'}>Link task</Button></Box>,
            };
        if (matchingDelegation !== undefined)
            return {
                onSubmit: () => {
                    watchReqStatus(setReq, linkBlocker({
                        id: task._id,
                        blocker: { type: 'delegation', id: matchingDelegation._id },
                    }).then(onHide))
                },
                actionsSection: <Box><Button type="submit" variant="contained" disabled={req.type === 'working'}>Link delegation</Button></Box>,
            };

        const allDisabled = req.type === 'working' || text === "";
        return {
            onSubmit: () => {
                watchReqStatus(setReq, (async () => {
                    const newTaskId = await createTask({
                        text,
                        project: task.project,
                    });
                    await linkBlocker({
                        id: task._id,
                        blocker: { type: 'task', id: newTaskId },
                    });
                    onHide();
                })())
            },
            actionsSection: <>
                <Stack direction="row" alignItems="center">
                    <Typography sx={{ mx: 1, visibility: 'hidden' }}>or</Typography>
                    <Button variant="contained" type="submit" disabled={allDisabled}>Create task</Button>
                </Stack>
                <Stack direction={"row"} alignItems="center">
                    <Typography sx={{ mx: 1 }}>or</Typography>
                    <Button variant="outlined" disabled={allDisabled || timeoutMillis.type === 'err'} onClick={() => {
                        watchReqStatus(setReq, (async () => {
                            if (timeoutMillis.type === 'err') return;
                            const newDelegationId = await createDelegation({
                                text,
                                project: task.project,
                                timeoutMillis: timeoutMillis.value,
                            });
                            await linkBlocker({
                                id: task._id,
                                blocker: { type: 'delegation', id: newDelegationId },
                            });
                            onHide();
                        })());
                    }}>Create delegation</Button>
                    <Typography sx={{ mx: 1 }}>due</Typography>
                    <TextField
                        label="Timeout"
                        type="date"
                        error={timeoutMillis.type === 'err'}
                        value={timeoutF}
                        disabled={allDisabled}
                        sx={{ ml: 1 }}
                        onChange={(e) => { setTimeoutF(e.target.value) }}
                    />

                </Stack>
            </>,
        };
    })();

    return <Dialog open onClose={onHide} fullWidth PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit() },
    }}>
        <DialogTitle>Add blocker to {'"'}{task.text}{'"'}</DialogTitle>
        <DialogContent sx={{ minHeight: '10em' }}>
            <Stack direction="column" spacing={2}>
                <Autocomplete
                    freeSolo
                    fullWidth
                    ref={inputRef}
                    PaperComponent={({ children, ...props }) => <Box {...props} sx={{ bgcolor: 'white', border: 1, opacity: 0.8, }}>{children}</Box>}
                    autoFocus
                    blurOnSelect={false}
                    options={allOptionTexts}
                    renderInput={(params) => <TextField {...params} label="Blocker" sx={{ mt: 1 }} />}
                    inputValue={textF}
                    onInputChange={(_, value) => { setTextF(value) }}
                />
                {actionsSection}
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button variant="outlined" color="secondary" onClick={onHide}>
                Close
            </Button>
        </DialogActions>
    </Dialog>;
}
