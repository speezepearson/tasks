import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { useLoudRequestStatus, watchReqStatus } from "../common";
import { addDays, formatDate } from "date-fns";
import { Button, Stack, TextField } from "@mui/material";
import { guessTimeoutMillisFromText } from "../common";
import { parseISOMillis } from "../common";

export function CreateDelegationForm() {
    const createDelegation = useMutation(api.delegations.create);
    const [text, setText] = useState("");
    const [timeoutMillis, setTimeoutMillis] = useState(addDays(new Date(), 1).getTime());
    const [req, setReq] = useLoudRequestStatus();

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createDelegation({ text, timeoutMillis });
            setText("");
        })());
    }}>
        <Stack direction="row">
            <TextField
                label="New text"
                size="small"
                margin="normal"
                sx={{ flexGrow: 1 }}
                value={text} onChange={(e) => {
                    const timeout = guessTimeoutMillisFromText(e.target.value);
                    if (timeout) {
                        setTimeoutMillis(timeout.timeout.getTime());
                        setText(timeout.withoutDate);
                    } else {
                        setText(e.target.value);
                    }
                }}
            />
            <TextField
                label="timeout"
                size="small"
                margin="normal"
                type="date"
                style={{ maxWidth: '10em' }}
                value={formatDate(timeoutMillis, 'yyyy-MM-dd')}
                onChange={(e) => {
                    const timeoutMillis = parseISOMillis(e.target.value);
                    if (timeoutMillis !== undefined) setTimeoutMillis(timeoutMillis);
                }}
            />
            <Button size="small" variant="contained" type="submit">+delegation</Button>
        </Stack>
    </form>;
}
