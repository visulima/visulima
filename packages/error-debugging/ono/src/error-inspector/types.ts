import type Editors from "../../../../../shared/utils/editors";
import type { Theme } from "../types";

// Request context and options for the Request panel (server workflows)
export type RequestTimings = {
    elapsedMs?: number;
    end?: number;
    start?: number;
};

export type AppContext = {
    routing?: {
        params?: Record<string, string>;
        query?: Record<string, string | string[]>;
        route?: string;
    };
};

export type UserContext = {
    client?: {
        geo?: unknown;
        ip?: string;
        userAgent?: string;
    };
};

export type GitContext = {
    branch?: string;
    commit?: string;
    dirty?: boolean;
    tag?: string;
};

export type ContentPage = {
    code: {
        html: string;
        script?: string;
    };
    defaultSelected?: boolean;
    id: string;
    name: string;
};

export type TemplateOptions = {
    content?: ContentPage[];
    cspNonce?: string;
    editor?: Editors;
    openInEditorUrl?: string;
    theme?: Theme;
};
