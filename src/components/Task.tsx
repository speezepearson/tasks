import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { List, Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ReqStatus, useNow, watchReqStatus } from "../common";
import { formatDate } from "date-fns";
import { SingleLineMarkdown } from "../SingleLineMarkdown";
import { Box, Button, Checkbox, Stack, Typography } from "@mui/material";
import { AddBlockerModal } from "./AddBlockerModal";
import { getOutstandingBlockers } from "../common";
import { EditTaskModal } from "./EditTaskModal";

export function Task({ task, projectsById, tasksById, delegationsById: delegationsById }: {
    task: Doc<'tasks'>;
    projectsById: Map<Id<'projects'>, Doc<'projects'>>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>;
}) {
    const unlinkBlocker = useMutation(api.tasks.unlinkBlocker);
    const setCompleted = useMutation(api.tasks.setCompleted);
    const setDelegationCompleted = useMutation(api.delegations.setCompleted);

    const [editing, setEditing] = useState(false);
    const [showBlockerModal, setShowBlockerModal] = useState(false);

    const now = useNow();
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    const outstandingBlockers = getOutstandingBlockers({ task, tasksById, delegationsById: delegationsById, now });
    const blocked = outstandingBlockers.size > 0;
    return <Box>
        {editing && <EditTaskModal
            task={task}
            projectsById={projectsById}
            onHide={() => { setEditing(false); }} />}
        <Stack direction="row" alignItems="center">
            <Checkbox
                checked={task.completedAtMillis !== undefined}
                onChange={(e) => {
                    if (req.type === 'working') return;
                    watchReqStatus(setReq, setCompleted({ id: task._id, isCompleted: e.target.checked }))
                        .catch(console.error);
                }}
                style={{ width: '1em', height: '1em' }}
                disabled={req.type === 'working' || (blocked && task.completedAtMillis === undefined)} />
            {" "}
            <Typography noWrap sx={{ ml: 1, flexGrow: 1, color: blocked ? 'gray' : 'inherit' }}
                role="button"
                onClick={() => { setEditing(true); }}
            >
                <SingleLineMarkdown>{task.text}</SingleLineMarkdown>
            </Typography>
            {showBlockerModal && <AddBlockerModal onHide={() => { setShowBlockerModal(false); }} task={task} allTasks={List(tasksById.values())} allDelegations={List(delegationsById.values())} />}
            <Button size="small" variant="outlined" sx={{ py: 0 }} onClick={() => { setShowBlockerModal(true); }}>+blocker</Button>
        </Stack>
        {blocked
            && <Box sx={{ ml: 4 }}>
                blocked on:
                <Box sx={{ ml: 2 }}>
                    {outstandingBlockers.map((blocker) => {
                        const unlinkButton = <Button
                            size="small" sx={{ py: 0 }} variant="outlined"
                            onClick={() => { unlinkBlocker({ id: task._id, blocker }).catch(console.error); }}>unlink</Button>;
                        switch (blocker.type) {
                            case "task":
                                return <Box key={blocker.id}>
                                    <SingleLineMarkdown>{tasksById.get(blocker.id)!.text}</SingleLineMarkdown>
                                    {" "} {unlinkButton}
                                </Box>;
                            case "time":
                                return <Box key={`__time-${blocker.millis}`}>
                                    {formatDate(blocker.millis, 'yyyy-MM-dd')}
                                    {" "} {unlinkButton}
                                </Box>;
                            case "delegation":
                                return <Box key={blocker.id}>
                                    <Checkbox
                                        checked={delegationsById.get(blocker.id)!.completedAtMillis !== undefined}
                                        onChange={(e) => { setDelegationCompleted({ id: blocker.id, isCompleted: e.target.checked }).catch(console.error); }}
                                        style={{ width: '1em', height: '1em' }} />
                                    {" "}
                                    <SingleLineMarkdown>{delegationsById.get(blocker.id)!.text}</SingleLineMarkdown>
                                    {" "} {unlinkButton}
                                </Box>;
                        }
                    })}
                </Box>
            </Box>}
    </Box>;
}
