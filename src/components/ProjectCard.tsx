import { useMemo, useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Task } from "./Task";
import { EditProjectModal } from "./EditProjectModal";
import { listcmp } from "../common";
import { QuickCaptureForm } from "./QuickCaptureForm";
import AddIcon from "@mui/icons-material/Add";

export function ProjectCard({
    project, projectTasks, projectsById, tasksById, delegationsById,
}: {
    project: Doc<'projects'>;
    projectTasks: List<Doc<'tasks'>>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>;
}) {

    const [expanded, setExpanded] = useState(!projectTasks.isEmpty());
    const [editing, setEditing] = useState(false);
    const allProjectsList = useMemo(() => List(projectsById.values()), [projectsById]);

    const [showQuickCapture, setShowQuickCapture] = useState(false);

    const showTasks = projectTasks.sortBy(t => [t.completedAtMillis !== undefined, -t._creationTime], listcmp);

    return <>
        {editing && <EditProjectModal
            project={project}
            existingProjects={allProjectsList}
            onHide={() => { setEditing(false); }} />}
        {showQuickCapture && <Dialog open fullWidth onClose={() => { setShowQuickCapture(false) }}>
            <DialogTitle>Quick Capture</DialogTitle>
            <DialogContent>
                <QuickCaptureForm fixedProject={project} allProjects={allProjectsList} autofocus />
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" color="secondary" onClick={() => { setShowQuickCapture(false) }}>Close</Button>
            </DialogActions>
        </Dialog>}
        <Card sx={{ backgroundColor: project.color ?? 'none', p: 1 }}>
            <Stack direction="row" alignItems="center" sx={{ p: 1 }}>
                <Typography variant="h6" sx={{ my: 0, py: 0 }}>
                    {project.name}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button onClick={() => { setShowQuickCapture(true); }}>
                    <AddIcon />
                </Button>
                <Button onClick={() => { setEditing(true); }}>
                    Edit
                </Button>
                <Button onClick={() => { setExpanded(!expanded); }}>
                    {expanded
                        ? <ExpandMoreIcon />
                        : <ExpandLessIcon />
                    }
                </Button>
            </Stack>
            <Stack direction="column" sx={{ mt: 1, ml: 4, mb: 2, display: expanded ? 'block' : 'none' }}>
                {showTasks.map((task) => <Box key={task._id} sx={{ ":hover": { outline: '1px solid gray' } }}>
                    <Task
                        task={task}
                        projectsById={projectsById}
                        tasksById={tasksById}
                        delegationsById={delegationsById}
                    />
                </Box>
                )}
            </Stack>
        </Card>
    </>;
}
