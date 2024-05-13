import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, Tab, Box } from "@mui/material";
import { TaskForm } from "./TaskForm";
import { DelegationForm } from "./DelegationForm";
import { CaptureForm } from "./CaptureForm";
import { useMapify } from "../common";

export function QuickCaptureForm() {
    const projectsById = useMapify(useQuery(api.projects.list), '_id');

    const createCapture = useMutation(api.captures.create);
    const createTask = useMutation(api.tasks.create);
    const createDelegation = useMutation(api.delegations.create);

    const activeContentRef = useRef<HTMLDivElement>(null);
    const refocus = useCallback(() => {
        setTimeout(() => {
            activeContentRef.current?.querySelector('input')?.focus()
        }, 0)
    }, [activeContentRef]);

    useEffect(refocus, [refocus])

    const [showTab, setShowTab] = useState(0)
    const tabContents = useMemo(
        () => [
            {
                name: "Quick Capture",
                content: <CaptureForm
                    onSubmit={args => createCapture(args).then(refocus)}
                />,
            },
            {
                name: "Task",
                content: <TaskForm
                    projectsById={projectsById}
                    onSubmit={args => createTask(args).then(refocus)}
                />,
            },
            {
                name: "Delegation",
                content: <DelegationForm
                    projectsById={projectsById}
                    onSubmit={args => createDelegation(args).then(refocus)}
                />,
            },
        ],
        [createCapture, createTask, createDelegation, projectsById, refocus]);

    return <>
        <Tabs value={showTab} onChange={(_, newValue) => { setShowTab(newValue as number) }}>
            {tabContents.map((tab, index) => (
                <Tab key={index} label={tab.name} />
            ))}
        </Tabs>
        <Box ref={activeContentRef}>
            {tabContents[showTab].content}
        </Box>
    </>
}