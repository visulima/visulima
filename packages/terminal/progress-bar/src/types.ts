export type ProgressBarStyle = "shades_classic" | "shades_grey" | "rect" | "filled" | "solid" | "ascii" | "braille" | "custom";

export interface ProgressBarOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];
    current?: number;
    format?: string;
    fps?: number;
    peak?: number;
    peakChar?: string;
    roundedCaps?: boolean;
    style?: ProgressBarStyle;
    total: number;
    width?: number;
}

export interface MultiBarOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];
    composite?: boolean;
    format?: string;
    fps?: number;
    style?: ProgressBarStyle;
}

export interface ProgressBarPayload {
    [key: string]: string | number | boolean;
}
