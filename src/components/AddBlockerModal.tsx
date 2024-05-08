import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { Doc } from "../../convex/_generated/dataModel";
import { useLoudRequestStatus, watchReqStatus } from "../common";
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { guessTimeoutMillisFromText } from "../common";

export function AddBlockerModal({ onHide, task, allTasks, allDelegations }: {
    onHide: () => unknown;
    task: Doc<'tasks'>;
    allTasks: List<Doc<'tasks'>>;
    allDelegations: List<Doc<'delegations'>>;
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
    ]), [allTasks, allDelegations, linkBlocker, task]);

    const [text, setText] = useState("");
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
                        const newDelegationId = await createDelegation({
                            text: timeout.withoutDate,
                            project: task.project,
                            timeoutMillis: timeout.timeout.getTime(),
                        });
                        await linkBlocker({
                            id: task._id,
                            blocker: { type: 'delegation', id: newDelegationId },
                        });
                    }
                } else {
                    await link();
                }
                onHide();
            })());
    };

    return <Dialog open onClose={onHide} fullWidth PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave(); },
    }}>
        <DialogTitle>Add blocker to {'"'}{task.text}{'"'}</DialogTitle>
        <DialogContent>
            <Autocomplete
                freeSolo
                ref={inputRef}
                autoFocus
                blurOnSelect={false}
                sx={{ my: 1 }}
                options={optionsByText.keySeq().sort().toArray()}
                renderInput={(params) => <TextField {...params} label="Blocker" />}
                value={text}
                onChange={(_, value) => { setText(value ?? ""); }}
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
