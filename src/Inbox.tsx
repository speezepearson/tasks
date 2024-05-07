import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { QuickCaptureForm } from "./pages/QuickCapture";
import { SingleLineMarkdown } from "./SingleLineMarkdown";

export function Inbox() {
    const captures = useQuery(api.captures.list, { limit: 10 });
    const archive = useMutation(api.captures.archive);

    return <div>
        <ul className="list-group">

            <li className="list-group-item text-center">
                <QuickCaptureForm />
            </li>

            {captures?.map((capture) => <li key={capture._id} className="list-group-item">
                <SingleLineMarkdown>{capture.text}</SingleLineMarkdown>
                <button className="btn btn-sm btn-outline-secondary ms-2" onClick={() => { archive({ id: capture._id }).catch(console.error) }}>Archive</button>
            </li>)}
        </ul>

    </div>
}
