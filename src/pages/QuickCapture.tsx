import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export function QuickCaptureForm() {
    const [text, setText] = useState("");
    const createCapture = useMutation(api.captures.create);
    const [working, setWorking] = useState(false);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (working) return;
        (async () => {
            await createCapture({ text });
            setText("");
        })().catch(console.error).finally(() => { setWorking(false) });
    }}>
        <input
            disabled={working}
            value={text}
            onChange={(e) => { setText(e.target.value) }}
            className="form-control form-control-sm d-inline-block"
            style={{ width: "20em" }}
        />
        <button className="btn btn-sm btn-outline-secondary" disabled={working} type="submit">+</button>
    </form>
}

export function Page() {
    return <div className="text-center">
        <h1>Quick Capture</h1>
        <QuickCaptureForm />
    </div>
}
