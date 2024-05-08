import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { Doc } from "../../convex/_generated/dataModel";
import { Result, useLoudRequestStatus, watchReqStatus } from "../common";
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

export function AddBlockerModal({ onHide, task, allTasks, allDelegations }: {
    onHide: () => unknown;
    task: Doc<'tasks'>;
    allTasks: List<Doc<'tasks'>>;
    allDelegations: List<Doc<'delegations'>>;
}) {
    const linkBlocker = useMutation(api.tasks.linkBlocker);
    const createTask = useMutation(api.tasks.create);

    const optionsByText = useMemo(() => Map([
        ...allTasks
            .filter(t => t._id !== task._id && (t.project === task.project))
            .map(t => [t.text, () => linkBlocker({ id: task._id, blocker: { type: 'task', id: t._id } })] as [string, () => Promise<null>]),
        ...allDelegations
            .filter(d => d.project === task.project)
            .map(b => [b.text, () => linkBlocker({ id: task._id, blocker: { type: 'delegation', id: b._id } })] as [string, () => Promise<null>]),
    ]), [allTasks, allDelegations, linkBlocker, task]);

    const [textF, setTextF] = useState("");
    const text: Result<string> = useMemo(() => {
        if (textF.trim() === "") return { type: 'err', message: "Text is required" };
        return { type: 'ok', value: textF };
    }, [textF]);
    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && text.type === 'ok';
    const selectedOption = text.type === 'ok' ? optionsByText.get(text.value) : undefined;

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
        if (!canSubmit) return;
        watchReqStatus(setReq,
            (async () => {
                if (selectedOption === undefined) {
                    const newTaskId = await createTask({
                        text: text.value,
                        project: task.project,
                    });
                    await linkBlocker({
                        id: task._id,
                        blocker: { type: 'task', id: newTaskId },
                    });
                } else {
                    await selectedOption();
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
                inputValue={textF}
                onInputChange={(_, value) => { setTextF(value) }}
            />
        </DialogContent>
        <DialogActions>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>
            <Button variant="contained" type="submit" disabled={!canSubmit}>
                {req.type === 'working' ? 'Linking...' :
                    selectedOption ? 'Link blocker' :
                        'Create subtask'}
            </Button>
        </DialogActions>
    </Dialog>;
}
