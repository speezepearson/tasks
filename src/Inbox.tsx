import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { QuickCaptureForm } from "./pages/QuickCapture";
import { SingleLineMarkdown } from "./SingleLineMarkdown";

export function Inbox() {
    const captures = useQuery(api.captures.list, { limit: 10 });
    const archive = useMutation(api.captures.archive);

    return <div className="card p-2">

        <li className="list-group-item text-center">
            <QuickCaptureForm />
        </li>

        <div className="ms-4">
            {captures?.map((capture) => <div key={capture._id} className="d-flex flex-row">
                <SingleLineMarkdown>{capture.text}</SingleLineMarkdown>
                <div className="ms-auto"></div>
                <button className="btn btn-sm btn-outline-secondary py-0" onClick={() => { archive({ id: capture._id }).catch(console.error) }}>Archive</button>
            </div>)}
        </div>

    </div>
}
