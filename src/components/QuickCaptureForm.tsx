import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useRef } from "react";
import { TaskForm } from "./TaskForm";
import { useMapify } from "../common";
import Box from "@mui/material/Box/Box";

export function QuickCaptureForm() {
    const projectsById = useMapify(useQuery(api.projects.list), '_id');

    const createTask = useMutation(api.tasks.create);

    const ref = useRef<HTMLDivElement>(null);
    const refocus = useCallback(() => {
        setTimeout(() => {
            const input = ref.current?.querySelector('input,textarea') as HTMLInputElement | HTMLTextAreaElement | null;
            input?.focus()
        }, 0)
    }, [ref]);

    useEffect(refocus, [refocus])

    return <Box ref={ref}><TaskForm
        projectsById={projectsById}
        onSubmit={args => createTask(args).then(refocus)}
    /></Box>
}