import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Result, must, useLoudRequestStatus, watchReqStatus } from "../common";
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

    const [textF, setTextF] = useState(delegation.text);
    const [timeoutF, setTimeoutF] = useState(formatDate(delegation.timeoutMillis, 'yyyy-MM-dd'));
    const [projectNameF, setProjectNameF] = useState<string | null>(delegation.project ? must(projectsById.get(delegation.project), "delegation's project does not actually exist").name : null);
    // This field isn't "really" used -- it's whatever the user's typed in the autocomplete field.
    // If they have "unsaved" changes (i.e. they've typed since they selected), we disable submit:
    // it feels kinda janky to be able to submit when you've typed a garbage project name.
    const [projectNameScratchF, setProjectNameScratchF] = useState('');

    const [saveReq, setSaveReq] = useLoudRequestStatus();

    const newText: Result<string> = useMemo(() =>
        textF.trim() === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF },
        [textF],
    );
    const newTimeoutMillis: Result<number> = useMemo(() => {
        const millis = parseISOMillis(timeoutF);
        return millis === undefined
            ? { type: 'err', message: "Invalid date" }
            : { type: 'ok', value: millis };
    }, [timeoutF]);
    const newProjectId: Result<Id<'projects'> | undefined> = useMemo(() => {
        if (projectNameF === null || projectNameF == '') return { type: 'ok', value: undefined };
        const project = projectsByName.get(projectNameF);
        if (project === undefined) return { type: 'err', message: "Project not found" };
        return { type: 'ok', value: project._id };
    }, [projectNameF, projectsByName]);
    // don't check whether timeoutMillis is in the future, because we're editing an existing delegation, which might have already timed out
    const canSubmit = saveReq.type !== 'working'
        && newText.type === 'ok'
        && newTimeoutMillis.type === 'ok'
        && newProjectId.type === 'ok'
        && projectNameScratchF === (projectNameF ?? '');

    const doSave = () => {
        if (!canSubmit) return;
        watchReqStatus(setSaveReq, (async () => {
            await update({ id: delegation._id, text: newText.value, timeoutMillis: newTimeoutMillis.value, project: newProjectId.value });
            onHide();
        })());
    };

    return <Dialog open fullWidth onClose={onHide} PaperProps={{
        component: 'form',
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); doSave(); },
    }}>
        <DialogTitle>Edit delegation</DialogTitle>
        <DialogContent>
            <TextField
                label="Text"
                error={newText.type === 'err'}
                sx={{ mt: 1 }}
                fullWidth
                autoFocus
                type="text"
                value={textF}
                onChange={(e) => { setTextF(e.target.value); }}
            />
            <FormHelperText>You can use markdown here.</FormHelperText>

            <TextField
                label="Timeout"
                error={newTimeoutMillis.type === 'err'}
                sx={{ mt: 4 }}
                fullWidth
                type="date"
                value={timeoutF}
                onChange={(e) => { setTimeoutF(e.target.value) }} />

            <Autocomplete
                sx={{ mt: 4 }}
                options={projectsByName.entrySeq()
                    .sortBy(([name]) => name)
                    .map((([name]) => name))
                    .toList()
                    .toArray()}
                renderInput={(params) => <TextField {...params} label="Project" error={newProjectId.type === 'err'} />}
                value={projectNameF}
                onChange={(_, name) => { setProjectNameF(name) }}
                inputValue={projectNameScratchF}
                onInputChange={(_, name) => { setProjectNameScratchF(name) }}
            />
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
