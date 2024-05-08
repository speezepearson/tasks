import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import { CardContent, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { Result, useLoudRequestStatus, watchReqStatus } from "../common";

function QuickCaptureForm() {
    const [textF, setTextF] = useState("");
    const createCapture = useMutation(api.captures.create);
    const [req, setReq] = useLoudRequestStatus();

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
            await createCapture({ text: text.value });
            setTextF("");
        })());
    }}>
        <Stack direction="row" alignItems={'center'}>
            <TextField
                label="Capture text"
                // no error={!!textErr} because the necessity is obvious
                fullWidth
                autoFocus
                disabled={req.type === 'working'}
                value={textF}
                onChange={(e) => { setTextF(e.target.value) }}
            />
            <Button
                variant="contained"
                sx={{ ml: 1, py: 1 }}
                disabled={!canSubmit}
                type="submit"
            >
                +note
            </Button>
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

            <Stack direction="column" sx={{ mt: 1 }}>
                {captures?.map((capture) => <Stack key={capture._id} direction="row" sx={{ ":hover": { outline: '1px solid gray' } }}>
                    <Typography noWrap>
                        <SingleLineMarkdown>{capture.text}</SingleLineMarkdown>
                    </Typography>
                    <Button
                        variant="outlined"
                        sx={{ ml: "auto" }}
                        onClick={() => { watchReqStatus(setReq, archive({ id: capture._id })) }}
                    >
                        Archive
                    </Button>
                </Stack>)}
            </Stack>
        </CardContent>
    </Card>
}
