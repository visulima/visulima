export type StringAnonymize = { key: string, pattern: RegExp | string, replacement?: string };
export type Anonymize = { deep?: boolean, key: string, pattern?: RegExp | string, replacement?: string };

export type Modifiers = (Anonymize | StringAnonymize | number | string)[];

export type Input = Record<string, unknown> | Record<string, unknown>[];
