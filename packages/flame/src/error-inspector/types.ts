import type { Editor, Theme } from "../types";

// Request context and options for the Request panel (server workflows)
export type RequestTimings = {
    start?: number;
    end?: number;
    elapsedMs?: number;
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
    content?: ContentPage[];
};
