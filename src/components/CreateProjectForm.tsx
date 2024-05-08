import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { Result, useLoudRequestStatus, watchReqStatus } from "../common";
import Button from "@mui/material/Button";
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, TextField } from "@mui/material";

export function CreateProjectForm() {
    const create = useMutation(api.projects.create);
    const [showModal, setShowModal] = useState(false);

    const [nameF, setNameF] = useState("");
    const [colorF, setColorF] = useState(randomLightColor);

    const [req, setReq] = useLoudRequestStatus();

    const name: Result<string> = useMemo(() =>
        nameF.trim() === ""
            ? { type: 'err', message: "Name is required" }
            : { type: 'ok', value: nameF },
        [nameF],
    );
    const color: Result<string> = { type: 'ok', value: colorF };
    const canSubmit = req.type !== 'working'
        && name.type === 'ok'
        && color.type === 'ok'; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    const doSave = () => {
        if (!canSubmit) return;
        watchReqStatus(setReq, (async () => {
            await create({ name: name.value, color: color.value });
            setShowModal(false);
            setColorF(randomLightColor());
        })());
    }

    return <>
        {showModal && <Dialog open fullWidth onClose={() => { setShowModal(false) }} PaperProps={{
            component: 'form',
            onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave() },
        }}
            disableRestoreFocus // HACK: autofocus doesn't work without this: https://github.com/mui/material-ui/issues/33004
        >
            <DialogTitle>Edit project</DialogTitle>
            <DialogContent>
                <TextField
                    label="Project name"
                    error={name.type === 'err'}
                    fullWidth
                    autoFocus
                    type="text"
                    value={nameF}
                    onChange={(e) => { setNameF(e.target.value) }}
                />

                <FormControl sx={{ mt: 4 }}>
                    <InputLabel>Color</InputLabel>
                    <TextField
                        type="color"
                        sx={{ minWidth: "5em" }}
                        value={colorF}
                        onChange={(e) => { setColorF(e.target.value) }}
                    />
                </FormControl>
            </DialogContent >

            <DialogActions>
                <Button variant="outlined" onClick={() => { setShowModal(false) }}>
                    Close
                </Button>

                <Button variant="contained" type="submit" disabled={!canSubmit}>
                    {req.type === 'working' ? 'Creating...' : 'Create project'}
                </Button>
            </DialogActions>
        </Dialog>}
        <Button variant="contained" onClick={() => { setShowModal(true) }}>+project</Button>
    </>;
}

function randomLightColor() {
    const r = Math.floor(0xb0 + Math.random() * 0x50);
    const g = Math.floor(0xb0 + Math.random() * 0x50);
    const b = Math.floor(0xb0 + Math.random() * 0x50);
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}
