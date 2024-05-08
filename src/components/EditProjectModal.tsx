import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Doc } from "../../convex/_generated/dataModel";
import { useLoudRequestStatus, watchReqStatus } from "../common";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Input, InputLabel, TextField } from "@mui/material";

export function EditProjectModal({ project, onHide }: {
    project: Doc<'projects'>;
    onHide: () => unknown;
}) {
    const update = useMutation(api.projects.update);

    const [newName, setNewName] = useState(project.name);
    const [newColor, setNewColor] = useState(project.color);

    const [saveReq, setSaveReq] = useLoudRequestStatus();

    const nameErr = newName.trim() === "" ? "Name is required" : "";
    const canSubmit = saveReq.type !== 'working'
        && nameErr === "";

    const doSave = () => {
        if (!canSubmit) return;
        watchReqStatus(setSaveReq, (async () => {
            await update({ id: project._id, name: newName, color: newColor })
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
                error={!!nameErr}
                sx={{ mt: 1 }}
                fullWidth
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); }}
            />

            <FormControl sx={{ mt: 4 }}>
                <InputLabel>Color</InputLabel>
                <Input
                    type="color"
                    sx={{ minWidth: "5em" }}
                    value={newColor}
                    onChange={(e) => { setNewColor(e.target.value); }}
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
