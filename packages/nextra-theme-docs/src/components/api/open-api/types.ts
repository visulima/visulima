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

export type ApiInputValue =
    | ArrayBuffer
    | boolean[]
    | File
    | File[]
    | number[]
    | Record<string, unknown>
    | string[]
    | boolean
    | number
    | string
    | null
    | undefined;

export interface Server {
    description?: string;
    url: string;
}
