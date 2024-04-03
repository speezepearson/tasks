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
