import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback } from "react";
import { useLoudRequestStatus, useNow, useParsed, watchReqStatus } from "../common";
import { addDays, formatDate, startOfDay } from "date-fns";
import { Button, Stack, TextField } from "@mui/material";
import { parseISOMillis } from "../common";
import { Doc } from "../../convex/_generated/dataModel";

export function CreateDelegationForm({ project }: { project: Doc<'projects'> }) {
    const createDelegation = useMutation(api.delegations.create);
    const now = useNow();

    const todayStr = formatDate(addDays(startOfDay(now), 1), 'yyyy-MM-dd');

    const [text, textF, setTextF] = useParsed("" as string, useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: text };
    }, []));

    const [timeoutMillis, timeoutF, setTimeoutF] = useParsed(todayStr, useCallback(timeoutF => {
        const n = parseISOMillis(timeoutF);
        if (n === undefined) return { type: 'err', message: "Invalid date" };
        if (n < startOfDay(now).getTime()) return { type: 'err', message: "Date is in the past" };
        return { type: 'ok', value: n };
    }, [now]));

    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && text.type === 'ok'
        && timeoutMillis.type === 'ok';

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await createDelegation({ text: text.value, timeoutMillis: timeoutMillis.value, project: project._id });
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
