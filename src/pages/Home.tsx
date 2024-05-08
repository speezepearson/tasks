import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { must, textMatches, useNow } from "../common";
import { Inbox } from "../components/Inbox";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { getOutstandingBlockers } from "../common";
import { mapundef, byUniqueKey } from "../common";
import { ProjectCard } from "../components/ProjectCard";
import { listcmp } from "../common";
import { QuickCaptureForm } from "../components/QuickCaptureForm";
// import { CreateDelegationForm } from "../components/CreateDelegationForm";

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    const tasks = mapundef(useQuery(api.tasks.list), List);
    const blockers = mapundef(useQuery(api.delegations.list), List);

    const projectsById = useMemo(() => projects && byUniqueKey(projects, (p) => p._id), [projects]);
    const tasksGroupedByProject = useMemo(() => {
        if (projectsById === undefined || tasks === undefined) return undefined;
        let res = tasks.groupBy(t => must(projectsById.get(t.project), "task references nonexistent project"));
        projectsById.forEach((project) => {
            if (!res.has(project)) res = res.set(project, List());
        });
        return res.entrySeq()
            .filter(([p]) => p.archivedAtMillis === undefined)
            .sortBy(([p, pt]) => [
                p.name.toLowerCase() === 'misc', // towards the end if p is 'misc'
                pt.isEmpty(), // towards the end if there are no tasks
                pt.filter(t => t.completedAtMillis === undefined).size > 0, // towards the end if there are no incomplete tasks
                -p._creationTime // towards the end if p is older
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

    const nextActionFilterFieldRef = useRef<HTMLInputElement | null>(null);
    const [nextActionFilterF, setNextActionFilterF] = useState("");

    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    const [showQuickCapture, setShowQuickCapture] = useState(false);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'q') {
                e.preventDefault();
                setShowQuickCapture(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown) };
    }, []);

    const captures = mapundef(useQuery(api.captures.list, { limit: 10 }), List);

    return <Stack direction="column">
        {showQuickCapture && <Dialog open fullWidth onClose={() => { setShowQuickCapture(false) }}>
            <DialogTitle>Quick Capture</DialogTitle>
            <DialogContent>
                <QuickCaptureForm allProjects={projects ?? List()} autofocus />
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" color="secondary" onClick={() => { setShowQuickCapture(false) }}>Close</Button>
            </DialogActions>
        </Dialog>}
        {captures && captures.size > 0 && <Inbox captures={captures} />}

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" textAlign="center">Next Actions</Typography>
                <TextField
                    inputRef={nextActionFilterFieldRef}
                    label="filter"
                    value={nextActionFilterF}
                    onChange={(e) => { setNextActionFilterF(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { console.log(nextActionFilterFieldRef.current); nextActionFilterFieldRef.current?.blur(); } }}
                    sx={{ maxWidth: '10em' }}
                />
            </Box>
            <Box>
                {(tasksGroupedByProject === undefined
                    || outstandingBlockers === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                    || delegationsById === undefined
                    || blockers === undefined
                )
                    ? <Box>Loading...</Box>
                    : tasksGroupedByProject
                        .map(([p, projectTasks]) => {
                            projectTasks = projectTasks.filter((task) =>
                                task.completedAtMillis === undefined &&
                                outstandingBlockers.get(task._id, List()).isEmpty() &&
                                textMatches(task.text, nextActionFilterF)
                            );
                            if (projectTasks.isEmpty()) return null;
                            return <ProjectCard
                                key={p._id}
                                project={p}
                                projectTasks={projectTasks}
                                projectDelegations={blockers.filter(d => d.project === p._id && d.completedAtMillis === undefined && d.timeoutMillis < now.getTime())}
                                projectsById={projectsById}
                                tasksById={tasksById}
                                delegationsById={delegationsById}
                            />
                        })}
            </Box>
        </Box>

        <Box sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" textAlign="center">Projects</Typography>
                {showCreateProjectModal && <CreateProjectModal
                    onHide={() => { setShowCreateProjectModal(false) }}
                    existingProjects={projects ?? List()}
                />}
                <Button variant="contained" onClick={() => { setShowCreateProjectModal(true) }}>+project</Button>
            </Box>
            {(tasksGroupedByProject === undefined
                || outstandingBlockers === undefined
                || projectsById === undefined
                || tasksById === undefined
                || delegationsById === undefined
                || blockers === undefined
            )
                ? <Box>Loading...</Box>
                : tasksGroupedByProject
                    .map(([project, projectTasks]) => (
                        <ProjectCard
                            key={project._id}
                            project={project}
                            projectTasks={projectTasks}
                            projectDelegations={blockers.filter(d => d.project === project._id)}
                            projectsById={projectsById}
                            tasksById={tasksById}
                            delegationsById={delegationsById}
                        />
                    ))}
        </Box>
    </Stack>
}

