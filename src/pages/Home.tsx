import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { List, Map } from "immutable";
import { textMatches, useNow } from "../common";
import { Inbox } from "../components/Inbox";
import { Box, Card, CardContent, Grid, Stack, TextField } from "@mui/material";
import { CreateProjectForm } from "../components/CreateProjectForm";
import { getOutstandingBlockers } from "../common";
import { mapundef, byUniqueKey } from "../common";
import { ProjectCard } from "../components/ProjectCard";
import { listcmp } from "../common";
import { Delegation } from "../components/Delegation";
import { CreateDelegationForm } from "../components/CreateDelegationForm";

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    const tasks = mapundef(useQuery(api.tasks.list), List);
    const blockers = mapundef(useQuery(api.delegations.list), List);

    const projectsById = useMemo(() => projects && byUniqueKey(projects, (p) => p._id), [projects]);
    const tasksGroupedByProject = useMemo(() => {
        if (projectsById === undefined || tasks === undefined) return undefined;
        let res = tasks.groupBy(t => t.project && projectsById.get(t.project));
        projectsById.forEach((project) => {
            if (!res.has(project)) res = res.set(project, List());
        });
        if (!res.has(undefined)) res = res.set(undefined, List());
        return res.entrySeq()
            .filter(([p]) => p?.archivedAtMillis === undefined)
            .sortBy(([p, pt]) => [
                p === undefined, // towards the end if p is 'misc'
                pt.isEmpty(), // towards the end if there are no tasks
                pt.filter(t => t.completedAtMillis === undefined).size > 0, // towards the end if there are no incomplete tasks
                p !== undefined && -p._creationTime // towards the end if p is older
            ], listcmp);
    }, [tasks, projectsById]);
    const tasksById = useMemo(() => tasks && byUniqueKey(tasks, (t) => t._id), [tasks]);
    const delegationsById = useMemo(() => blockers && byUniqueKey(blockers, (b) => b._id), [blockers]);

    const now = useNow();

    const outstandingBlockers = useMemo(() => {
        return tasksById && delegationsById && tasks && Map(
            tasks
                .map((task) => [task._id, getOutstandingBlockers({ task, tasksById, delegationsById, now })])
        );
    }, [tasks, tasksById, delegationsById, now]);

    const [nextActionFilterField, setNextActionFilterField] = useState("");

    const timedOutBlockers = useMemo(
        () => blockers?.filter(b => b.completedAtMillis === undefined && b.timeoutMillis && b.timeoutMillis < now.getTime()),
        [blockers, now],
    );

    return <Stack direction="column">
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Inbox />
            </Grid>

            <Grid item xs={12} sm={6}>
                <Card>
                    <CardContent>
                        <Box sx={{ textAlign: 'center' }}><h1> Timed Out </h1></Box>
                        <Box>
                            {(timedOutBlockers === undefined || projectsById === undefined)
                                ? <Box>Loading...</Box>
                                : timedOutBlockers
                                    .map((blocker) => <Box key={blocker._id} sx={{ ":hover": { outline: "1px solid gray" } }}>
                                        <Delegation delegation={blocker} projectsById={projectsById} />
                                    </Box>)}
                        </Box>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
                <h1>Next Actions</h1>
                <TextField
                    value={nextActionFilterField}
                    onChange={(e) => { setNextActionFilterField(e.target.value) }}
                    label="filter"
                    style={{ maxWidth: '10em' }}
                />
            </Box>
            <Box>
                {(tasksGroupedByProject === undefined
                    || outstandingBlockers === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                    || delegationsById === undefined
                )
                    ? <Box>Loading...</Box>
                    : tasksGroupedByProject
                        .map(([p, projectTasks]) => {
                            projectTasks = projectTasks.filter((task) =>
                                task.completedAtMillis === undefined &&
                                outstandingBlockers.get(task._id, List()).isEmpty() &&
                                textMatches(task.text, nextActionFilterField)
                            );
                            if (projectTasks.isEmpty()) return null;
                            return <ProjectCard
                                key={p?._id ?? "<undef>"}
                                project={p}
                                projectTasks={projectTasks}
                                projectsById={projectsById}
                                tasksById={tasksById}
                                delegationsById={delegationsById}
                            />
                        })}
            </Box>
        </Box>

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
                <h1>Projects</h1>
                <CreateProjectForm />
            </Box>
            {(tasksGroupedByProject === undefined
                || outstandingBlockers === undefined
                || projectsById === undefined
                || tasksById === undefined
                || delegationsById === undefined
            )
                ? <Box>Loading...</Box>
                : tasksGroupedByProject
                    .map(([project, projectTasks]) => (
                        <ProjectCard
                            key={project?._id ?? "<undef>"}
                            project={project}
                            projectTasks={projectTasks}
                            projectsById={projectsById}
                            tasksById={tasksById}
                            delegationsById={delegationsById}
                        />
                    ))}
        </Box>

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}><h1> Delegations </h1></Box>
            <Card><CardContent>
                {blockers === undefined || projectsById === undefined
                    ? <Box>Loading...</Box>
                    : blockers
                        .sortBy(b => [b.completedAtMillis !== undefined, b.timeoutMillis, b.text], listcmp)
                        .map((blocker) => <Box key={blocker._id} sx={{ ":hover": { outline: '1px solid gray' } }}>
                            <Delegation delegation={blocker} projectsById={projectsById} />
                        </Box>
                        )}
                <CreateDelegationForm />
            </CardContent></Card>
        </Box>
    </Stack>
}

