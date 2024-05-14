export type StringAnonymize = { key: string; pattern: RegExp | string; replacement?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Anonymize = { deep?: boolean; key: string; pattern?: RegExp | string; replacement?: any };

export type InternalAnonymize = Anonymize & { wildcard?: boolean };

export type Rules = (Anonymize | StringAnonymize | number | string)[];

export type RedactOptions = {
    exclude?: (number | string)[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger?: { debug: (message?: any, ...optionalParameters: any[]) => void };
};
