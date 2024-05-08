import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { Doc } from "../../convex/_generated/dataModel";
import { Result, useLoudRequestStatus, watchReqStatus } from "../common";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Input, InputLabel, TextField } from "@mui/material";

export function EditProjectModal({ project, onHide }: {
    project: Doc<'projects'>;
    onHide: () => unknown;
}) {
    const update = useMutation(api.projects.update);

    const [nameF, setNameF] = useState(project.name);
    const [colorF, setColorF] = useState(project.color ?? '');

    const [saveReq, setSaveReq] = useLoudRequestStatus();


    const name: Result<string> = useMemo(() =>
        nameF.trim() === ""
            ? { type: 'err', message: "Name is required" }
            : { type: 'ok', value: nameF },
        [nameF],
    );
    const color: Result<string> = useMemo(() =>
        ({ type: 'ok', value: colorF }),
        [colorF],
    );
    const canSubmit = saveReq.type !== 'working'
        && name.type === 'ok'
        && color.type === 'ok'; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    const doSave = () => {
        if (!canSubmit) return;
        watchReqStatus(setSaveReq, (async () => {
            await update({ id: project._id, name: name.value, color: color.value })
            onHide();
        })())
    };

    return <Dialog open fullWidth onClose={onHide} PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave(); },
    }}>
        <DialogTitle>Edit project</DialogTitle>
        <DialogContent>
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
                    sx={{ minWidth: "5em" }}
                    value={colorF}
                    onChange={(e) => { setColorF(e.target.value); }}
                />
            </FormControl>
        </DialogContent>

        <DialogActions>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>

            <Button variant="contained" type="submit" disabled={!canSubmit}>
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </DialogActions>
    </Dialog>;
}
