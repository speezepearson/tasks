import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { Doc } from "../../convex/_generated/dataModel";
import { Result, useLoudRequestStatus, watchReqStatus } from "../common";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Input, InputLabel, TextField } from "@mui/material";
import { List } from "immutable";

export function EditProjectModal({ project, existingProjects, onHide }: {
    project: Doc<'projects'>;
    existingProjects: List<Doc<'projects'>>;
    onHide: () => unknown;
}) {
    const archive = useMutation(api.projects.archive);
    const update = useMutation(api.projects.update);

    const [nameF, setNameF] = useState(project.name);
    const [colorF, setColorF] = useState(project.color ?? '');

    const [req, setReq] = useLoudRequestStatus();

    const name: Result<string> = useMemo(() => {
        const name = nameF.trim();
        if (name === "") return { type: 'err', message: "Name is required" };
        if (existingProjects.find(p => p.name === name)) return { type: 'err', message: "Project with this name already exists" };
        return { type: 'ok', value: name }
    }, [nameF, existingProjects]);
    const color: Result<string> = useMemo(() =>
        ({ type: 'ok', value: colorF }),
        [colorF],
    );
    const canSubmit = req.type !== 'working'
        && name.type === 'ok'
        && color.type === 'ok'; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

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
