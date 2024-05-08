import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { Result, randomProjectColor, useLoudRequestStatus, watchReqStatus } from "../common";
import Button from "@mui/material/Button";
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Input, InputLabel, TextField } from "@mui/material";
import { Doc } from "../../convex/_generated/dataModel";
import { List } from "immutable";

export function CreateProjectModal({ onHide, existingProjects }: { onHide: () => void, existingProjects: List<Doc<'projects'>> }) {
    const create = useMutation(api.projects.create);

    const [nameF, setNameF] = useState("");
    const [colorF, setColorF] = useState(randomProjectColor());

    const [req, setReq] = useLoudRequestStatus();

    const name: Result<string> = useMemo(
        () => {
            if (nameF.trim() === "") return { type: 'err', message: "Name is required" };
            if (existingProjects.find(p => p.name === nameF)) return { type: 'err', message: "Project with this name already exists" };
            return { type: 'ok', value: nameF }
        }, [nameF, existingProjects]);
    const color: Result<string> = { type: 'ok', value: colorF };
    const canSubmit = req.type !== 'working'
        && name.type === 'ok'
        && color.type === 'ok'; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

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
