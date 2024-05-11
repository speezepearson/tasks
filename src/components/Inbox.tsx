import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import { CardContent, Stack, Typography } from "@mui/material";
import { useLoudRequestStatus, watchReqStatus } from "../common";
import { Doc } from "../../convex/_generated/dataModel";
import { List } from "immutable";

function Capture({ capture }: { capture: Doc<'captures'> }) {
    const archive = useMutation(api.captures.archive);

    const [req, setReq] = useLoudRequestStatus();

    return <Stack direction="row" sx={{ ":hover": { outline: '1px solid gray' } }}>
        <Typography noWrap>
            <SingleLineMarkdown>{capture.text}</SingleLineMarkdown>
        </Typography>
        <Button
            variant="outlined"
            sx={{ ml: "auto" }}
            onClick={() => { watchReqStatus(setReq, archive({ id: capture._id })) }}
            disabled={req.type === 'working'}
        >
            Archive
        </Button>
    </Stack>

}

export function Inbox({ captures }: { captures: List<Doc<'captures'>> }) {
    return <Card>
        <CardContent>
            <Typography variant="h4" textAlign="center">
                Inbox
            </Typography>

            <Stack direction="column" sx={{ mt: 1 }}>
                {captures.map((capture) => <Capture key={capture._id} capture={capture} />)}
            </Stack>
        </CardContent>
    </Card>
}
