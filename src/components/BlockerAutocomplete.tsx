import { useMemo } from "react";
import { List } from "immutable";
import { Doc } from "../../convex/_generated/dataModel";
import { Autocomplete, AutocompleteProps, TextField, Typography } from "@mui/material";


export function BlockerAutocomplete({ value, onChange, options, label = 'Blocked on tasks...', ...props }: {
    options: List<Doc<'tasks'>>;
    value: List<Doc<'tasks'> | string>;
    onChange: (value: List<Doc<'tasks'> | string>) => void;
    label?: string;
} & Omit<AutocompleteProps<Doc<'tasks'>, true, false, true>, 'options' | 'value' | 'onChange' | 'label' | 'renderInput' | 'renderOption' | 'getOptionLabel'>) {
    const optionsArr = useMemo(() => options.toArray(), [options]);
    const valueArr = useMemo(() => value.toArray(), [value]);

    return <Autocomplete
        {...props}
        multiple
        freeSolo
        fullWidth
        // PaperComponent={({ children, ...props }) => <Box {...props} sx={{ bgcolor: 'white', border: 1, opacity: 0.8, }}>{children}</Box>}
        autoFocus
        blurOnSelect={false}
        options={optionsArr}
        value={valueArr}
        onChange={(_, newValue) => { onChange(List(newValue)); }}

        isOptionEqualToValue={(option, value) => {
            if (typeof option === 'string' || typeof value === 'string') return option === value;
            return option._id === value._id;
        }}
        renderInput={(params) => <TextField {...params} label={label} sx={{ mt: 1 }} />}
        renderOption={(props, blocker) => <li {...props}><Typography noWrap>{typeof blocker === 'string' ? blocker : blocker.text}</Typography></li>}
        getOptionLabel={(blocker) => typeof blocker === 'string' ? blocker : blocker.text}
        getOptionKey={(blocker) => typeof blocker === 'string' ? blocker : blocker._id} />;
}
