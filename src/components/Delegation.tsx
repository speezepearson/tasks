import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { formatDate } from "date-fns";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { DelegationForm } from "./DelegationForm";
import { useLoudRequestStatus, useNow, watchReqStatus } from "../common";

export function Delegation({ delegation, projectsById }: { delegation: Doc<'delegations'>; projectsById: Map<Id<'projects'>, Doc<'projects'>>; }) {
    const updateDelegation = useMutation(api.delegations.update);
    const setCompleted = useMutation(api.delegations.setCompleted);
    const [, setReq] = useLoudRequestStatus();

    const [editing, setEditing] = useState(false);
    const now = useNow();

    return <Stack direction="row" sx={{ backgroundColor: delegation.project && projectsById.get(delegation.project)?.color }}>
        {editing && <Dialog open fullWidth
            disableRestoreFocus // HACK: required for autofocus: ...
            onClose={() => { setEditing(false) }}
        >
            <DialogTitle>Edit Project</DialogTitle>
            <DialogContent>
                <DelegationForm
                    init={undefined}
                    initProject={projectsById.get(delegation.project)}
                    projectsById={projectsById}
                    onSubmit={async (fields) => {
                        await updateDelegation({ id: delegation._id, ...fields });
                        setEditing(false);
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" color="secondary" onClick={() => { setEditing(false) }}>Close</Button>
            </DialogActions>
        </Dialog>}
        <Checkbox
            checked={delegation.completedAtMillis !== undefined}
            onChange={(e) => { watchReqStatus(setReq, setCompleted({ id: delegation._id, isCompleted: e.target.checked })) }}
        />
        <Box
            sx={{ ml: 1, flexGrow: 1 }}
            role="button"
            onClick={() => { setEditing(true); }}
        >
            {delegation.completedAtMillis === undefined
                && delegation.timeoutMillis < now.getTime()
                && <Typography color="red" display="inline">
                    TIMED OUT:{" "}
                </Typography>}
            <SingleLineMarkdown>{delegation.text}</SingleLineMarkdown>
        </Box>
        <Typography sx={{ color: 'gray' }}>
            (by {formatDate(delegation.timeoutMillis, 'yyyy-MM-dd')})
        </Typography>
    </Stack>;
}
