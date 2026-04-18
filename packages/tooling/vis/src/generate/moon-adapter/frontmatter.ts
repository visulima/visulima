/**
 * Per-file YAML frontmatter splitter for moon-format templates.
 *
 * Frontmatter is a YAML block delimited by `---` on its own line at
 * the very top of a file. Recognised keys (moon parity):
 *   - `to`: override the destination path (interpolation supported)
 *   - `force`: overwrite without prompting (default false)
 *   - `if`: include the file only when the condition is truthy
 *   - `skip`: skip rendering entirely when truthy
 *
 * Frontmatter is parsed via `@visulima/fs` `readYaml`-compatible YAML
 * dialect. The parser is exposed as a callback to keep this module
 * dependency-free for unit tests.
 */

export interface Frontmatter {
    /** Allow extra keys without losing them on round-trip. */
    [key: string]: unknown;
    /** Overwrite an existing file at the destination without prompting. */
    force?: boolean;
    /** Truthy expression / value gate — file is emitted only when truthy. */
    if?: unknown;
    /** Truthy expression / value gate — file is skipped when truthy. */
    skip?: unknown;
    /** Override destination path; supports `{{ var }}` interpolation. */
    to?: string;
}

export interface SplitResult {
    /** File body with the frontmatter block removed. */
    body: string;
    /** Parsed frontmatter, or `undefined` when the file has no `---` block. */
    frontmatter?: Frontmatter;
}

const FENCE = "---";

/**
 * Split the frontmatter block from the file body.
 * @param source The file contents.
 * @param parseYaml YAML parser callback; pass `(s) => parseYaml(s)` from
 * `@visulima/fs/yaml` at the call site to avoid a runtime dep here.
 */
export const splitFrontmatter = (source: string, parseYaml: (yaml: string) => unknown): SplitResult => {
    // Frontmatter must start at the first character. A leading BOM or
    // newline disqualifies it — moon behaves the same way.
    if (!source.startsWith(`${FENCE}\n`) && !source.startsWith(`${FENCE}\r\n`)) {
        return { body: source };
    }

    const headerEnd = source.indexOf(`\n${FENCE}`, FENCE.length);

    if (headerEnd === -1) {
        return { body: source };
    }

    // Body starts after the closing fence and its terminating newline.
    let bodyStart = headerEnd + 1 + FENCE.length;

    if (source[bodyStart] === "\r") {
        bodyStart += 1;
    }

    if (source[bodyStart] === "\n") {
        bodyStart += 1;
    }

    const headerStart = source.startsWith(`${FENCE}\r\n`) ? FENCE.length + 2 : FENCE.length + 1;
    // Strip CRs so the embedded YAML parser doesn't include them in
    // string values (a closing-fence `\r\n` would otherwise leak into
    // the last line's value).
    const yaml = source.slice(headerStart, headerEnd).replaceAll("\r", "");

    let parsed: unknown;

    try {
        parsed = parseYaml(yaml);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`Failed to parse frontmatter YAML: ${message}`);
    }

    if (parsed === null || parsed === undefined) {
        return { body: source.slice(bodyStart) };
    }

    if (typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new TypeError(`Frontmatter must be a YAML mapping, got ${Array.isArray(parsed) ? "array" : typeof parsed}`);
    }

    return { body: source.slice(bodyStart), frontmatter: parsed as Frontmatter };
};
