import isRecord from "../../../utils/primitives/is-record";

const ASCII_SPACE: number = " ".codePointAt(0) ?? 32;
const ASCII_COMMA: number = ",".codePointAt(0) ?? 44;
const BASE64_REGEX: RegExp = /^[\d+/A-Z]*={0,2}$/i;

const isNumeric = (input: unknown): boolean => {
    if (typeof input !== "string") {
        return false;
    }

    const parsedNumber = Number.parseFloat(input);

    return !Number.isNaN(parsedNumber) && Number.isFinite(parsedNumber);
};

export class Metadata {
    [key: string]: unknown;

    public psize?: number | string;

    public pname?: string;

    public pfiletype?: string;

    public ptype?: string;

    public pmimeType?: string;

    public pcontentType?: string;

    public ptitle?: string;

    public pfilename?: string;

    public poriginalName?: string;

    public plastModified?: number | string;
}

export const isMetadata = (raw: unknown): raw is Metadata => isRecord(raw);

export const validateKey = (key: string): boolean => {
    if (key.length === 0) {
        return false;
    }

    for (let index = 0; index < key.length; index += 1) {
        const charCodePoint = key.codePointAt(index) as number;

        if (charCodePoint > 127 || charCodePoint === ASCII_SPACE || charCodePoint === ASCII_COMMA) {
            return false;
        }
    }

    return true;
};

export const validateValue = (value: string): boolean => {
    if (value.length % 4 !== 0) {
        return false;
    }

    return BASE64_REGEX.test(value);
};

export const stringifyMetadata = (metadata: NonNullable<Metadata>): string =>
    Object.entries(metadata)
        .map(([key, value]) => {
            if (value === null || value === undefined) {
                return key;
            }

            // Serialize objects and arrays as JSON before base64 encoding
            const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
            const encodedValue = Buffer.from(stringValue, "utf8").toString("base64");

            return `${key} ${encodedValue}`;
        })
        .join(",");

export const parseMetadata = (string_?: string): Metadata => {
    const meta: Record<string, string | undefined> = {};

    if (!string_ || string_.trim().length === 0) {
        throw new Error("Metadata string is not valid");
    }

    for (const pair of string_.split(",")) {
        const tokens = pair.split(" ");
        const [key, value] = tokens;

        if (
            (tokens.length === 1 || tokens.length === 2)
            && validateKey(key as string)
            && (tokens.length === 1 || validateValue(value as string))
            && !((key as string) in meta)
        ) {
            let decodedValue: string | undefined = "";

            if (tokens.length === 1) {
                decodedValue = undefined;
            } else if (value) {
                decodedValue = Buffer.from(value, "base64").toString("utf8");
            }

            // Try to parse as JSON for objects/arrays, then handle primitives
            let parsedValue: unknown = decodedValue;

            if (decodedValue !== undefined) {
                try {
                    parsedValue = JSON.parse(decodedValue);
                } catch {
                    // If not valid JSON, keep as string and handle primitives
                    if (decodedValue === "true") {
                        parsedValue = true;
                    } else if (decodedValue === "false") {
                        parsedValue = false;
                    } else if (isNumeric(decodedValue)) {
                        parsedValue = Number(decodedValue);
                    }
                }
            }

            (meta as Record<string, unknown>)[key as string] = parsedValue;
        } else {
            throw new Error("Metadata string is not valid");
        }
    }

    return meta;
};
