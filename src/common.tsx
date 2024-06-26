/* eslint react-refresh/only-export-components: 0 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Map, List } from "immutable";
import { Doc, Id } from "../convex/_generated/dataModel";
import { parseISO, startOfDay } from "date-fns";
import { nextSunday } from "date-fns/nextSunday";
import { addDays } from "date-fns/addDays";
import { nextTuesday } from "date-fns/nextTuesday";
import { nextWednesday } from "date-fns/nextWednesday";
import { nextThursday } from "date-fns/nextThursday";
import { nextFriday } from "date-fns/nextFriday";
import { nextSaturday } from "date-fns/nextSaturday";
import { nextMonday } from "date-fns/nextMonday";
import { formatDate } from "date-fns/format";

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

export function getOutstandingBlockers({ task, tasksById }: {
    task: Doc<'tasks'>;
    tasksById: Map<Id<'tasks'>, Doc<'tasks'>>;
}): List<Doc<'tasks'>['blockers'][0]> {
    return List(task.blockers.filter((blocker) => {
        switch (blocker.type) {
            case "task":
                return must(tasksById.get(blocker.id), "blocker references nonexistent task").completedAtMillis === undefined;
        }
    }));
}

export function must<T>(x: T | undefined, msg: string): T {
    if (x === undefined) throw new Error(msg);
    return x;
}

export function byUniqueKey<T, K>(items: List<T>, key: (item: T) => K): Map<K, T> {
    let map = Map<K, T>();
    items.forEach((item) => {
        map = map.set(key(item), item);
    });
    return map;
}

export function useListify<T>(xs: T[] | undefined): List<T> | undefined {
    return useMemo(() => xs === undefined ? undefined : List(xs), [xs]);
}

export function useMapify<T, Field extends keyof T>(xs: T[] | undefined, field: Field): Map<T[Field], T> | undefined {
    return useMemo(
        () => xs === undefined ? undefined : Map(xs.map(x => [x[field], x])),
        [xs, field],
    );
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

export function isComplete(task: Doc<'tasks'>): boolean {
    return task.completedAtMillis !== undefined;
}
export function isInProject(project: Id<'projects'>, task: Doc<'tasks'>): boolean {
    return task.project === project;
}

export function formatISODate(date: Date | number): string {
    return formatDate(date, 'yyyy-MM-dd');
}

export function parseLazyDate(now: Date, s: string): Date | undefined {
    const iso = parseISO(s);
    if (!isNaN(iso.getTime())) return iso;

    switch (s.toLowerCase()) {
        case 'today':
            return startOfDay(now);
        case 'tom':
        case 'tomorrow':
            return startOfDay(addDays(now, 1));

        case 'sun': return startOfDay(nextSunday(now));
        case 'mon': return startOfDay(nextMonday(now));
        case 'tue': return startOfDay(nextTuesday(now));
        case 'wed': return startOfDay(nextWednesday(now));
        case 'thu': return startOfDay(nextThursday(now));
        case 'fri': return startOfDay(nextFriday(now));
        case 'sat': return startOfDay(nextSaturday(now));

        case 'next sun': return startOfDay(nextSunday(nextSunday(now)));
        case 'next mon': return startOfDay(nextMonday(nextMonday(now)));
        case 'next tue': return startOfDay(nextTuesday(nextTuesday(now)));
        case 'next wed': return startOfDay(nextWednesday(nextWednesday(now)));
        case 'next thu': return startOfDay(nextThursday(nextThursday(now)));
        case 'next fri': return startOfDay(nextFriday(nextFriday(now)));
        case 'next sat': return startOfDay(nextSaturday(nextSaturday(now)));
    }

    return undefined;
}