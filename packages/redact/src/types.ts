export type StringAnonymize = { key: string, pattern: RegExp | string };
export type Anonymize = { deep?: boolean, key: string, pattern?: RegExp | string };

export type Modifiers = (Anonymize | StringAnonymize | string)[];

export type Input = Record<string, unknown> | Record<string, unknown>[];
