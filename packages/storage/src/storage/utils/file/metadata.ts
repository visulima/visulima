import isRecord from "../../../utils/primitives/is-record";

const ASCII_SPACE = " ".codePointAt(0);
const ASCII_COMMA = ",".codePointAt(0);
const BASE64_REGEX = /^[\d+/A-Z]*={0,2}$/i;

export class Metadata {
    [key: string]: any;

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

export const validateKey = (key: string) => {
    if (key.length === 0) {
        return false;
    }

    for (let index = 0; index < key.length; ++index) {
        const charCodePoint = key.codePointAt(index) as number;

        if (charCodePoint > 127 || charCodePoint === ASCII_SPACE || charCodePoint === ASCII_COMMA) {
            return false;
        }
    }

    return true;
};

export const validateValue = (value: string) => {
    if (value.length % 4 !== 0) {
        return false;
    }

    return BASE64_REGEX.test(value);
};

export const stringifyMetadata = (metadata: NonNullable<Metadata>): string =>
    Object.entries(metadata)
        .map(([key, value]) => {
            if (value === null) {
                return key;
            }

            const encodedValue = Buffer.from(String(value), "utf8").toString("base64");

            return `${key} ${encodedValue}`;
        })
        .join(",");

export const parseMetadata = (string_?: string): Metadata => {
    const meta: Record<string, string | null> = {};

    if (!string_ || string_.trim().length === 0) {
        throw new Error("Metadata string is not valid");
    }

    for (const pair of string_.split(",")) {
        const tokens = pair.split(" ");
        const [key, value] = tokens;

        if ((tokens.length === 1 || tokens.length === 2) && validateKey(key as string) && validateValue(value as string) && !((key as string) in meta)) {
            const decodedValue = value ? Buffer.from(value, "base64").toString("utf8") : null;

            meta[key as string] = decodedValue;
        } else {
            throw new Error("Metadata string is not valid");
        }
    }

    return meta;
};
