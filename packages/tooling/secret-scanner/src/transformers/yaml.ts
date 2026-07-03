// YAML block-scalar collapser (detect-secrets parity).
//
// Port of `detect_secrets/transformers/yaml.py` reduced to the one case that
// actually changes recall: multi-line block scalars (`|` literal, `>` folded).
// A scalar shaped like:
//
//   "token": |
//       <base64 segment 1>
//       <base64 segment 2>
//
// becomes a single-line proxy:
//
//   "token": "<segment1><segment2>"
//   <blank>
//   <blank>
//   <blank>
//
// Line count is preserved deliberately so line numbers in findings map 1:1 to
// the original file — no side-band source map required. The first blank line
// carries the same line number as the original `|` line.
//
// Scope: only `key: |` / `key: >` at any indent level. Sequence-entry block
// scalars (`- |`) are left untouched — smaller hit rate, larger edge-case
// surface, not worth carrying without real demand. Flow-style mappings are
// single-line already and don't need transformation.

interface BlockScalarHeader {
    indent: string;
    keySegment: string;
}

// Simplified to a single character-class key — quoted (`"foo"`, `'foo'`) and
// unquoted YAML keys both satisfy `[^\s:#]+` since the surrounding quotes are
// themselves allowed characters. Keeps the regex cheap and lint-clean.
const BLOCK_SCALAR_HEADER = /^(?<indent>[\t ]*)(?<key>[^\s#:]+)[\t ]*:[\t ]*[|>][+-]?\d*[\t ]*(?:#.*)?$/u;

const LINE_SPLIT = /\r?\n/u;

const SPACE_CODE_POINT = 0x20;
const TAB_CODE_POINT = 0x09;

const parseHeader = (line: string): BlockScalarHeader | undefined => {
    const match = BLOCK_SCALAR_HEADER.exec(line);

    if (!match?.groups) {
        return undefined;
    }

    const indent = match.groups["indent"] ?? "";
    const key = match.groups["key"] ?? "";

    return { indent, keySegment: `${indent}${key}` };
};

/** Tab is treated as 1 column: we compare length, not visual width. */
const isBlockScalarBody = (line: string, headerIndentLength: number): boolean => {
    if (line.trim() === "") {
        return true;
    }

    let leading = 0;

    while (leading < line.length) {
        const cp = line.codePointAt(leading);

        if (cp !== SPACE_CODE_POINT && cp !== TAB_CODE_POINT) {
            break;
        }

        leading += 1;
    }

    return leading > headerIndentLength;
};

const escapeQuoted = (value: string): string => value.replaceAll("\\", String.raw`\\`).replaceAll('"', String.raw`\"`);

/**
 * Reconstruct the per-line separator sequence (`\n`, `\r\n`, or `""` on the
 * trailing segment) from the original content. `split(/\r?\n/)` drops the
 * separator info; we recover it by walking the raw string once so re-joined
 * output preserves the original line-ending style.
 */
const extractLineSeparators = (content: string, expectedLines: number): string[] => {
    const separators: string[] = [];
    let cursor = 0;

    while (cursor < content.length) {
        const nl = content.indexOf("\n", cursor);

        if (nl === -1) {
            separators.push("");
            break;
        }

        separators.push(content[nl - 1] === "\r" ? "\r\n" : "\n");
        cursor = nl + 1;
    }

    while (separators.length < expectedLines) {
        separators.push("");
    }

    return separators;
};

/**
 * Collapse YAML block scalars into single-line `key: "value"` proxies.
 *
 * Non-YAML-aware: we scan line-by-line with a single regex and use indentation
 * depth to delimit the body. Sufficient for the real-world case that matters —
 * a credential buried in an indented `|`-scalar — and avoids pulling a full
 * YAML parser into the hot path.
 * @param content UTF-8 text of a YAML document.
 * @returns Text with the same line count as the input; original lines not
 * inside a block scalar are returned verbatim.
 */
export const transformYamlBlockScalars = (content: string): string => {
    const lines = content.split(LINE_SPLIT);
    const separators = extractLineSeparators(content, lines.length);
    const output: string[] = [];

    let index = 0;

    while (index < lines.length) {
        const line = lines[index] ?? "";
        const header = parseHeader(line);

        if (!header) {
            output.push(line);
            index += 1;

            continue;
        }

        const bodyLines: string[] = [];
        let cursor = index + 1;

        while (cursor < lines.length && isBlockScalarBody(lines[cursor] ?? "", header.indent.length)) {
            bodyLines.push((lines[cursor] ?? "").trim());
            cursor += 1;
        }

        if (bodyLines.length === 0) {
            output.push(line);
            index += 1;

            continue;
        }

        const collapsedValue = bodyLines.filter((entry) => entry !== "").join("");

        output.push(`${header.keySegment}: "${escapeQuoted(collapsedValue)}"`);

        for (let i = 0; i < bodyLines.length; i += 1) {
            output.push("");
        }

        index = cursor;
    }

    return output.map((out, i) => `${out}${separators[i] ?? ""}`).join("");
};
