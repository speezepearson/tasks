import { Autocomplete, TextField } from "@mui/material";
import { useQuery } from "convex/react";
import { List, Set } from "immutable";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";

export function TagAutocomplete({ value, onChange, disabled }: {
    value: List<string>;
    onChange: (value: List<string>) => void;
    disabled?: boolean;
}) {
    const rawTags = useQuery(api.tasks.listTags);
    const options = useMemo(() => rawTags && Set(rawTags).sort().toArray(), [rawTags]);

    const valueArr = useMemo(() => value.toArray(), [value]);

    return <Autocomplete
        disabled={disabled}
        multiple
        freeSolo
        options={options ?? []}
        renderInput={(params) => <TextField {...params} label="Tags"
            multiline rows={1} // hack to make Enter work for creating new tags on Android/Chrome: https://github.com/mui/material-ui/issues/29429
        />}
        value={valueArr}
        blurOnSelect={false}
        onChange={(_, newValue) => { onChange(List(newValue)); }}
    />
}
