import { useCallback, useEffect, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, must, useMiscProject, useParsed, watchReqStatus } from "../common";
import { Box, Button, FormControl, FormHelperText, Stack, TextField } from "@mui/material";
import { List, Map, Set } from "immutable";
import { ProjectAutocomplete } from "./ProjectAutocomplete";
import { TagAutocomplete } from "./TagAutocomplete";

export function TaskForm({ init, initProject, projectsById, onSubmit }: {
    init?: Doc<'tasks'>;
    initProject?: Doc<'projects'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onSubmit: (args: Pick<Doc<'tasks'>, 'text' | 'project' | 'tags'>) => Promise<unknown>;
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

    const [tags, setTags] = useState(List(init?.tags ?? []))

    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });

    const canSubmit = req.type !== 'working'
        && text.type === 'ok'
        && projectFieldValid;

    const submit = useCallback(() => {
        if (!canSubmit) return;
        watchReqStatus(setReq, onSubmit({ text: text.value, project: project._id, tags: List(tags).sort().toArray() }));
    }, [canSubmit, text, project, tags, onSubmit]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        submit();
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
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />
                <FormHelperText>You can use markdown here.</FormHelperText>
            </FormControl>

            <ProjectAutocomplete
                value={project}
                projectsById={projectsById}
                onChange={setProject}
                onValid={setProjectFieldValid}
            />

            <TagAutocomplete
                value={tags}
                onChange={setTags}
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
