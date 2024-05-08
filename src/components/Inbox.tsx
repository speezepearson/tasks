import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SingleLineMarkdown } from "./SingleLineMarkdown";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import { CardContent, Stack, Typography } from "@mui/material";
import { useLoudRequestStatus, watchReqStatus } from "../common";
import { Doc } from "../../convex/_generated/dataModel";
import { List } from "immutable";

export function Inbox({ captures }: { captures: List<Doc<'captures'>> }) {
    const archive = useMutation(api.captures.archive);

    const [, setReq] = useLoudRequestStatus();

    return <Card>
        <CardContent>
            <Typography variant="h4" textAlign="center">
                Inbox
            </Typography>

            <Stack direction="column" sx={{ mt: 1 }}>
                {captures?.map((capture) => <Stack key={capture._id} direction="row" sx={{ ":hover": { outline: '1px solid gray' } }}>
                    <Typography noWrap>
                        <SingleLineMarkdown>{capture.text}</SingleLineMarkdown>
                    </Typography>
                    <Button
                        variant="outlined"
                        sx={{ ml: "auto" }}
                        onClick={() => { watchReqStatus(setReq, archive({ id: capture._id })) }}
                    >
                        Archive
                    </Button>
                </Stack>)}
            </Stack>
        </CardContent>
    </Card>
}
