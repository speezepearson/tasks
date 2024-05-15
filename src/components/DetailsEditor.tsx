import { useState } from "react";
import { Box, Stack, TextField, TextFieldProps } from "@mui/material";
import SubjectIcon from "@mui/icons-material/Subject";
import { Markdown } from "./Markdown";

export function DetailsEditor({ value, onChange, ...props }: { value: string; onChange: (value: string) => void; } & Omit<TextFieldProps, 'value' | 'onChange'>) {
    const [show, setShow] = useState(false);
    return show
        ? <TextField
            {...props}
            label="Details"
            autoFocus
            sx={{ mt: 5 }}
            InputLabelProps={{ shrink: true }}
            multiline minRows={2} maxRows={6}
            value={value}
            onChange={(e) => { onChange(e.target.value); }}
            onBlur={() => { setShow(false); }}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setShow(false);
                }
            }} />
        : <Box onClick={(e) => { if (!(e.target instanceof HTMLAnchorElement)) setShow(true); }}>
            <Stack sx={{ pl: 2 }} direction="row" spacing={1} alignItems="top" color="GrayText">
                <SubjectIcon fontSize="small" />
                <Box sx={{ fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
                    <Markdown>{value !== '' ? value : "Details..."}</Markdown>
                </Box>
            </Stack>
        </Box>;
}
