export type Solution = {
    body: string;
    header?: string;
};

export type Theme = "dark" | "light";
export enum Editor {
    "android-studio" = "Android Studio",
    atom = "Atom",
    emacs = "GNU Emacs",
    emacsforosx = "GNU Emacs for Mac OS X",
    intellij = "IntelliJ IDEA",
    nano = "GNU nano",
    neovim = "NeoVim",
    sublime = "SublimeText",
    // "phpstorm" = "PHPStorm", @TODO: Add PHPStorm into https://github.com/sindresorhus/env-editor
    textmate = "TextMate",
    vim = "Vim",
    vscode = "Visual Studio Code",
    vscodium = "VSCodium",
    webstorm = "WebStorm",
    xcode = "Xcode",
}

export type SolutionFinderFile = {
    file: string;
    language?: string;
    line: number;
    snippet?: string | undefined;
};

export type SolutionFinder = {
    handle: (error: any, file: SolutionFinderFile) => Promise<Solution | undefined>;
    name: string;
    priority: number;
};

export type SolutionError = Error & {
    hint?: Solution;
};

// Request context and options for the Request panel (server workflows)
export type RequestTimings = {
    start?: number;
    end?: number;
    elapsedMs?: number;
};

export type RequestContext = {
    method?: string;
    url?: string;
    status?: number;
    route?: string;
    timings?: RequestTimings;
    headers?: Record<string, string | string[]>;
    body?: unknown;
    cookies?: Record<string, string | string[]>;
    session?: unknown;
};

export type AppContext = {
    routing?: {
        route?: string;
        params?: Record<string, string>;
        query?: Record<string, string | string[]>;
    };
};

export type UserContext = {
    client?: {
        ip?: string;
        userAgent?: string;
        geo?: unknown;
    };
};

export type GitContext = {
    branch?: string;
    commit?: string;
    tag?: string;
    dirty?: boolean;
};

export type RequestPanelOptions = {
    headerAllowlist?: string[];
    headerDenylist?: string[];
    totalCapBytes?: number; // hard cap for showing a full copy button
    previewBytes?: number; // size of the pretty preview
    maskValue?: string; // replacement for sensitive values
};

export type ContentPage = {
    id: string;
    name: string;
    defaultSelected?: boolean;
    code: {
        html: string;
        script?: string;
    };
};

export type DisplayerOptions = Partial<{
    editor: Editor;
    openInEditorUrl?: string;
    theme: Theme;
    context?: Record<string, unknown> & {
        request?: RequestContext;
    };
    requestPanel?: RequestPanelOptions;
    content?: ContentPage[];
}>;
