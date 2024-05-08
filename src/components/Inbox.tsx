import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import { CardContent, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useLoudRequestStatus, watchReqStatus } from "../common";

function QuickCaptureForm() {
    const [text, setText] = useState("");
    const createCapture = useMutation(api.captures.create);
    const [req, setReq] = useLoudRequestStatus();

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createCapture({ text });
            setText("");
        })());
    }}>
        <Stack direction="row">
            <TextField
                size="small"
                fullWidth
                label="Capture text"
                autoFocus
                disabled={req.type === 'working'}
                value={text}
                onChange={(e) => { setText(e.target.value) }}
            />
            <Button variant="contained" size="small" disabled={req.type === 'working'} type="submit">+note</Button>
        </Stack>
    </form>
}

export function Inbox() {
    const captures = useQuery(api.captures.list, { limit: 10 });
    const archive = useMutation(api.captures.archive);

    const [, setReq] = useLoudRequestStatus();

    return <Card>
        <CardContent>
            <Box sx={{ textAlign: 'center' }}>
                <h1>Inbox</h1>
                <QuickCaptureForm />
            </Box>

            <Stack direction="column">
                {captures?.map((capture) => <Stack direction="row" key={capture._id}>
                    <Typography noWrap><SingleLineMarkdown>{capture.text}</SingleLineMarkdown></Typography>
                    <Button size="small" variant="outlined" sx={{ ml: "auto", py: 0 }} onClick={() => { watchReqStatus(setReq, archive({ id: capture._id })) }}>Archive</Button>
                </Stack>)}
            </Stack>
        </CardContent>
    </Card>
}
