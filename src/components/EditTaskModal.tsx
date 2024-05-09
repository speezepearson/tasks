import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, TextField } from "@mui/material";
import { useMutation } from "convex/react";
import { Map } from "immutable";
import { useCallback, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, useParsed, watchReqStatus } from "../common";

export function EditTaskModal({ task, projectsById, onHide }: {
    task: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onHide: () => unknown;
}) {
    const update = useMutation(api.tasks.update);

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);

    const [text, textF, setTextF] = useParsed(task.text, useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [projectId, projectNameF, setProjectNameF] = useParsed(task.project ? must(projectsById.get(task.project), "task's project does not actually exist").name : null, useCallback((projectNameF: string | null) => {
        if (projectNameF === null || projectNameF == '') return { type: 'ok', value: undefined };
        const project = projectsByName.get(projectNameF);
        if (project === undefined) return { type: 'err', message: "Project not found" };
        return { type: 'ok', value: project._id };
    }, [projectsByName]));

    // This field isn't "really" used -- it's whatever the user's typed in the autocomplete field.
    // If they have "unsaved" changes (i.e. they've typed since they selected), we disable submit:
    // it feels kinda janky to be able to submit when you've typed a garbage project name.
    const [projectNameScratchF, setProjectNameScratchF] = useState('');

    const [saveReq, setSaveReq] = useLoudRequestStatus();

    const canSubmit = saveReq.type !== 'working'
        && text.type === 'ok'
        && projectId.type === 'ok'
        && projectNameScratchF === (projectNameF ?? '');

    const projectAutocompleteOptions = useMemo(() =>
        projectsByName.entrySeq()
            .sortBy(([name]) => name)
            .map((([name]) => name))
            .toList()
            .toArray(),
        [projectsByName],
    );

    const doSave = () => {
        if (!canSubmit) return;
        watchReqStatus(setSaveReq, (async () => {
            await update({ id: task._id, text: text.value, project: projectId.value });
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
                    error={text.type === 'err'}
                    sx={{ mt: 1 }}
                    autoFocus
                    type="text"
                    value={textF}
                    onChange={(e) => { setTextF(e.target.value); }}
                />
                <FormHelperText>You can use markdown here.</FormHelperText>
            </FormControl>

            <Autocomplete
                sx={{ mt: 4 }}
                options={projectAutocompleteOptions}
                renderInput={(params) => <TextField {...params} label="Project" error={projectId.type === 'err'} />}
                value={projectNameF}
                onChange={(_, projectName) => { setProjectNameF(projectName) }}
                inputValue={projectNameScratchF}
                onInputChange={(_, projectName) => { setProjectNameScratchF(projectName) }}
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
