import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { SingleLineMarkdown } from "../SingleLineMarkdown";
import { ReqStatus, watchReqStatus } from "../common";

export function QuickCaptureForm() {
    const [text, setText] = useState("");
    const createCapture = useMutation(api.captures.create);
    const [req, setReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async () => {
            await createCapture({ text });
            setText("");
        })()).catch(console.error);
    }}>
        <input
            autoFocus
            disabled={req.type === 'working'}
            value={text}
            onChange={(e) => { setText(e.target.value) }}
            className="form-control form-control-sm d-inline-block"
            style={{ width: "20em" }}
        />
        <button className="btn btn-sm btn-primary ms-1" disabled={req.type === 'working'} type="submit">+note</button>
    </form>
}

export function Page() {
    const captures = useQuery(api.captures.list, { limit: 10 });
    return <div>
        <div className="text-center">
            <h1>Quick Capture</h1>
            <QuickCaptureForm />
        </div>

        <hr />

        <h2>Recent captures</h2>
        <ul className="list-group">
            {captures === undefined
                ? <li className="list-group-item">Loading...</li>
                : captures.map((capture, i) => <li key={i} className="list-group-item">
                    <SingleLineMarkdown>{capture.text}</SingleLineMarkdown>
                </li>)}
        </ul>
    </div>
}
