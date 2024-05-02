import { Map, List } from "immutable";
import { Doc, Id } from "../convex/_generated/dataModel";
import { useEffect, useState } from "react";

export type ReqStatus =
    | { type: 'working' }
    | { type: 'idle' }
    | { type: 'error'; message: string };

export async function watchReqStatus<T>(
    setReqStatus: (reqStatus: ReqStatus) => void,
    promise: Promise<T>,
): Promise<T> {
    setReqStatus({ type: 'working' });
    try {
        const result = await promise;
        setReqStatus({ type: 'idle' });
        return result;
    } catch (e) {
        setReqStatus({ type: 'error', message: errToString(e) });
        throw e;
    }
}

export function errToString(e: unknown): string {
    if (e instanceof Error) {
        return e.message;
    } else if (typeof e === 'string') {
        return e;
    } else {
        return 'Unknown error :(';
    }
}

export function isBlockerOutstanding({ blocker, tasksById, miscBlockersById, now }: {
    blocker: Doc<'tasks'>['blockers'][0];
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>;
    now: Date;
}): boolean {
    switch (blocker.type) {
        case "task":
            return tasksById.get(blocker.id)!.completedAtMillis === undefined;
        case "time":
            return blocker.millis > now.getTime();
        case "misc":
            return miscBlockersById.get(blocker.id)!.completedAtMillis === undefined;
    }
}

export function getOutstandingBlockers({ task, tasksById, miscBlockersById, now }: {
    task: Doc<'tasks'>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    miscBlockersById: Map<Id<'miscBlockers'>, Doc<'miscBlockers'>>;
    now: Date;
}): List<Doc<'tasks'>['blockers'][0]> {
    return List(task.blockers.filter((blocker) => isBlockerOutstanding({ blocker, tasksById, miscBlockersById, now })));
}

export function useNow(intervalMillis: number) {
    // TODO: use a provider, probably, so that everything ticks together
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, intervalMillis);
        return () => { clearInterval(interval) };
    }, [intervalMillis]);
    return now;
}
