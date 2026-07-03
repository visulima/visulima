export type TraceType = "eval" | "internal" | "native" | undefined;

export interface Trace {
    column?: number;
    evalOrigin?: Trace;
    file?: string;
    line?: number;
    methodName?: string;
    raw: string;
    type?: TraceType;
}
