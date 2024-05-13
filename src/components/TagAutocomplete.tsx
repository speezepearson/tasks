import { Autocomplete, TextField } from "@mui/material";
import { useQuery } from "convex/react";
import { List, Set } from "immutable";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";

export function TagAutocomplete({ value, onChange }: {
    value: List<string>;
    onChange: (value: List<string>) => void;
}) {
    const rawTags = useQuery(api.tasks.listTags);
    const options = useMemo(() => rawTags && Set(rawTags).sort().toArray(), [rawTags]);

    const valueArr = useMemo(() => value.toArray(), [value]);

    return <Autocomplete
        multiple
        freeSolo
        options={options ?? []}
        renderInput={(params) => <TextField {...params} label="Tags" />}
        value={valueArr}
        blurOnSelect={false}
        onChange={(_, newValue) => { onChange(List(newValue)); }}
    />
}
