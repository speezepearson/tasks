import { useCallback } from "react";
import { Doc } from "../../convex/_generated/dataModel";
import { useLoudRequestStatus, useParsed, watchReqStatus } from "../common";
import { Button, FormControl, Input, InputLabel, Stack, TextField } from "@mui/material";
import { Set } from "immutable";

export function ProjectForm({ init, forbidNames, onArchive, onSubmit }: {
    init?: Doc<'projects'>;
    forbidNames: Set<string>;
    onArchive?: () => Promise<unknown>;
    onSubmit: (_: { name: string, color: string }) => Promise<unknown>;
}) {
    const [name, nameF, setNameF] = useParsed(init?.name ?? '', useCallback(nameF => {
        const name = nameF.trim();
        if (name === "") return { type: 'err', message: "Name is required" };
        if (forbidNames.has(name)) return { type: 'err', message: "Project with this name already exists" };
        return { type: 'ok', value: name }
    }, [forbidNames]));

    const [color, colorF, setColorF] = useParsed(init?.color ?? '', useCallback(colorF => ({ type: 'ok', value: colorF }), []));

    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && name.type === 'ok'
        && color.type === 'ok';

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        watchReqStatus(setReq, onSubmit({ name: name.value, color: color.value }));
    }}>
        <Stack direction="column">
            <TextField
                label="Project name"
                error={name.type === 'err'}
                sx={{ mt: 1 }}
                fullWidth
                autoFocus
                type="text"
                value={nameF}
                onChange={(e) => { setNameF(e.target.value); }}
            />

            <FormControl sx={{ mt: 4 }}>
                <InputLabel>Color</InputLabel>
                <Input
                    type="color"
                    sx={{ minWidth: "5em", mr: 'auto' }}
                    value={colorF}
                    onChange={(e) => { setColorF(e.target.value); }}
                />
            </FormControl>

            <Stack direction="row" spacing={2} sx={{ ml: 'auto' }}>
                {init && onArchive && <Button variant="outlined" color="warning" sx={{ ml: 'auto', py: 1 }} onClick={() => {
                    watchReqStatus(setReq, onArchive());
                }}>Archive Project</Button>}

                <Button sx={{ mt: 2, py: 1 }} variant="contained"
                    disabled={!canSubmit}
                    type="submit"
                >
                    {init ? "Save" : "Create"}
                </Button>
            </Stack>
        </Stack>
    </form>;
}
