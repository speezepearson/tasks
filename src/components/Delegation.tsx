import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Map } from "immutable";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { formatDate } from "date-fns";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import { Box, Checkbox, Stack, Typography } from "@mui/material";
import { EditDelegationModal } from "./EditDelegationModal";
import { useLoudRequestStatus, useNow, watchReqStatus } from "../common";

export function Delegation({ delegation, projectsById }: { delegation: Doc<'delegations'>; projectsById: Map<Id<'projects'>, Doc<'projects'>>; }) {
    const setCompleted = useMutation(api.delegations.setCompleted);
    const [, setReq] = useLoudRequestStatus();

    const [editing, setEditing] = useState(false);
    const now = useNow();

    return <Stack direction="row" sx={{ backgroundColor: delegation.project && projectsById.get(delegation.project)?.color }}>
        {editing && <EditDelegationModal
            delegation={delegation}
            projectsById={projectsById}
            onHide={() => { setEditing(false); }} />}
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
