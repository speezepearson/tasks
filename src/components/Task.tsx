import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, useNow, watchReqStatus } from "../common";
import { formatDate } from "date-fns";
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import { getOutstandingBlockers } from "../common";
import { EditTaskForm } from "./TaskForm";
import ClearIcon from "@mui/icons-material/Clear";
import { SingleLineMarkdown } from "./Markdown";

export function Task({ task, projectsById, tasksById }: {
    task: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
}) {
    const updateTask = useMutation(api.tasks.update);
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setCompleted = useMutation(api.tasks.setCompleted);

    const [editing, setEditing] = useState(false);

    const now = useNow();
    const [req, setReq] = useLoudRequestStatus();

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById });
    const blocked = outstandingBlockers.size > 0 || (task.blockedUntilMillis !== undefined && task.blockedUntilMillis > now.getTime());
    return <Box>
        {editing && <Dialog open onClose={() => { setEditing(false) }} fullWidth>
            <DialogTitle>Edit task</DialogTitle>
            <DialogContent>
                <EditTaskForm
                    init={task}
                    onUpdate={() => { setEditing(false) }}
                    projectsById={projectsById}
                />
            </DialogContent>

            <DialogActions>
                <Button variant="outlined" onClick={() => { setEditing(false) }}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>}
        <Stack direction="row" alignItems="center" sx={{ py: 0.2 }}>
            <Checkbox
                checked={task.completedAtMillis !== undefined}
                onChange={(e) => {
                    if (req.type === 'working') return;
                    watchReqStatus(setReq, setCompleted({ id: task._id, isCompleted: e.target.checked }));
                }}
                disabled={req.type === 'working'} />
            {" "}
            <Box sx={{ mx: 1, flexGrow: 1 }} role="button" onClick={() => { setEditing(true); }}>
                <SingleLineMarkdown>{task.text}</SingleLineMarkdown>
                {task.tags.map((tag =>
                    <Chip
                        key={tag}
                        label={<>
                            {tag}
                            <Box display="inline-block" role="button" sx={{ cursor: 'pointer' }} onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (req.type === 'working') return;
                                watchReqStatus(setReq, updateTask({
                                    id: task._id,
                                    delTags: [tag],
                                }));
                            }}>
                                <ClearIcon sx={{ ml: 0.3, fontSize: 10 }} />
                            </Box>
                        </>}
                        size="small"
                    />))}
            </Box>
        </Stack>
        {blocked
            && <Box sx={{ ml: 4 }}>
                {task.blockedUntilMillis !== undefined && task.blockedUntilMillis > now.getTime() && <Box>
                    Blocked until: {formatDate(task.blockedUntilMillis, 'yyyy-MM-dd HH:mm')}
                    {" "}
                    <Button
                        variant="outlined"
                        onClick={() => { watchReqStatus(setReq, updateTask({ id: task._id, blockedUntilMillis: { new: undefined } })) }}
                    >
                        Clear
                    </Button>
                </Box>}
                {outstandingBlockers.map((blocker) => {
                    const unlinkButton = <Button
                        variant="outlined"
                        onClick={() => { watchReqStatus(setReq, unlinkBlocker({ id: task._id, blocker })) }}
                    >
                        Unlink
                    </Button>;
                    switch (blocker.type) {
                        case "task":
                            return <Box key={blocker.id}>
                                Blocked on task: {" "}
                                <SingleLineMarkdown>
                                    {must(tasksById.get(blocker.id), "task-blocker references nonexistent task").text}
                                </SingleLineMarkdown>
                                {" "} {unlinkButton}
                            </Box>;
                    }
                })}
            </Box>}
    </Box>;
}
