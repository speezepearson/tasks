import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, TextField } from "@mui/material";
import { useMutation } from "convex/react";
import { Map } from "immutable";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, watchReqStatus } from "../common";

export function EditTaskModal({ task, projectsById, onHide }: {
    task: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onHide: () => unknown;
}) {
    const update = useMutation(api.tasks.update);

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);

    const [newText, setNewText] = useState(task.text);
    const [newProjectId, setNewProjectId] = useState(task.project);

    const [saveReq, setSaveReq] = useLoudRequestStatus();

    const doSave = () => {
        watchReqStatus(setSaveReq, (async () => {
            await update({ id: task._id, text: newText, project: newProjectId });
            onHide();
        })());
    };

    return <Dialog open onClose={onHide} fullWidth PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave(); },
    }}>
        <DialogTitle>Edit task</DialogTitle>
        <DialogContent>
            <FormControl fullWidth>
                <TextField
                    label="Task text"
                    sx={{ mt: 1 }}
                    autoFocus
                    type="text"
                    value={newText}
                    onChange={(e) => { setNewText(e.target.value); }}
                />
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
                value={newProjectId ? must(projectsById.get(newProjectId), "user selected nonexistent Project option in autocomplete").name : null}
                onChange={(_, projectName) => {
                    setNewProjectId(projectName
                        ? must(projectsByName.get(projectName), "user selected nonexistent Project option in autocomplete")._id
                        : undefined);
                }}
            />
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
