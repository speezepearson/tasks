/* eslint react-refresh/only-export-components: 0 */

import { createContext, useContext, useEffect, useState } from "react";
import { Map, List } from "immutable";
import { Doc, Id } from "../convex/_generated/dataModel";
import { parseISO } from "date-fns";

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



const timeContext = createContext(new Date());

export function TickProvider({ children }: { children: React.ReactNode; }) {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 10000);
        return () => { clearInterval(interval) };
    }, []);
    return <timeContext.Provider value={now}>{children}</timeContext.Provider>;
}

export function useNow() {
    return useContext(timeContext);
}
export function textMatches(text: string, query: string): boolean {
    for (const word of query.split(/\s+/)) {
        if (!text.toLowerCase().includes(word.toLowerCase())) {
            return false;
        }
    }
    return true;
}
export function guessTimeoutMillisFromText(text: string): { withoutDate: string; timeout: Date; } | undefined {
    const regexp = /(\d{4}-\d{2}-\d{2})$/;
    const dateMatch = text.match(regexp);
    if (dateMatch === null) return undefined;
    const timeoutMillis = parseISOMillis(dateMatch[1]);
    if (timeoutMillis === undefined) return undefined;
    return {
        withoutDate: text.replace(regexp, ''),
        timeout: new Date(timeoutMillis),
    };
} export function getOutstandingBlockers({ task, tasksById, delegationsById, now }: {
    task: Doc<'tasks'>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>;
    now: Date;
}): List<Doc<'tasks'>['blockers'][0]> {
    return List(task.blockers.filter((blocker) => {
        switch (blocker.type) {
            case "task":
                return tasksById.get(blocker.id)!.completedAtMillis === undefined;
            case "time":
                return blocker.millis > now.getTime();
            case "delegation":
                return delegationsById.get(blocker.id)!.completedAtMillis === undefined;
        }
    }));
}
export function mapundef<T, U>(x: T | undefined, f: (x: T) => U): U | undefined {
    return x === undefined ? undefined : f(x);
}
export function byUniqueKey<T, K>(items: List<T>, key: (item: T) => K): Map<K, T> {
    let map = Map<K, T>();
    items.forEach((item) => {
        map = map.set(key(item), item);
    });
    return map;
}
export function listcmp<T>(a: T[], b: T[]): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] < b[i]) return -1;
        if (a[i] > b[i]) return 1;
    }
    return a.length - b.length;
}
export function parseISOMillis(date: string): number | undefined {
    try {
        const res = parseISO(date).getTime();
        if (isNaN(res)) return undefined;
        return res;
    } catch (e) {
        return undefined;
    }
}

