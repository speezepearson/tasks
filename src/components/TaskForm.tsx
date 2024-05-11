import { useCallback, useMemo, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, must, useParsed, watchReqStatus } from "../common";
import { Autocomplete, Box, Button, Stack, TextField } from "@mui/material";
import { Map } from "immutable";

export function TaskForm({ init, initProject, projectsById, onSubmit }: {
    init?: Doc<'tasks'>;
    initProject?: Doc<'projects'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'tasks'>, 'text' | 'project'>) => Promise<unknown>;
}) {

    const projectsByName = useMemo(() => projectsById.mapEntries(([, project]) => [project.name, project]), [projectsById]);
    initProject ??= init?.project
        ? must(projectsById.get(init.project), "task's project does not actually exist")
        : must(projectsByName.get('Misc'), 'must have a misc project');

    const [text, textF, setTextF] = useParsed(init?.text ?? "", useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [projectId, projectNameF, setProjectNameF] = useParsed(initProject.name as string | null, useCallback((projectNameF: string | null) => {
        if (projectNameF === null || projectNameF == '') return { type: 'err', message: 'Project is required' };
        const project = projectsByName.get(projectNameF);
        if (project === undefined) return { type: 'err', message: "Project not found" };
        return { type: 'ok', value: project._id };
    }, [projectsByName]));

    // This field isn't "really" used -- it's whatever the user's typed in the autocomplete field.
    // If they have "unsaved" changes (i.e. they've typed since they selected), we disable submit:
    // it feels kinda janky to be able to submit when you've typed a garbage project name.
    const [projectNameScratchF, setProjectNameScratchF] = useState(initProject.name);

    const projectAutocompleteOptions = useMemo(() =>
        projectsByName.entrySeq()
            .sortBy(([name]) => name)
            .map((([name]) => name))
            .toList()
            .toArray(),
        [projectsByName],
    );

    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });

    const canSubmit = req.type !== 'working'
        && text.type === 'ok'
        && projectId.type === 'ok'
        && projectNameScratchF === (projectNameF ?? '');

    const doSave = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, onSubmit({ text: text.value, project: projectId.value }));
    }, [canSubmit, text, projectId, setReq, onSubmit]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        doSave();
    }}>
        <Stack direction="column">
            <TextField
                label="New text"
                autoFocus
                // no error={!!textErr} because the necessity is obvious
                sx={{ mt: 1 }}
                disabled={req.type === 'working'}
                value={textF}
                onChange={(e) => { setTextF(e.target.value); }}
            />

            <Autocomplete
                sx={{ mt: 4 }}
                options={projectAutocompleteOptions}
                renderInput={(params) => <TextField {...params} label="Project" error={projectId.type === 'err'} />}
                value={projectNameF}
                onChange={(_, projectName) => { setProjectNameF(projectName) }}
                inputValue={projectNameScratchF}
                onInputChange={(_, projectName) => { setProjectNameScratchF(projectName) }}
            />

            <Box sx={{ ml: 'auto' }}><Button sx={{ mt: 2, py: 1 }} variant="contained"
                disabled={!canSubmit}
                type="submit"
            >
                {init ? "Save" : "Create"}
            </Button></Box>
        </Stack>
    </form>;
}
