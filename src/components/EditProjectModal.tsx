import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback } from "react";
import { Doc } from "../../convex/_generated/dataModel";
import { useLoudRequestStatus, useParsed, watchReqStatus } from "../common";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Input, InputLabel, TextField } from "@mui/material";
import { List } from "immutable";

export function EditProjectModal({ project, existingProjects, onHide }: {
    project: Doc<'projects'>;
    existingProjects: List<Doc<'projects'>>;
    onHide: () => unknown;
}) {
    const archive = useMutation(api.projects.archive);
    const update = useMutation(api.projects.update);

    const [name, nameF, setNameF] = useParsed(project.name, useCallback(nameF => {
        const name = nameF.trim();
        if (name === "") return { type: 'err', message: "Name is required" };
        if (existingProjects.find(p => p.name === name)) return { type: 'err', message: "Project with this name already exists" };
        return { type: 'ok', value: name }
    }, [existingProjects]));

    const [color, colorF, setColorF] = useParsed(project.color ?? '', useCallback(colorF => ({ type: 'ok', value: colorF }), []));

    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && name.type === 'ok'
        && color.type === 'ok';

    const doSave = () => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
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
            <Button variant="outlined" color="warning" onClick={() => {
                watchReqStatus(setReq, archive({ id: project._id }));
                onHide();
            }}>Archive Project</Button>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>

            <Button variant="contained" type="submit" disabled={!canSubmit}>
                {req.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </DialogActions>
    </Dialog>;
}
