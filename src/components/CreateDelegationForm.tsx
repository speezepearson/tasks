import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { Result, useLoudRequestStatus, useNow, watchReqStatus } from "../common";
import { addDays, formatDate, startOfDay } from "date-fns";
import { Button, Stack, TextField } from "@mui/material";
import { parseISOMillis } from "../common";

export function CreateDelegationForm() {
    const createDelegation = useMutation(api.delegations.create);
    const todayStr = formatDate(addDays(startOfDay(useNow()), 1), 'yyyy-MM-dd');
    const [textF, setTextF] = useState("");
    const [timeoutF, setTimeoutF] = useState(todayStr);
    const [req, setReq] = useLoudRequestStatus();

    const text: Result<string> = useMemo(() =>
        textF.trim() === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF },
        [textF],
    );
    const timeoutMillis: Result<number> = useMemo(() => {
        const millis = parseISOMillis(timeoutF);
        return millis === undefined
            ? { type: 'err', message: "Invalid date" }
            : { type: 'ok', value: millis };
    }, [timeoutF]);
    const canSubmit = req.type !== 'working'
        && text.type === 'ok'
        && timeoutMillis.type === 'ok';

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await createDelegation({ text: text.value, timeoutMillis: timeoutMillis.value });
            setTextF("");
        })());
    }}>
        <Stack direction="row">
            <TextField
                label="New text"
                // no error={text.type==='err'} because the necessity is obvious
                sx={{ flexGrow: 1 }}
                value={textF}
                onChange={(e) => {
                    const timeout = parseISOMillis(e.target.value);
                    if (timeout) {
                        setTimeoutF(formatDate(timeout, 'yyyy-MM-dd'));
                        setTextF("");
                    } else {
                        setTextF(e.target.value);
                    }
                }}
            />
            <TextField
                label="timeout"
                error={timeoutMillis.type === 'err'}
                type="date"
                style={{ maxWidth: '10em' }}
                value={timeoutF}
                onChange={(e) => { setTimeoutF(e.target.value) }}
            />
            <Button variant="contained" type="submit" disabled={!canSubmit}>
                +delegation
            </Button>
        </Stack>
    </form>;
}
