export type RequestMethods =
    | "COPY"
    | "DELETE"
    | "GET"
    | "HEAD"
    | "LINK"
    | "LOCK"
    | "OPTIONS"
    | "PATCH"
    | "POST"
    | "PROPFIND"
    | "PURGE"
    | "PUT"
    | "UNLINK"
    | "UNLOCK"
    | "VIEW";

export interface ParameterGroup {
    name: string;
    params: Parameter[];
}

export interface Parameter {
    enum?: string[];
    format?: string;
    group?: string;
    name: string;
    placeholder?: string;
    properties?: Parameter[];
    required?: boolean;
    type?: string;
}

export type ApiInputValue = boolean[] | File | File[] | number[] | string[] | boolean | number | string | null | undefined;
