import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { ReqStatus, watchReqStatus } from "../common";
import { addDays, formatDate } from "date-fns";
import { Button, Stack, TextField } from "@mui/material";
import { guessTimeoutMillisFromText } from "../common";
import { parseISOMillis } from "../common";

export function CreateDelegationForm() {
    const createDelegation = useMutation(api.delegations.create);
    const [text, setText] = useState("");
    const [timeoutMillis, setTimeoutMillis] = useState(parseISOMillis(formatDate(addDays(new Date(), 1), 'yyyy-MM-dd'))!);
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createDelegation({ text, timeoutMillis });
            setText("");
        })()).catch(console.error);
    }}>
        <Stack direction="row">
            <TextField size="small" sx={{ flexGrow: 1 }} value={text} onChange={(e) => {
                const timeout = guessTimeoutMillisFromText(e.target.value);
                if (timeout) {
                    setTimeoutMillis(timeout.timeout.getTime());
                    setText(timeout.withoutDate);
                } else {
                    setText(e.target.value);
                }
            }} placeholder="New delegation text" />
            <TextField size="small" type="date" style={{ maxWidth: '10em' }}
                value={formatDate(timeoutMillis, 'yyyy-MM-dd')}
                onChange={(e) => {
                    const timeoutMillis = parseISOMillis(e.target.value);
                    if (timeoutMillis !== undefined) setTimeoutMillis(timeoutMillis);
                }} placeholder="timeout" />
            <Button size="small" variant="contained" type="submit">+delegation</Button>
        </Stack>
    </form>;
}
