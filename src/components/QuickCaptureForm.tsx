import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useRef } from "react";
import { CreateTaskForm, CreateTaskFormProps } from "./TaskForm";
import { useMapify } from "../common";
import Box from "@mui/material/Box/Box";

export function QuickCaptureForm(props: Omit<CreateTaskFormProps, 'projectsById'>) {
    const projectsById = useMapify(useQuery(api.projects.list), '_id');

    const ref = useRef<HTMLDivElement>(null);
    const refocus = useCallback(() => {
        setTimeout(() => {
            const input = ref.current?.querySelector('input,textarea') as HTMLInputElement | HTMLTextAreaElement | null;
            input?.focus()
        }, 0)
    }, [ref]);

    useEffect(refocus, [refocus])

    return <Box ref={ref}><CreateTaskForm
        projectsById={projectsById}
        {...props}
    /></Box>
}