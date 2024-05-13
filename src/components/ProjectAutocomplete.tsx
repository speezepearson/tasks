import Autocomplete from "@mui/material/Autocomplete/Autocomplete";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { Map } from "immutable";
import { TextField } from "@mui/material";

export function ProjectAutocomplete({ projectsById, value, onChange, onValid, disabled }: {
    value: Doc<'projects'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    onChange: (p: Doc<'projects'>) => void;
    onValid: (valid: boolean) => void;
    disabled?: boolean;
}) {
    const [inputValue, setInputValue] = useState(value.name);

    const projectsByName = projectsById.mapEntries(([, p]) => [p.name, p])
    const [lastValidProject, setLastValidProject] = useState(value);
    const curProject = projectsByName.get(inputValue);
    useEffect(() => {
        if (curProject !== undefined) {
            onChange(curProject);
            setLastValidProject(curProject);
            onValid(true);
        } else {
            onValid(false);
        }
    }, [curProject, onChange, onValid]);

    const options = useMemo(() =>
        projectsByName.valueSeq()
            .sortBy((p) => p.name)
            .toArray(),
        [projectsByName],
    );

    return <Autocomplete
        options={options}
        disabled={disabled}

        value={lastValidProject}
        onChange={(_, newValue) => {
            onChange(newValue);
            setLastValidProject(newValue);
        }}

        disableClearable
        inputValue={inputValue}
        onInputChange={(_, newInputValue) => { setInputValue(newInputValue) }}

        renderInput={(params) => <TextField {...params} label="Project" error={!curProject} />}
        renderOption={(props, option) => <li {...props}>{option.name}</li>}
        getOptionLabel={(project) => typeof project === 'string' ? project : project.name}
        getOptionKey={(option) => option._id}
    />

}