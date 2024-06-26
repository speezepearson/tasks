import { useMemo, useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Task } from "./Task";
import { ProjectForm } from "./ProjectForm";
import { listcmp } from "../common";
import AddIcon from "@mui/icons-material/Add";
import { CreateTaskForm } from "./TaskForm";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ProjectCard({
    project, projectTasks, projectsById, tasksById,
}: {
    project: Doc<'projects'>;
    projectTasks: List<Doc<'tasks'>>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
}) {
    const archiveProject = useMutation(api.projects.archive);
    const updateProject = useMutation(api.projects.update);

    const [expanded, setExpanded] = useState(!projectTasks.isEmpty());
    const allProjectsList = useMemo(() => List(projectsById.values()), [projectsById]);

    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [showEditProjectModal, setShowEditProjectModal] = useState(false);

    const showTasks = projectTasks.sortBy(t => [t.completedAtMillis !== undefined, -t._creationTime], listcmp);

    return <>
        {showEditProjectModal && <Dialog open fullWidth
            disableRestoreFocus // HACK: required for autofocus: ...
            onClose={() => { setShowEditProjectModal(false) }}
        >
            <DialogTitle>Edit Project</DialogTitle>
            <DialogContent>
                <ProjectForm
                    init={project}
                    forbidNames={allProjectsList.map(p => p.name).toSet().remove(project.name)}
                    onArchive={async () => {
                        await archiveProject({ id: project._id });
                        setShowEditProjectModal(false);
                    }}
                    onSubmit={async ({ name, color }) => {
                        await updateProject({ id: project._id, name, color });
                        setShowEditProjectModal(false);
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" color="secondary" onClick={() => { setShowAddTaskModal(false) }}>Close</Button>
            </DialogActions>
        </Dialog>}
        {showAddTaskModal && <Dialog open fullWidth
            disableRestoreFocus // HACK: required for autofocus: https://github.com/mui/material-ui/issues/33004
            onClose={() => { setShowAddTaskModal(false) }}
        >
            <DialogTitle>Create Task</DialogTitle>
            <DialogContent>
                <CreateTaskForm
                    forceProject={project}
                    projectsById={projectsById}
                    onCreate={() => { setShowAddTaskModal(false) }}
                />
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" color="secondary" onClick={() => { setShowAddTaskModal(false) }}>Close</Button>
            </DialogActions>
        </Dialog>}
        <Card sx={{ backgroundColor: project.color ?? 'none', p: 1 }}>
            <Stack direction="row" alignItems="center" sx={{ p: 1 }}>
                <Typography variant="h6" sx={{ my: 0, py: 0 }}>
                    {project.name}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button onClick={() => { setShowAddTaskModal(true); }}>
                    <AddIcon />
                </Button>
                <Button onClick={() => { setShowEditProjectModal(true); }}>
                    Edit
                </Button>
                <Button onClick={() => { setExpanded(!expanded); }}>
                    {expanded
                        ? <ExpandLessIcon />
                        : <ExpandMoreIcon />
                    }
                </Button>
            </Stack>
            {expanded && <>
                <Stack direction="column" sx={{ mt: 1, ml: 4 }} divider={<Divider sx={{ my: 0.2 }} />}>
                    {showTasks.map((task) => <Box key={task._id} sx={{ px: 0.2, ":hover": { outline: '1px solid gray' } }}>
                        <Task
                            task={task}
                            projectsById={projectsById}
                            tasksById={tasksById}
                        />
                    </Box>
                    )}
                </Stack>
            </>}
        </Card>
    </>;
}
