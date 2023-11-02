import type { Options as BoxenOptions } from "boxen";
import type { ChalkInstance, ColorName } from "chalk";
import type { MultiBar, Options as ProgressOptions, SingleBar } from "cli-progress";
import type CLITable from "cli-table3";
import type { Options as OraOptions, Ora } from "ora";
import type terminalLink from "terminal-link";

type TableStyle = Partial<CLITable.TableInstanceOptions["style"]>;

export type Colors = Record<ColorName, ChalkInstance> & {
    critical: ChalkInstance;
    error: ChalkInstance;
    highlight: ChalkInstance;
    important: ChalkInstance;
    info: ChalkInstance;
    line: ChalkInstance;
    muted: ChalkInstance;
    success: ChalkInstance;
    warning: ChalkInstance;
};

export interface PrintTableOptions {
    /**
     * Define custom column widths
     */
    colWidths?: number[];
    /**
     * The column index that should take remaining
     * width.
     */
    fluidColumnIndex?: number;
    format?: "default" | "lean" | "markdown";
    fullWidth?: boolean;
    /**
     * Padding for columns
     */
    padding?: number;
    style?: TableStyle;
}

export interface Print {
    annotation: (text: string, annotation: string) => void;
    boxen: (text: string, options?: BoxenOptions) => string;
    clear: () => void;
    /* Colors as seen from colors. */
    colors: Colors;
    /* Prints a divider. */
    divider: (options?: { fullWidth?: boolean; width?: number }) => void;
    justify: (
        columns: string[],
        options: {
            align?: "left" | "right";
            maxWidth: number;
            paddingChar?: string;
        },
    ) => string[];
    link: typeof terminalLink;

    multiProgress: (options?: ProgressOptions) => MultiBar;

    /* Prints a newline. */
    newline: () => void;

    /**
     * Console.log with some checks.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    print: (arguments_: any, type?: "debug" | "error" | "info" | "log" | "warn") => void;

    progress: (options?: ProgressOptions) => SingleBar;
    /* An `ora`-powered spin. */
    spin: (options?: OraOptions | string) => Ora;

    /* Prints a table of data (usually a 2-dimensional array). */
    table: (head: string[], data: string[][], options?: PrintTableOptions) => void;
    terminalSize: () => {
        height: number;
        width: number;
    };
    truncate: (
        columns: string[],
        options: {
            maxWidth: number;
            position?: "end" | "middle" | "start";
            truncationChar?: string;
        },
    ) => string[];
    wrap: (
        columns: string[],
        options: {
            endColumn: number;
            startColumn: number;
            trimStart?: boolean;
        },
    ) => string[];
}
