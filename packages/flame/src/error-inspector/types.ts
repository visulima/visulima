import type { Editor, Theme } from "../types";

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

export type TemplateOptions = {
    editor?: Editor;
    openInEditorUrl?: string;
    theme?: Theme;
    context?: Record<string, unknown> & {
        request?: RequestContext;
    };
    requestPanel?: RequestPanelOptions;
    content?: ContentPage[];
};