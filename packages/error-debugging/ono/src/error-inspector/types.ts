import type Editors from "../../../../../shared/utils/editors";
import type { Theme } from "../types";

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
