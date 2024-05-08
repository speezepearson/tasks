import { useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Box, Button, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CreateTaskForm } from "./CreateTaskForm";
import { Task } from "./Task";
import { EditProjectModal } from "./EditProjectModal";
import { listcmp } from "../common";

export function ProjectCard({
    project, projectTasks, projectsById, tasksById, delegationsById,
}: {
    project: Doc<'projects'> | undefined;
    projectTasks: List<Doc<'tasks'>>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>;
}) {

    const [expanded, setExpanded] = useState(!projectTasks.isEmpty());
    const [editing, setEditing] = useState(false);

    const showTasks = projectTasks.sortBy(t => [t.completedAtMillis !== undefined, -t._creationTime], listcmp);

    return <>
        {editing && project && <EditProjectModal
            project={project}
            onHide={() => { setEditing(false); }} />}
        <Accordion sx={{ backgroundColor: project?.color ?? 'none' }} expanded={expanded}>
            <AccordionSummary onClick={() => { setExpanded(!expanded); }} expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                    {project === undefined
                        ? "(misc)"
                        : project.name}
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                <CreateTaskForm project={project} />
                <Box sx={{ pt: 1 }}>
                    {showTasks.map((task) => <Box key={task._id} sx={{ ":hover": { outline: '1px solid gray' } }}>
                        <Task
                            task={task}
                            projectsById={projectsById}
                            tasksById={tasksById}
                            delegationsById={delegationsById}
                        />
                    </Box>
                    )}
                </Box>
            </AccordionDetails>
            {project && <AccordionActions>
                <Button onClick={() => { setEditing(true); }}>
                    Edit Project
                </Button>
            </AccordionActions>}
        </Accordion>
    </>;
}
