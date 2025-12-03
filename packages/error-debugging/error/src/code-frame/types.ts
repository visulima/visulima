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
    color?: {
        gutter?: ColorizeMethod;
        marker?: ColorizeMethod;
        message?: ColorizeMethod;
    };
    linesAbove?: number;
    linesBelow?: number;
    message?: string;
    prefix?: string;
    showGutter?: boolean;
    showLineNumbers?: boolean;
    tabWidth?: number | false;
};
