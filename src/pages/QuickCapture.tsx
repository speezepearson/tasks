import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { List } from "immutable";
import { mapundef } from "../common";
import { QuickCaptureForm } from "../components/QuickCaptureForm";

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    return <QuickCaptureForm allProjects={projects ?? List()} autofocus />
}
