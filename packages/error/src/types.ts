import type { TraceMap } from "@jridgewell/trace-mapping";

export interface ErrorProperties {
    hint?: string;
    location?: ErrorLocation;
    message?: string;
    name: string;
    stack?: string;
    title?: string;
}

export interface ErrorLocation {
    column?: number;
    file?: string;
    line?: number;
}

/**
 * Generic object representing an error with all possible data
 * Compatible with Visulima error
 */
export interface ErrorWithMetadata<Type = NonNullable<unknown> & string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [name: string]: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cause?: any;
    frame?: string;
    fullCode?: string;
    hint?: string;
    id?: string;
    loc?: {
        column?: number;
        file?: string;
        line?: number;
    };
    message: string;
    name: string;
    stack: string;
    title?: string;
    type?: Type | "VisulimaError";
}

export type CodeFrameOptions = {
    focusLineColor?: (value: string) => string;
    linesAbove?: number;
    linesBelow?: number;
};

export type TraceType = "eval" | "internal" | "native" | undefined;

export interface Trace extends Partial<SourceCode> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[];
    column?: number | undefined;
    evalOrigin?: Trace | undefined;
    file: string | undefined;
    line?: number | undefined;
    methodName: string | undefined;
    raw: string;
    sourceOrigin?: {
        column?: number | undefined;
        file?: string | undefined;
        line?: number | undefined;
    } | undefined;
    sourcemap?: TraceMap | undefined;
    type?: TraceType;
}

export interface SourceCode {
    code: string;
    postCode: string[];
    preCode: string[];
}
