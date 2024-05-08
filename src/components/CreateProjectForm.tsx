import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { useLoudRequestStatus, watchReqStatus } from "../common";
import Button from "@mui/material/Button";
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, TextField } from "@mui/material";

export function CreateProjectForm() {
    const create = useMutation(api.projects.create);
    const [showModal, setShowModal] = useState(false);

    const [name, setName] = useState("");
    const [color, setColor] = useState(randomLightColor);

    const [req, setReq] = useLoudRequestStatus();

    const doSave = () => {
        watchReqStatus(setReq, (async () => {
            await create({ name: name, color: color });
            setShowModal(false);
            setColor(randomLightColor());
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
                <TextField margin="normal" fullWidth autoFocus label="Project name" type="text" value={name} onChange={(e) => { setName(e.target.value) }} />

                <FormControl sx={{ mt: 4 }}>
                    <InputLabel>Color</InputLabel>
                    <TextField
                        type="color"
                        margin="normal"
                        sx={{ minWidth: "5em" }}
                        value={color}
                        onChange={(e) => { setColor(e.target.value) }}
                    />
                </FormControl>
            </DialogContent >

            <DialogActions>
                <Button variant="outlined" onClick={() => { setShowModal(false) }}>
                    Close
                </Button>

                <Button variant="contained" type="submit">
                    {req.type === 'working' ? 'Creating...' : 'Create project'}
                </Button>
            </DialogActions>
        </Dialog>}
        <Button variant="contained" size="small" onClick={() => { setShowModal(true) }}>+project</Button>
    </>;
}

function randomLightColor() {
    const r = Math.floor(0xb0 + Math.random() * 0x50);
    const g = Math.floor(0xb0 + Math.random() * 0x50);
    const b = Math.floor(0xb0 + Math.random() * 0x50);
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}
