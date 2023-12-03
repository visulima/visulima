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

export type CodeFrameLocation = {
    column?: number;
    line: number;
};

export type CodeFrameNodeLocation = {
    end?: CodeFrameLocation;
    start: CodeFrameLocation;
};

export type ColorizeMethod = (value: string) => string;

export type CodeFrameOptions = {
    color?: Partial<{
        gutter: ColorizeMethod;
        marker: ColorizeMethod;
        message: ColorizeMethod;
    }>;
    message?: string;
    linesAbove?: number;
    linesBelow?: number;
    showLineNumbers?: boolean;
    showGutter?: boolean;
};

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
