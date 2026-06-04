export type StringAnonymize = { key: string; pattern: RegExp | string; replacement?: string };
export type Anonymize = { deep?: boolean; key: string; pattern?: RegExp | string; replacement?: unknown };

export type InternalAnonymize = Anonymize & { compiledPattern?: RegExp; wildcard?: boolean };

export type Rules = (Anonymize | StringAnonymize | number | string)[];

export type RedactOptions = {
    exclude?: (number | string)[];
    logger?: { debug: (message?: unknown, ...optionalParameters: unknown[]) => void };
};
