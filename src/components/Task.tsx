import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { must, useLoudRequestStatus, useNow, watchReqStatus } from "../common";
import { formatDate } from "date-fns";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { AddBlockerModal } from "./AddBlockerModal";
import { getOutstandingBlockers } from "../common";
import { TaskForm } from "./TaskForm";

export function Task({ task, projectsById, tasksById, delegationsById }: {
    task: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>;
}) {
    const updateTask = useMutation(api.tasks.update);
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setCompleted = useMutation(api.tasks.setCompleted);
    const setDelegationCompleted = useMutation(api.delegations.setCompleted);

    const [editing, setEditing] = useState(false);
    const [showBlockerModal, setShowBlockerModal] = useState(false);

    const now = useNow();
    const [req, setReq] = useLoudRequestStatus();

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById, delegationsById: delegationsById, now });
    const blocked = outstandingBlockers.size > 0;
    return <Box>
        {editing && <Dialog open onClose={() => { setEditing(false) }} fullWidth>
            <DialogTitle>Edit task</DialogTitle>
            <DialogContent>
                <TaskForm
                    init={task}
                    onSubmit={async ({ text, project }) => {
                        await updateTask({ id: task._id, text, project });
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
        <Stack direction="row" alignItems="center" sx={{ py: 0.2, borderBottom: 1, borderColor: "InactiveBorder" }}>
            <Checkbox
                checked={task.completedAtMillis !== undefined}
                onChange={(e) => {
                    if (req.type === 'working') return;
                    watchReqStatus(setReq, setCompleted({ id: task._id, isCompleted: e.target.checked }));
                }}
                disabled={req.type === 'working' || (blocked && task.completedAtMillis === undefined)} />
            {" "}
            <Typography sx={{ mx: 1, flexGrow: 1, color: blocked ? 'gray' : 'inherit' }}
                role="button"
                onClick={() => { setEditing(true); }}
            >
                <SingleLineMarkdown>{task.text}</SingleLineMarkdown>
            </Typography>
            {showBlockerModal && <AddBlockerModal
                onHide={() => { setShowBlockerModal(false); }}
                task={task}
                allTasks={List(tasksById.values())}
                allDelegations={List(delegationsById.values())}
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
                                return (() => {
                                    const delegation = must(delegationsById.get(blocker.id), "task-blocker references nonexistent delegation");
                                    return <Box key={blocker.id}>
                                        <Checkbox
                                            checked={delegation.completedAtMillis !== undefined}
                                            onChange={(e) => { watchReqStatus(setReq, setDelegationCompleted({ id: blocker.id, isCompleted: e.target.checked })) }}
                                        />
                                        {" "}
                                        <SingleLineMarkdown>{delegation.text}</SingleLineMarkdown>
                                        {" "} {unlinkButton}
                                    </Box>;
                                })();
                        }
                    })}
                </Box>
            </Box>}
    </Box>;
}
