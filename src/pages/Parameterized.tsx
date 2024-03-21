import { useMutation, useQuery } from "convex/react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useLocation } from "react-router-dom";

export interface Props {
    id: Id<'tasks'>;
}

export interface LinkState {
    task: Doc<'tasks'>;
}

export function Page({ id }: Props) {
    const taskQ = useQuery(api.tasks.get, { id });
    const locationState = useLocation().state as LinkState | undefined;
    const setCompleted = useMutation(api.tasks.setCompleted);

    const task = taskQ ?? locationState?.task;

    if (task === undefined) {
        return <div>Loading...</div>
    }

    return (
        <div>
            <input type="checkbox" onChange={(e) => { setCompleted({ id, isCompleted: e.target.checked }).catch(console.error) }} />
            {task.text}
        </div>
    )
}