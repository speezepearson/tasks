import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, watchReqStatus } from "../common";
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, TextField } from "@mui/material";

export function EditTaskModal({ task, projectsById, onHide }: {
    task: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onHide: () => unknown;
}) {
    const update = useMutation(api.tasks.update);

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);

    const [newText, setNewText] = useState(task.text);
    const [newProjectId, setNewProjectId] = useState(task.project);

    const [saveReq, setSaveReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (saveReq.type === 'error') alert(saveReq.message);
    }, [saveReq]);

    const doSave = () => { watchReqStatus(setSaveReq, update({ id: task._id, text: newText, project: newProjectId }).then(onHide)).catch(console.error); };

    return <Dialog open onClose={onHide} fullWidth PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave(); },
    }}>
        <DialogTitle>Edit task</DialogTitle>
        <DialogContent>
            <FormControl fullWidth>
                <TextField autoFocus margin="normal" label="Task text" type="text" value={newText} onChange={(e) => { setNewText(e.target.value); }} />
                <FormHelperText>You can use markdown here.</FormHelperText>
            </FormControl>

            <Autocomplete
                sx={{ mt: 4 }}
                options={projectsByName.entrySeq()
                    .sortBy(([name]) => name)
                    .map((([name]) => name))
                    .toList()
                    .toArray()}
                renderInput={(params) => <TextField {...params} label="Project" />}
                value={newProjectId ? projectsById.get(newProjectId)!.name : null}
                onChange={(_, projectName) => { setNewProjectId(projectName ? projectsByName.get(projectName)!._id : undefined); }} />
        </DialogContent>

        <DialogActions>
            <Button variant="outlined" onClick={onHide}>
                Close
            </Button>

            <Button variant="contained" type="submit">
                {saveReq.type === 'working' ? 'Saving...' : 'Save'}
            </Button>
        </DialogActions>
    </Dialog>;
}
