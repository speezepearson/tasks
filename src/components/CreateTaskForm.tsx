import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { Doc } from "../../convex/_generated/dataModel";
import { ReqStatus, watchReqStatus } from "../common";
import { Button, Stack, TextField } from "@mui/material";

export function CreateTaskForm({ project }: { project?: Doc<'projects'>; }) {
    const createTask = useMutation(api.tasks.create);
    const [text, setText] = useState("");
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    const inputRef = useRef<HTMLInputElement>(null);

    const [justCreated, setJustCreated] = useState(false);

    useEffect(() => {
        if (justCreated) {
            setJustCreated(false);
            inputRef.current?.getElementsByTagName('input')[0].focus();
        }
    }, [justCreated, inputRef]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createTask({ text, project: project?._id });
            setText("");
            setJustCreated(true);
        })());
    }}>
        <Stack direction="row" alignItems={'center'}>
            <TextField
                label="New text"
                sx={{ flexGrow: 1 }}
                ref={inputRef}
                disabled={req.type === 'working'}
                value={text}
                onChange={(e) => { setText(e.target.value); }}
            />
            <Button sx={{ ml: 1, py: 1 }} variant="contained"
                disabled={req.type === 'working'}
                type="submit"
            >
                +task
            </Button>
        </Stack>
    </form>;
}
