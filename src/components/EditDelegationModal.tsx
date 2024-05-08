import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, watchReqStatus } from "../common";
import { formatDate } from "date-fns";
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormHelperText, TextField } from "@mui/material";
import { parseISOMillis } from "../common";

export function EditDelegationModal({ delegation, projectsById, onHide }: {
    delegation: Doc<'delegations'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onHide: () => unknown;
}) {
    const update = useMutation(api.delegations.update);

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);

    const [newText, setNewText] = useState(delegation.text);
    const [newTimeoutMillis, setNewTimeoutMillis] = useState(delegation.timeoutMillis);
    const [newProjectId, setNewProjectId] = useState(delegation.project);

    const [saveReq, setSaveReq] = useLoudRequestStatus();

    const doSave = () => {
        watchReqStatus(setSaveReq, (async () => {
            await update({ id: delegation._id, text: newText, timeoutMillis: newTimeoutMillis, project: newProjectId });
            onHide();
        })());
    };

    return <Dialog open fullWidth onClose={onHide} PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave(); },
    }}>
        <DialogTitle>Edit delegation</DialogTitle>
        <DialogContent>
            <TextField fullWidth autoFocus margin="normal" label="Text" type="text" value={newText} onChange={(e) => { setNewText(e.target.value); }} />
            <FormHelperText>You can use markdown here.</FormHelperText>

            <TextField sx={{ mt: 4 }} fullWidth margin="normal" label="Timeout"
                type="date"
                value={formatDate(newTimeoutMillis, 'yyyy-MM-dd')}
                onChange={(e) => {
                    const timeoutMillis = parseISOMillis(e.target.value);
                    if (timeoutMillis !== undefined) setNewTimeoutMillis(timeoutMillis);
                }} />

            <Autocomplete
                sx={{ mt: 4 }}
                options={projectsByName.entrySeq()
                    .sortBy(([name]) => name)
                    .map((([name]) => name))
                    .toList()
                    .toArray()}
                renderInput={(params) => <TextField {...params} label="Project" />}
                value={newProjectId ? must(projectsById.get(newProjectId), "user selected nonexistent Project option in autocomplete").name : null}
                onChange={(_, projectName) => { setNewProjectId(projectName ? must(projectsByName.get(projectName), "user selected nonexistent Project option in autocomplete")._id : undefined); }} />
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
