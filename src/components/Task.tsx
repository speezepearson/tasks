import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { List, Map, Set } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, useNow, watchReqStatus } from "../common";
import { formatDate } from "date-fns";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { AddBlockerModal } from "./AddBlockerModal";
import { getOutstandingBlockers } from "../common";
import { TaskForm } from "./TaskForm";
import ClearIcon from "@mui/icons-material/Clear";

export function Task({ task, projectsById, tasksById }: {
    task: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
}) {
    const updateTask = useMutation(api.tasks.update);
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setCompleted = useMutation(api.tasks.setCompleted);

    const [editing, setEditing] = useState(false);
    const [showBlockerModal, setShowBlockerModal] = useState(false);

    const now = useNow();
    const [req, setReq] = useLoudRequestStatus();

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById, now });
    const blocked = outstandingBlockers.size > 0;
    return <Box>
        {editing && <Dialog open onClose={() => { setEditing(false) }} fullWidth>
            <DialogTitle>Edit task</DialogTitle>
            <DialogContent>
                <TaskForm
                    init={task}
                    onSubmit={async ({ text, project, tags }) => {
                        console.log('updating task', { text, project, tags });
                        await updateTask({
                            id: task._id,
                            text,
                            project,
                            addTags: Set(tags).subtract(Set(task.tags)).toArray(),
                            delTags: Set(task.tags).subtract(Set(tags)).toArray(),
                        });
                        setEditing(false);
                    }}
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
                disabled={req.type === 'working' || (blocked && task.completedAtMillis === undefined)} />
            {" "}
            <Box sx={{ mx: 1, flexGrow: 1 }} role="button" onClick={() => { setEditing(true); }}>
                <Typography sx={{ color: blocked ? 'gray' : 'inherit', display: 'inline-block', mr: 1 }}>

                    <SingleLineMarkdown>{task.text}</SingleLineMarkdown>
                </Typography>
                {task.tags?.map((tag =>
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
            {showBlockerModal && <AddBlockerModal
                onHide={() => { setShowBlockerModal(false); }}
                task={task}
                autocompleteTasks={List(tasksById.values())}
            />}
            <Button variant="outlined" onClick={() => { setShowBlockerModal(true); }} sx={{ flexShrink: 0 }}>
                +blocker
            </Button>
        </Stack>
        {blocked
            && <Box sx={{ ml: 4 }}>
                blocked on:
                <Box sx={{ ml: 2 }}>
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
                                    <SingleLineMarkdown>
                                        {must(tasksById.get(blocker.id), "task-blocker references nonexistent task").text}
                                    </SingleLineMarkdown>
                                    {" "} {unlinkButton}
                                </Box>;
                            case "time":
                                return <Box key={`__time-${blocker.millis}`}>
                                    {formatDate(blocker.millis, 'yyyy-MM-dd')}
                                    {" "} {unlinkButton}
                                </Box>;
                            case "delegation":
                                throw new Error("delegations should not be blockers anymore");
                        }
                    })}
                </Box>
            </Box>}
    </Box>;
}
