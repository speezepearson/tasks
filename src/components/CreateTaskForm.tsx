import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Doc } from "../../convex/_generated/dataModel";
import { ReqStatus, Result, watchReqStatus } from "../common";
import { Button, Stack, TextField } from "@mui/material";

export function CreateTaskForm({ project }: { project?: Doc<'projects'>; }) {
    const createTask = useMutation(api.tasks.create);
    const [textF, setTextF] = useState("");
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    const inputRef = useRef<HTMLInputElement>(null);

    const [justCreated, setJustCreated] = useState(false);
    useEffect(() => {
        if (justCreated) {
            setJustCreated(false);
            inputRef.current?.getElementsByTagName('input')[0].focus();
        }
    }, [justCreated, inputRef]);

    const text: Result<string> = useMemo(() =>
        textF.trim() === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF },
        [textF],
    );
    const canSubmit = req.type !== 'working'
        && text.type === 'ok';

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await createTask({ text: text.value, project: project?._id });
            setTextF("");
            setJustCreated(true);
        })());
    }}>
        <Stack direction="row" alignItems={'center'}>
            <TextField
                label="New text"
                // no error={!!textErr} because the necessity is obvious
                sx={{ flexGrow: 1 }}
                ref={inputRef}
                disabled={req.type === 'working'}
                value={textF}
                onChange={(e) => { setTextF(e.target.value); }}
            />
            <Button sx={{ ml: 1, py: 1 }} variant="contained"
                disabled={!canSubmit}
                type="submit"
            >
                +task
            </Button>
        </Stack>
    </form>;
}
