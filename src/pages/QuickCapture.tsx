import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { List, Map } from "immutable";
import { mapundef } from "../common";
import { QuickCaptureForm } from "../components/QuickCaptureForm";
import { useMemo } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    const projectsById: Map<Id<'projects'>, Doc<'projects'>> | undefined = useMemo(
        () => projects?.reduce((acc, p) => acc.set(p._id, p), Map()),
        [projects]);
    return <QuickCaptureForm projectsById={projectsById ?? Map()} />
}
