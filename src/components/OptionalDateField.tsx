import { formatDate } from "date-fns";
import { useEffect, useState } from "react";
import { parseISOMillis } from "../common";
import TextField, { TextFieldProps } from "@mui/material/TextField/TextField";

export function OptionalDateField({ value, onChange, ...props }: {
    value: number | undefined;
    onChange: (value: number | undefined) => void;
} & Omit<TextFieldProps, 'value' | 'onChange'>) {
    const [textF, setTextF] = useState('');
    useEffect(() => {
        setTextF(value ? formatDate(value, 'yyyy-MM-dd') : '');
    }, [value]);
    useEffect(() => { onChange(parseISOMillis(textF)) }, [textF, onChange]);

    return <TextField
        {...props}
        fullWidth
        type="date"
        value={textF}
        onChange={(e) => { setTextF(e.target.value) }}
    />
}