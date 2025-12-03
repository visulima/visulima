export type TraceType = "eval" | "internal" | "native" | undefined;

export interface Trace {
    column: number | undefined;
    evalOrigin?: Trace | undefined;
    file: string | undefined;
    line: number | undefined;
    methodName: string | undefined;
    raw: string;
    type?: TraceType | undefined;
}
