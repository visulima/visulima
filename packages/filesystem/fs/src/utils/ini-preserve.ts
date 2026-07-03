import type { IniLineEnding } from "../types";

type LineKind = "blank" | "comment" | "header" | "key" | "unknown";
type ParsedLine = { key?: string; kind: LineKind; raw: string; section?: string };
type KeyValueParts = { after: string; before: string; indent: string; key: string; trailing: string; value: string };

const BLANK_OR_COMMENT_REGEX = /^\s*(?:[;#].*)?$/;
const SECTION_HEADER_REGEX = /^\s*\[([^\]]+)\]\s*$/;
const LINE_SPLIT_REGEX = /\r?\n/;
const TRAILING_EOL_REGEX = /\r?\n$/;
const ENTRY_REGEX = /^[^=]+=/;

const isWhitespace = (character: string | undefined): boolean => character === " " || character === "\t";

const splitLeadingWhitespace = (source: string): { indent: string; rest: string } => {
    let index = 0;

    while (index < source.length && isWhitespace(source[index])) {
        index += 1;
    }

    return { indent: source.slice(0, index), rest: source.slice(index) };
};

const splitTrailingWhitespace = (source: string): { rest: string; trailing: string } => {
    let index = source.length;

    while (index > 0 && isWhitespace(source[index - 1])) {
        index -= 1;
    }

    return { rest: source.slice(0, index), trailing: source.slice(index) };
};

const parseKeyValue = (raw: string): KeyValueParts | undefined => {
    const equalsIndex = raw.indexOf("=");

    if (equalsIndex === -1) {
        return undefined;
    }

    const leftSide = raw.slice(0, equalsIndex);
    const rightSide = raw.slice(equalsIndex + 1);

    const { indent, rest: keyAndBefore } = splitLeadingWhitespace(leftSide);
    const { rest: key, trailing: before } = splitTrailingWhitespace(keyAndBefore);

    if (key === "" || key.startsWith(";") || key.startsWith("#") || key.startsWith("[")) {
        return undefined;
    }

    const { indent: after, rest: valueAndTrailing } = splitLeadingWhitespace(rightSide);
    const { rest: value, trailing } = splitTrailingWhitespace(valueAndTrailing);

    return { after, before, indent, key, trailing, value };
};

const countStyleMatches = (text: string): { spaced: number; unspaced: number } => {
    let spaced = 0;
    let unspaced = 0;

    for (const line of text.split(LINE_SPLIT_REGEX)) {
        if (BLANK_OR_COMMENT_REGEX.test(line) || SECTION_HEADER_REGEX.test(line)) {
            continue;
        }

        const parts = parseKeyValue(line);

        if (!parts) {
            continue;
        }

        if (parts.before === " " && parts.after === " ") {
            spaced += 1;
        } else if (parts.before === "" && parts.after === "") {
            unspaced += 1;
        }
    }

    return { spaced, unspaced };
};

const getSection = (data: Record<string, unknown> | undefined, section: string | undefined): Record<string, unknown> | undefined => {
    if (!data) {
        return undefined;
    }

    if (section === undefined) {
        return data;
    }

    let cursor: unknown = data;

    for (const part of section.split(".")) {
        if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
            cursor = (cursor as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }

    return cursor && typeof cursor === "object" && !Array.isArray(cursor) ? (cursor as Record<string, unknown>) : undefined;
};

const extractValueToken = (serialized: string, key: string): string => {
    for (const candidate of serialized.split(LINE_SPLIT_REGEX)) {
        if (!candidate || candidate.startsWith("[")) {
            continue;
        }

        const match = ENTRY_REGEX.exec(candidate);

        if (!match) {
            continue;
        }

        const candidateKey = candidate.slice(0, match[0].length - 1).trim();

        if (candidateKey === key || candidateKey === `${key}[]`) {
            return candidate.slice(match[0].length).trimStart();
        }
    }

    return "";
};

const classifyLine = (raw: string, currentSection: string | undefined): { line: ParsedLine; nextSection: string | undefined } => {
    if (raw.trim() === "") {
        return { line: { kind: "blank", raw, section: currentSection }, nextSection: currentSection };
    }

    const trimmed = raw.trimStart();

    if (trimmed.startsWith(";") || trimmed.startsWith("#")) {
        return { line: { kind: "comment", raw, section: currentSection }, nextSection: currentSection };
    }

    const headerMatch = SECTION_HEADER_REGEX.exec(raw);

    if (headerMatch) {
        const nextSection = headerMatch[1];

        return { line: { kind: "header", raw, section: nextSection }, nextSection };
    }

    const parts = parseKeyValue(raw);

    if (parts) {
        return { line: { key: parts.key, kind: "key", raw, section: currentSection }, nextSection: currentSection };
    }

    return { line: { kind: "unknown", raw, section: currentSection }, nextSection: currentSection };
};

const parseLines = (original: string): ParsedLine[] => {
    const stripped = original.replace(TRAILING_EOL_REGEX, "");
    const rawLines = stripped.split(LINE_SPLIT_REGEX);
    const parsed: ParsedLine[] = [];
    let currentSection: string | undefined;

    for (const raw of rawLines) {
        const { line, nextSection } = classifyLine(raw, currentSection);

        parsed.push(line);
        currentSection = nextSection;
    }

    return parsed;
};

const renderChangedKey = (line: ParsedLine, newValue: unknown, freshStringify: (data: Record<string, unknown>) => string): string => {
    const parts = parseKeyValue(line.raw);

    if (!parts || !line.key) {
        return line.raw;
    }

    const serialized = freshStringify({ [line.key]: newValue });
    const valueToken = extractValueToken(serialized, line.key);

    return `${parts.indent}${parts.key}${parts.before}=${parts.after}${valueToken}${parts.trailing}`;
};

const collectSections = (data: Record<string, unknown>, prefix: string[] = []): string[] => {
    const sections: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const path = [...prefix, key];

            sections.push(path.join("."), ...collectSections(value as Record<string, unknown>, path));
        }
    }

    return sections;
};

const pickScalars = (data: Record<string, unknown>, skip: Set<string>): Record<string, unknown> => {
    const scalars: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
        if (skip.has(key) || (value && typeof value === "object" && !Array.isArray(value))) {
            continue;
        }

        scalars[key] = value;
    }

    return scalars;
};

const appendSerialized = (outputLines: string[], serialized: string): void => {
    const added: string[] = [];

    for (const line of serialized.split(LINE_SPLIT_REGEX)) {
        if (line !== "") {
            added.push(line);
        }
    }

    if (added.length > 0) {
        outputLines.push(...added);
    }
};

type ProcessKeyContext = {
    line: ParsedLine;
    markWritten: (section: string | undefined, key: string) => void;
    nextData: Record<string, unknown>;
    oldData: Record<string, unknown>;
    renderValue: (line: ParsedLine, value: unknown) => string;
};

const processKeyLine = (context: ProcessKeyContext): string | undefined => {
    const { line, markWritten, nextData, oldData, renderValue } = context;

    if (!line.key) {
        return line.raw;
    }

    const newSection = getSection(nextData, line.section);

    if (!newSection || !(line.key in newSection)) {
        return undefined;
    }

    markWritten(line.section, line.key);

    const oldSection = getSection(oldData, line.section);
    const oldValue = oldSection?.[line.key];
    const newValue = newSection[line.key];

    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        return line.raw;
    }

    return renderValue(line, newValue);
};

const flushAdditions = (
    outputLines: string[],
    section: string | undefined,
    writtenPerSection: Map<string | undefined, Set<string>>,
    nextData: Record<string, unknown>,
    freshStringify: (data: Record<string, unknown>) => string,
): void => {
    const sectionData = getSection(nextData, section);

    if (!sectionData) {
        return;
    }

    const written = writtenPerSection.get(section) ?? new Set<string>();
    const additions = pickScalars(sectionData, written);

    if (Object.keys(additions).length === 0) {
        return;
    }

    appendSerialized(outputLines, freshStringify(additions));
};

const flushNewSections = (
    outputLines: string[],
    parsedLines: ParsedLine[],
    nextData: Record<string, unknown>,
    freshStringify: (data: Record<string, unknown>, section?: string) => string,
): void => {
    const existingSections = new Set<string>(parsedLines.filter((line) => line.kind === "header" && line.section).map((line) => line.section as string));

    for (const section of collectSections(nextData)) {
        if (existingSections.has(section)) {
            continue;
        }

        const sectionData = getSection(nextData, section);

        if (!sectionData || Object.keys(sectionData).length === 0) {
            continue;
        }

        const scalars = pickScalars(sectionData, new Set());

        if (Object.keys(scalars).length === 0) {
            continue;
        }

        appendSerialized(outputLines, freshStringify(scalars, section));
    }
};

export type DetectedIniStyle = {
    eol: IniLineEnding;
    whitespace: boolean;
};

/**
 * Detect whitespace and line-ending style from existing INI text.
 * @param text The original INI source text.
 * @returns The detected style.
 */
export const detectIniStyle = (text: string): DetectedIniStyle => {
    const eol: IniLineEnding = text.includes("\r\n") ? "\r\n" : "\n";
    const { spaced, unspaced } = countStyleMatches(text);

    return { eol, whitespace: spaced > 0 && spaced >= unspaced };
};

/**
 * Merge a newly serialized INI value into an existing source, preserving original lines
 * (including start/end whitespace and inline comments) for unchanged keys.
 * Blank lines, comments, and section headers are kept verbatim. `key = value` lines with
 * unchanged values are kept verbatim. Changed values have only the value portion rewritten.
 * Removed keys are dropped, added keys are appended at the end of their section, and
 * entirely new sections are appended after all existing content.
 * @param original The original INI source string.
 * @param oldData The parsed representation of `original`.
 * @param nextData The new data to write.
 * @param freshStringify A callback that serializes a partial value via `ini.stringify`.
 * @param style Detected whitespace and EOL style.
 * @returns The merged INI source string.
 */
export const mergeIniPreservingLines = (
    original: string,
    oldData: Record<string, unknown>,
    nextData: Record<string, unknown>,
    freshStringify: (data: Record<string, unknown>, section?: string) => string,
    style: DetectedIniStyle,
): string => {
    const { eol } = style;
    const endsWithEol = TRAILING_EOL_REGEX.test(original);
    const parsedLines = parseLines(original);
    const writtenPerSection = new Map<string | undefined, Set<string>>();
    const sectionLastIndex = new Map<string | undefined, number>();

    for (const [index, line] of parsedLines.entries()) {
        if (line.kind !== "blank") {
            sectionLastIndex.set(line.section, index);
        }
    }

    const markWritten = (section: string | undefined, key: string): void => {
        let set = writtenPerSection.get(section);

        if (!set) {
            set = new Set();
            writtenPerSection.set(section, set);
        }

        set.add(key);
    };

    const renderValue = (line: ParsedLine, value: unknown): string => renderChangedKey(line, value, freshStringify);
    const outputLines: string[] = [];

    for (const [index, line] of parsedLines.entries()) {
        if (line.kind === "key") {
            const rendered = processKeyLine({ line, markWritten, nextData, oldData, renderValue });

            if (rendered !== undefined) {
                outputLines.push(rendered);
            }

            continue;
        }

        outputLines.push(line.raw);

        if (sectionLastIndex.get(line.section) === index) {
            flushAdditions(outputLines, line.section, writtenPerSection, nextData, freshStringify);
        }
    }

    flushNewSections(outputLines, parsedLines, nextData, freshStringify);

    const joined = outputLines.join(eol);

    return endsWithEol && !joined.endsWith(eol) ? `${joined}${eol}` : joined;
};
