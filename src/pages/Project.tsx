import { useQuery } from "convex/react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useLocation } from "react-router-dom";

export interface Props {
    id: Id<'projects'>;
}

export interface LinkState {
    project: Doc<'projects'>;
}

export function Page({ id }: Props) {
    const taskQ = useQuery(api.projects.get, { id });
    const locationState = useLocation().state as LinkState | undefined;

    const project = taskQ ?? locationState?.project;

    if (project === undefined) {
        return <div>Loading...</div>
    }

    return (
        <h1>
            {project.name}
        </h1>
    )
}