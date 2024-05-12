import { useCallback, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, must, useMiscProject, useParsed, watchReqStatus } from "../common";
import { Box, Button, FormControl, FormHelperText, Stack, TextField } from "@mui/material";
import { Map } from "immutable";
import { ProjectAutocomplete } from "./ProjectAutocomplete";

export function TaskForm({ init, initProject, projectsById, onSubmit }: {
    init?: Doc<'tasks'>;
    initProject?: Doc<'projects'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'tasks'>, 'text' | 'project'>) => Promise<unknown>;
}) {

    const miscProject = useMiscProject(projectsById);
    const [project, setProject] = useState(initProject ?? (init?.project
        ? must(projectsById.get(init.project), "task's project does not actually exist")
        : miscProject));
    const [projectFieldValid, setProjectFieldValid] = useState(true);

    const [text, textF, setTextF] = useParsed(init?.text ?? "", useCallback(textF => {
        const text = textF.trim();
        return text === ""
            ? { type: 'err', message: "Text is required" }
            : { type: 'ok', value: textF };
    }, []));

    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });

    const canSubmit = req.type !== 'working'
        && text.type === 'ok'
        && projectFieldValid;

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        watchReqStatus(setReq, onSubmit({ text: text.value, project: project._id }).then(() => {
            if (!init) {
                setTextF("");
            }
        }));
    }}>
        <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
            <FormControl>
                <TextField
                    label="Text"
                    autoFocus
                    multiline maxRows={6}
                    // no error={!!textErr} because the necessity is obvious
                    disabled={req.type === 'working'}
                    value={textF}
                    onChange={(e) => { setTextF(e.target.value); }}
                />
                <FormHelperText>You can use markdown here.</FormHelperText>
            </FormControl>

            <ProjectAutocomplete
                value={project}
                projectsById={projectsById}
                onChange={setProject}
                onValid={setProjectFieldValid}
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
