import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map } from "immutable";
import { must, textMatches, useNow } from "../common";
import { Inbox } from "../components/Inbox";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { getOutstandingBlockers } from "../common";
import { mapundef, byUniqueKey } from "../common";
import { ProjectCard } from "../components/ProjectCard";
import { QuickCaptureForm } from "../components/QuickCaptureForm";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Doc } from "../../convex/_generated/dataModel";

type ProjectBlocks = { // eslint-disable-line @typescript-eslint/consistent-type-definitions
    actionable: { tasks: List<Doc<'tasks'>>, delegations: List<Doc<'delegations'>> },
    blocked: { tasks: List<Doc<'tasks'>>, delegations: List<Doc<'delegations'>> },
    historic: { tasks: List<Doc<'tasks'>>, delegations: List<Doc<'delegations'>> },
}
const initialProjectBlock = (): ProjectBlocks => ({
    actionable: { tasks: List(), delegations: List() },
    blocked: { tasks: List(), delegations: List() },
    historic: { tasks: List(), delegations: List() },
});

export function Page() {
    const projects = mapundef(useQuery(api.projects.list), List);
    const tasks = mapundef(useQuery(api.tasks.list), List);
    const blockers = mapundef(useQuery(api.delegations.list), List);

    const projectsById = useMemo(() => projects && byUniqueKey(projects, (p) => p._id), [projects]);
    const tasksById = useMemo(() => tasks && byUniqueKey(tasks, (t) => t._id), [tasks]);
    const delegationsById = useMemo(() => blockers && byUniqueKey(blockers, (b) => b._id), [blockers]);

    const now = useNow();

    const outstandingBlockers = useMemo(() => {
        return tasksById && delegationsById && tasks && Map(
            tasks
                .map((task) => [task._id, getOutstandingBlockers({ task, tasksById, delegationsById, now })])
        );
    }, [tasks, tasksById, delegationsById, now]);

    const projectBlocks: undefined | Map<Doc<'projects'>, ProjectBlocks> = useMemo(() => {
        if (projects === undefined || outstandingBlockers === undefined || tasks === undefined || delegationsById === undefined || blockers === undefined || projectsById === undefined) return undefined;

        const taskBins: Map<Doc<'tasks'>, keyof ProjectBlocks> = Map(tasks.map(t => {
            if (t.completedAtMillis !== undefined
                || must(projectsById.get(t.project), "task references nonexistent project").archivedAtMillis !== undefined)
                return [t, 'historic'];
            if (!outstandingBlockers.get(t._id, List()).isEmpty())
                return [t, 'blocked'];
            return [t, 'actionable'];
        }));

        const delegationBins: Map<Doc<'delegations'>, keyof ProjectBlocks> = Map(blockers.map(d => {
            if (d.completedAtMillis !== undefined
                || must(projectsById.get(d.project), "delegation references nonexistent project").archivedAtMillis !== undefined)
                return [d, 'historic'];
            if (d.timeoutMillis < now.getTime())
                return [d, 'actionable'];
            return [d, 'blocked'];
        }))

        let res: Map<Doc<'projects'>, ProjectBlocks> = Map();
        taskBins.forEach((bin, t) => res = res.update(
            must(projectsById.get(t.project), "task references nonexistent project"),
            initialProjectBlock(), pb => ({ ...pb, [bin]: { ...pb[bin], tasks: pb[bin].tasks.push(t) } })));
        delegationBins.forEach((bin, d) => res = res.update(
            must(projectsById.get(d.project), "delegation references nonexistent project"),
            initialProjectBlock(), pb => ({ ...pb, [bin]: { ...pb[bin], delegations: pb[bin].delegations.push(d) } })));
        console.log({ projectBlocks: res.toJS() })
        return res;
    }, [tasks, blockers, now, delegationsById, outstandingBlockers, projects, projectsById]);

    const nextActionFilterFieldRef = useRef<HTMLInputElement | null>(null);
    const [nextActionFilterF, setNextActionFilterF] = useState("");

    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    const [showQuickCapture, setShowQuickCapture] = useState(false);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.key) {
                case 'q':
                    e.preventDefault();
                    setShowQuickCapture(true);
                    break;
                case 'f':
                    if (e.ctrlKey || e.metaKey) break;
                    e.preventDefault();
                    nextActionFilterFieldRef.current?.focus();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown) };
    }, []);

    const captures = mapundef(useQuery(api.captures.list, { limit: 10 }), List);

    return <Stack direction="column">
        <Button variant="contained" sx={{ mx: 'auto', width: '10em' }} onClick={() => { setShowQuickCapture(true) }}>
            <AddIcon />
        </Button>
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

        <Accordion defaultExpanded sx={{ mt: 4 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h4">Next Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <TextField
                    inputRef={nextActionFilterFieldRef}
                    label="filter"
                    value={nextActionFilterF}
                    onChange={(e) => { setNextActionFilterF(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { console.log(nextActionFilterFieldRef.current); nextActionFilterFieldRef.current?.blur(); } }}
                    sx={{ maxWidth: '10em' }}
                />
                {(projectBlocks === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                    || delegationsById === undefined
                )
                    ? <Box>Loading...</Box>
                    : projectBlocks
                        .entrySeq()
                        .sortBy(([p]) => p.name)
                        .map(([project, block]) => {
                            const projectTasks = block.actionable.tasks.filter(t => textMatches(t.text, nextActionFilterF));
                            const projectDelegations = block.actionable.delegations.filter(d => textMatches(d.text, nextActionFilterF));
                            if (projectTasks.isEmpty() && projectDelegations.isEmpty()) return null;
                            return <ProjectCard
                                key={project._id}
                                project={project}
                                projectTasks={projectTasks}
                                projectDelegations={projectDelegations}
                                projectsById={projectsById}
                                tasksById={tasksById}
                                delegationsById={delegationsById}
                            />
                        })}
            </AccordionDetails>
        </Accordion>

        <Accordion sx={{ mt: 4 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h4">Blocked</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {(projectBlocks === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                    || delegationsById === undefined
                )
                    ? <Box>Loading...</Box>
                    : projectBlocks
                        .entrySeq()
                        .sortBy(([p]) => p.name)
                        .map(([project, block]) => {
                            const projectTasks = block.blocked.tasks;
                            const projectDelegations = block.blocked.delegations;
                            if (projectTasks.isEmpty() && projectDelegations.isEmpty()) return null;
                            return <ProjectCard
                                key={project._id}
                                project={project}
                                projectTasks={projectTasks}
                                projectDelegations={projectDelegations}
                                projectsById={projectsById}
                                tasksById={tasksById}
                                delegationsById={delegationsById}
                            />
                        })}
            </AccordionDetails>
        </Accordion>

        <Accordion sx={{ mt: 4 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h4">Archives</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {showCreateProjectModal && <CreateProjectModal
                    onHide={() => { setShowCreateProjectModal(false) }}
                    existingProjects={projects ?? List()}
                />}
                <Button variant="contained" onClick={() => { setShowCreateProjectModal(true) }}>+project</Button>
                {(projectBlocks === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                    || delegationsById === undefined
                )
                    ? <Box>Loading...</Box>
                    : projectBlocks
                        .entrySeq()
                        .sortBy(([p]) => p.name)
                        .map(([project, block]) => {
                            const projectTasks = block.historic.tasks;
                            const projectDelegations = block.historic.delegations;
                            if (projectTasks.isEmpty() && projectDelegations.isEmpty()) return null;
                            return <ProjectCard
                                key={project._id}
                                project={project}
                                projectTasks={projectTasks}
                                projectDelegations={projectDelegations}
                                projectsById={projectsById}
                                tasksById={tasksById}
                                delegationsById={delegationsById}
                            />
                        })}
            </AccordionDetails>
        </Accordion>
    </Stack>
}

