export type StringAnonymize = { key: string, pattern: RegExp | string, replacement?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Anonymize = { deep?: boolean, key: string, pattern?: RegExp | string, replacement?: any };

export type Modifiers = (Anonymize | StringAnonymize | number | string)[];

export type Input = Record<string, unknown> | Record<string, unknown>[];
