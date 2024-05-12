/* eslint react-refresh/only-export-components: 0 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Map, List } from "immutable";
import { Doc, Id } from "../convex/_generated/dataModel";
import { parseISO } from "date-fns";

export type Result<T> =
    | { type: 'ok', readonly value: T }
    | { type: 'err', readonly message: string };

export type ReqStatus =
    | { type: 'working' }
    | { type: 'idle' }
    | { type: 'error'; message: string };

/**
 * Watch a promise and set the request status accordingly.
 * 
 * If the promise succeeds, the request status is set to `idle`.
 * If the promise fails, the request status is set to `error`.
 */
export function watchReqStatus<T>(
    setReqStatus: (reqStatus: ReqStatus) => void,
    promise: Promise<T>,
) {
    (async () => {
        setReqStatus({ type: 'working' });
        try {
            const result = await promise;
            setReqStatus({ type: 'idle' });
            return result;
        } catch (e) {
            setReqStatus({ type: 'error', message: errToString(e) });
        }
    })().catch(e => {
        console.error(e);
        alert(errToString(e));
    });
}

export function useLoudRequestStatus(): [ReqStatus, (r: ReqStatus) => void] {
    const [req, setReq] = useState<ReqStatus>({ type: 'idle' });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);
    return [req, setReq];
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
}

export function getOutstandingBlockers({ task, tasksById, delegationsById, now }: {
    task: Doc<'tasks'>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
    delegationsById: Map<Id<'delegations'>, Doc<'delegations'>>;
    now: Date;
}): List<Doc<'tasks'>['blockers'][0]> {
    return List(task.blockers.filter((blocker) => {
        switch (blocker.type) {
            case "task":
                return must(tasksById.get(blocker.id), "blocker references nonexistent task").completedAtMillis === undefined;
            case "time":
                return blocker.millis > now.getTime();
            case "delegation":
                return must(delegationsById.get(blocker.id), "blocker references nonexistent delegation").completedAtMillis === undefined;
        }
    }));
}

export function must<T>(x: T | undefined, msg: string): T {
    if (x === undefined) throw new Error(msg);
    return x;
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    try {
        const res = parseISO(date).getTime();
        if (isNaN(res)) return undefined;
        return res;
    } catch (e) {
        return undefined;
    }
}

export function alertOnErr<T>(promise: Promise<T>): void {
    promise.catch((e) => { alert(errToString(e)); throw e; });
}

// Hex color codes for easily distinguishable light colors.
export const recommendedLightProjectColors = List.of(
    '#20B2AA', // Light Sea Green
    '#778899', // Light Slate Gray
    '#87CEFA', // Light Sky Blue
    '#90EE90', // Light Green
    '#ADD8E6', // Light Blue
    '#B0C4DE', // Light Steel Blue
    '#BDFCC9', // Light Mint
    '#D3D3D3', // Light Grey
    '#E0FFFF', // Light Cyan
    '#EE82EE', // Light Violet
    '#F08080', // Light Coral
    '#F0E68C', // Light Khaki
    '#FAFAD2', // Light Goldenrod
    '#FED8B1', // Light Peach
    '#FF77FF', // Light Magenta
    '#FFA07A', // Light Orange
    '#FFB6C1', // Light Pink
    '#FFFFCC', // Light Cream
    '#FFFFE0', // Light Yellow
);

export function randomProjectColor(): string {
    return recommendedLightProjectColors.get(Math.floor(Math.random() * recommendedLightProjectColors.size))!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
}

export function useParsed<Raw, Parsed>(
    init: Raw,
    validate: (raw: Raw) => Result<Parsed>,
): [
        Result<Parsed>,
        Raw,
        (raw: Raw) => void,
    ] {
    const [field, setField] = useState(init);
    const validated = useMemo(() => validate(field), [field, validate]);
    return [validated, field, setField];
}

export function useMiscProject(projectsById: Map<Id<'projects'>, Doc<'projects'>>): Doc<'projects'> {
    return useMemo(
        () => must(projectsById.valueSeq().find(p => p.name === 'Misc'), 'Misc project must exist'),
        [projectsById],
    );
}
