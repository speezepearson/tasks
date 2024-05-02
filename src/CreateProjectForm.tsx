import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export function CreateProjectForm() {
    const createProject = useMutation(api.projects.create);
    const [name, setName] = useState("");
    const [color, setColor] = useState(randomLightColor());

    const [working, setWorking] = useState(false);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (name === "") return;
        setWorking(true);
        (async () => {
            createProject({ name, color: color === "" ? undefined : color });
            setName("");
            setColor(randomLightColor());
        })().catch(console.error).finally(() => { setWorking(false); });
    }}>
        <input disabled={working} placeholder="Task App" className="form-control form-control-sm d-inline-block" style={{ width: '20em' }} value={name} onChange={(e) => { setName(e.target.value); }} />
        <input disabled={working} type="color" className="form-control form-control-sm d-inline-block ms-1" style={{ width: '4em' }} value={color} onChange={(e) => { setColor(e.target.value); }} />
        <div className="mt-1 mx-auto">
            <button disabled={working} className="btn btn-sm btn-primary ms-1" type="submit">+project</button>
        </div>
    </form>;
}

function randomLightColor() {
    const r = Math.floor(0xb0 + Math.random() * 0x50);
    const g = Math.floor(0xb0 + Math.random() * 0x50);
    const b = Math.floor(0xb0 + Math.random() * 0x50);
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}
