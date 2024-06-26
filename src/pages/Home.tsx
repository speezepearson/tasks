import { Authenticated, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { List, Map, Set } from "immutable";
import { useListify, must, textMatches, useNow, listcmp } from "../common";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Fab, Stack, TextField, Typography } from "@mui/material";
import { getOutstandingBlockers } from "../common";
import { byUniqueKey } from "../common";
import { ProjectCard } from "../components/ProjectCard";
import { QuickCaptureForm } from "../components/QuickCaptureForm";
import AddIcon from "@mui/icons-material/Add";
import AddRoadIcon from "@mui/icons-material/AddRoad";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Doc } from "../../convex/_generated/dataModel";
import { ProjectForm } from "../components/ProjectForm";
import { useStoreUserEffect } from "../useStoreUserEffect";

type ProjectBlocks = { // eslint-disable-line @typescript-eslint/consistent-type-definitions
    actionable: { tasks: List<Doc<'tasks'>> },
    blocked: { tasks: List<Doc<'tasks'>> },
    historic: { tasks: List<Doc<'tasks'>> },
}
const initialProjectBlock = (): ProjectBlocks => ({
    actionable: { tasks: List() },
    blocked: { tasks: List() },
    historic: { tasks: List() },
});

export function Page() {
    return <>
        <Authenticated>
            <AuthenticatedPage />
        </Authenticated>
        <Footer />
    </>
}

function AuthenticatedPage() {
    // prefetch important queries
    useQuery(api.projects.getInbox);

    const projects = useListify(useQuery(api.projects.list));
    const tasks = useListify(useQuery(api.tasks.list));

    const projectsById = useMemo(() => projects && byUniqueKey(projects, (p) => p._id), [projects]);
    const tasksById = useMemo(() => tasks && byUniqueKey(tasks, (t) => t._id), [tasks]);

    const now = useNow();

    const outstandingBlockers = useMemo(() => {
        return tasksById && tasks && Map(
            tasks
                .map((task) => [task._id, getOutstandingBlockers({ task, tasksById })])
        );
    }, [tasks, tasksById]);

    const projectBlocks: undefined | Map<Doc<'projects'>, ProjectBlocks> = useMemo(() => {
        if (projects === undefined || outstandingBlockers === undefined || tasks === undefined || projectsById === undefined) return undefined;

        const taskBins: Map<Doc<'tasks'>, keyof ProjectBlocks> = Map(tasks.map(t => {
            if (t.completedAtMillis !== undefined
                || must(projectsById.get(t.project), "task references nonexistent project").archivedAtMillis !== undefined)
                return [t, 'historic'];
            if (!outstandingBlockers.get(t._id, List()).isEmpty())
                return [t, 'blocked'];
            if (t.blockedUntilMillis !== undefined && t.blockedUntilMillis > now.getTime())
                return [t, 'blocked'];
            return [t, 'actionable'];
        }));

        let res: Map<Doc<'projects'>, ProjectBlocks> = Map();
        taskBins.forEach((bin, t) => res = res.update(
            must(projectsById.get(t.project), "task references nonexistent project"),
            initialProjectBlock(), pb => ({ ...pb, [bin]: { ...pb[bin], tasks: pb[bin].tasks.push(t) } })));
        return res.filter((_, k) => k.archivedAtMillis === undefined);
    }, [tasks, outstandingBlockers, projects, projectsById, now]);

    const taskFilterFieldRef = useRef<HTMLInputElement | null>(null);
    const [taskFilterF, setTaskFilterF] = useState("");

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.key) {
                case 'f':
                    if (e.ctrlKey || e.metaKey) break;
                    e.preventDefault();
                    taskFilterFieldRef.current?.focus();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown) };
    }, []);

    return <Stack direction="column">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <TextField
                inputRef={taskFilterFieldRef}
                label="filter"
                value={taskFilterF}
                onChange={(e) => { setTaskFilterF(e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Escape') { taskFilterFieldRef.current?.blur(); } }}
                sx={{ maxWidth: '10em' }}
            />
        </Box>

        <Accordion defaultExpanded sx={{ mt: 4 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h4">Next Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {(projectBlocks === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                )
                    ? <Box>Loading...</Box>
                    : projectBlocks
                        .entrySeq()
                        .sortBy(([p]) => [p.name !== 'Inbox', p.name], listcmp)
                        .map(([project, block]) => {
                            const projectTasks = block.actionable.tasks.filter(t => textMatches(
                                [t.text, ...t.tags.map(tag => `@${tag}`)].join(" "),
                                taskFilterF));
                            if (projectTasks.isEmpty()) return null;
                            return <ProjectCard
                                key={project._id}
                                project={project}
                                projectTasks={projectTasks}
                                projectsById={projectsById}
                                tasksById={tasksById}
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
                )
                    ? <Box>Loading...</Box>
                    : projectBlocks
                        .entrySeq()
                        .sortBy(([p]) => p.name)
                        .map(([project, block]) => {
                            const projectTasks = block.blocked.tasks.filter(t => textMatches(
                                [t.text, ...t.tags.map(tag => `@${tag}`)].join(" "),
                                taskFilterF));
                            if (projectTasks.isEmpty()) return null;
                            return <ProjectCard
                                key={project._id}
                                project={project}
                                projectTasks={projectTasks}
                                projectsById={projectsById}
                                tasksById={tasksById}
                            />
                        })}
            </AccordionDetails>
        </Accordion>

        <Accordion sx={{ mt: 4 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h4">Archives</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {(projectBlocks === undefined
                    || projectsById === undefined
                    || tasksById === undefined
                )
                    ? <Box>Loading...</Box>
                    : projectBlocks
                        .entrySeq()
                        .sortBy(([p]) => p.name)
                        .map(([project, block]) => {
                            const projectTasks = block.historic.tasks.filter(t => textMatches(
                                [t.text, ...t.tags.map(tag => `@${tag}`)].join(" "),
                                taskFilterF));
                            if (projectTasks.isEmpty()) return null;
                            return <ProjectCard
                                key={project._id}
                                project={project}
                                projectTasks={projectTasks}
                                projectsById={projectsById}
                                tasksById={tasksById}
                            />
                        })}
            </AccordionDetails>
        </Accordion>
    </Stack>
}

function Footer() {

    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
    const [showQuickCapture, setShowQuickCapture] = useState(false);

    const [recommendedProject, setRecommendedProject] = useState<Doc<'projects'> | undefined>(undefined);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            switch (e.key) {
                case 'q':
                    e.preventDefault();
                    setShowQuickCapture(true);
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown) };
    }, []);

    return <Box component="footer" sx={{ position: "fixed", bottom: 0, right: 0, p: 1 }}>
        <Stack direction="row" spacing={1}>
            <Fab onClick={() => { setShowCreateProjectModal(true) }}><AddRoadIcon /></Fab>
            {showCreateProjectModal && <CreateProjectModal
                onClose={() => { setShowCreateProjectModal(false) }}
                onProjectCreated={(p) => { setRecommendedProject(p); setShowCreateProjectModal(false); setShowQuickCapture(true) }}
            />}

            <Fab color="primary" onClick={() => { setShowQuickCapture(true) }}><AddIcon /></Fab>
            {showQuickCapture && <Dialog open fullWidth onClose={() => { setShowQuickCapture(false) }} PaperProps={{ sx: { position: 'absolute', top: 0 } }}>
                <DialogTitle>Quick Capture</DialogTitle>
                <DialogContent>
                    <QuickCaptureForm recommendedProject={recommendedProject} />
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" color="secondary" onClick={() => { setShowQuickCapture(false) }}>Close</Button>
                </DialogActions>
            </Dialog>}
        </Stack>
    </Box>;
}

function CreateProjectModal({ onClose, onProjectCreated }: { onClose: () => void, onProjectCreated: (p: Doc<'projects'>) => void }) {

    const { isAuthenticated } = useStoreUserEffect();
    const projects = useListify(useQuery(api.projects.list, isAuthenticated ? {} : 'skip'));
    const createProject = useMutation(api.projects.create);

    return <Dialog open fullWidth
        disableRestoreFocus // HACK: required for autofocus: ...
        onClose={onClose}
    >
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
            <ProjectForm
                init={undefined}
                forbidNames={projects?.map(p => p.name).toSet() ?? Set()}
                onSubmit={async ({ name, color }) => {
                    const project = await createProject({ name, color });
                    onProjectCreated(project);
                    onClose();
                }}
            />
        </DialogContent>
        <DialogActions>
            <Button variant="outlined" color="secondary" onClick={onClose}>Close</Button>
        </DialogActions>
    </Dialog>
}
