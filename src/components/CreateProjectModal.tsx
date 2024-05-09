import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback } from "react";
import { randomProjectColor, useLoudRequestStatus, useParsed, watchReqStatus } from "../common";
import Button from "@mui/material/Button";
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Input, InputLabel, TextField } from "@mui/material";
import { Doc } from "../../convex/_generated/dataModel";
import { List } from "immutable";

export function CreateProjectModal({ onHide, existingProjects }: { onHide: () => void, existingProjects: List<Doc<'projects'>> }) {
    const create = useMutation(api.projects.create);

    const [name, nameF, setNameF] = useParsed("" as string, useCallback(nameF => {
        const name = nameF.trim();
        if (name === "") return { type: 'err', message: "Name is required" };
        if (existingProjects.find(p => p.name === name)) return { type: 'err', message: "Project with this name already exists" };
        return { type: 'ok', value: name }
    }, [existingProjects]));

    const [color, colorF, setColorF] = useParsed(randomProjectColor(), useCallback(colorF => ({ type: 'ok', value: colorF }), []));

    const [req, setReq] = useLoudRequestStatus();

    const canSubmit = req.type !== 'working'
        && name.type === 'ok'
        && color.type === 'ok';

    const doSave = () => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await create({ name: name.value, color: color.value });
            onHide();
            setColorF(randomProjectColor());
        })());
    }

    return <Dialog open fullWidth onClose={onHide} PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave() },
    }}
        disableRestoreFocus // HACK: autofocus doesn't work without this: https://github.com/mui/material-ui/issues/33004
    >
        <DialogTitle>Create project</DialogTitle>
        <DialogContent>
            <TextField
                label="Project name"
                sx={{ mt: 1 }}
                error={name.type === 'err'}
                fullWidth
                autoFocus
                type="text"
                value={nameF}
                onChange={(e) => { setNameF(e.target.value) }}
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
        </DialogContent >

        <DialogActions>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>

            <Button variant="contained" type="submit" disabled={!canSubmit}>
                {req.type === 'working' ? 'Creating...' : 'Create project'}
            </Button>
        </DialogActions>
    </Dialog>;
}
