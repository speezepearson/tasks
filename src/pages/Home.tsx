import { Link } from "react-router-dom";
import { getTaskUrl } from "../routes";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import * as Parameterized from "./Parameterized";

function CreateTaskForm() {
    const createTask = useMutation(api.tasks.create);
    const [text, setText] = useState("");
    const [working, setWorking] = useState(false);

    return <form onSubmit={(e) => {
        e.preventDefault();
        if (working) return;
        setWorking(true);
        createTask({ text }).catch(console.error).finally(() => { setWorking(false); setText(""); });
    }}>
        <input disabled={working} value={text} onChange={(e) => { setText(e.target.value) }} />
        <button disabled={working} type="submit">Create</button>
    </form>

}

export function Page() {
    const tasks = useQuery(api.tasks.list);
    const setCompleted = useMutation(api.tasks.setCompleted);

    if (tasks === undefined) {
        return <div>Loading...</div>
    }

    return <div>
        <ul>
            {tasks.map((task) => <li key={task._id}>
                <input type="checkbox" checked={task.isCompleted} onChange={(e) => { setCompleted({ id: task._id, isCompleted: e.target.checked }).catch(console.error) }} />
                <Link to={getTaskUrl(task._id)} state={{ task } as Parameterized.LinkState}>{task.text}</Link>
            </li>)}
            <li><CreateTaskForm /></li>
        </ul>
    </div>
}