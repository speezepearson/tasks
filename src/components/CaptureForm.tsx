import { useCallback } from "react";
import { useLoudRequestStatus, useParsed, watchReqStatus } from "../common";
import { Button, Stack, TextField } from "@mui/material";

export function CaptureForm({ onSubmit, }: {
    onSubmit: (args: { text: string }) => Promise<unknown>;
}) {

    const [text, textF, setTextF] = useParsed("" as string, useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: text };
    }, []));

    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && text.type === 'ok';

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        watchReqStatus(setReq, onSubmit({ text: text.value }).then(() => {
            setTextF("");
        }));
    }}>
        <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <TextField
                label="Text"
                autoFocus
                error={text.type === 'err' && textF !== ''}
                fullWidth
                sx={{ mt: 1 }}
                value={textF}
                onChange={(e) => { setTextF(e.target.value); }} />

            <Button variant="contained" type="submit" sx={{ py: 1 }} disabled={!canSubmit}>
                Capture
            </Button>
        </Stack>
    </form>;
}
