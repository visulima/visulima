/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * The document layer: parsing that reports diagnostics instead of throwing, and
 * edits that splice the original source rather than re-serializing it.
 *
 * Not re-serializing is the whole point. A round-trip through `parse` +
 * `stringify` loses every comment, blank line and key-order choice in the file;
 * splicing only the bytes an edit touches leaves the rest byte-identical, which
 * is what makes this safe to run over a hand-maintained config file.
 */

import type { YAMLParseError, YAMLWarning } from "./errors";
import { YAMLStringifyError } from "./errors";
import { createNode, isMap, toJS as nodeToJS, YAMLMap } from "./nodes/nodes";
import { dump } from "./parser/dumper";
import { applyReviver } from "./parser/loader";
import type { MappingEntryRange, MappingRanges } from "./parser/ranges";
import type { StringifyOptions } from "./types";

/** A pending source edit, applied by `toString`. */
interface Edit {
    end: number;
    start: number;
    text: string;
}

/**
 * Walk `end` back over trailing whitespace.
 *
 * A node's recorded end runs to wherever the scanner stopped, which is past the
 * spaces before a trailing comment and past the blank lines at end of file.
 * Splicing at the raw end would eat the space in front of `# comment` and drop
 * the file's final newline; splicing at the trimmed end leaves both in place.
 */
const WHITESPACE = /\s/;

const trimTrailingSpace = (source: string, end: number): number => {
    let index = end;

    while (index > 0 && WHITESPACE.test(source[index - 1]!)) {
        index -= 1;
    }

    return index;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Render a value as the right-hand side of a `key:` entry.
 *
 * A scalar stays inline (`key: value`); a collection moves onto following lines
 * indented under the key, which is the shape a block mapping expects.
 */
const renderValue = (value: unknown, indent: number, options: StringifyOptions): string => {
    const serialized = dump(value, options).trimEnd();

    if (!serialized.includes("\n") && !isRecord(value) && !Array.isArray(value)) {
        return ` ${serialized}`;
    }

    const pad = " ".repeat(indent + (options.indent ?? 2));

    const indented = serialized.split("\n").map((line) => {
        if (line === "") {
            return line;
        }

        return pad + line;
    });

    return `\n${indented.join("\n")}`;
};

/**
 * A parsed YAML document plus the diagnostics from reading it.
 *
 * Unlike `parse`, constructing a document never throws for malformed input —
 * the failure is reported in {@link YAMLDocument.errors} and `contents` is
 * `null`. That lets a caller report the problem in its own words, and lets
 * `parseAllDocuments` keep going after one bad document.
 */
class YAMLDocument {
    /** Parse errors. Empty when the document read cleanly. */
    public readonly errors: YAMLParseError[];

    /** Non-fatal notices raised while reading. */
    public readonly warnings: YAMLWarning[];

    /** The parsed value, or `null` when `errors` is non-empty. */
    public contents: unknown;

    readonly #ranges: MappingRanges;

    readonly #edits: Edit[] = [];

    readonly #stringifyOptions: StringifyOptions;

    /**
     * Memoised `toJS` result backing the read accessors, boxed so that a
     * legitimately `undefined` document is still a cache hit. Cleared by every
     * edit.
     */
    #converted: { value: unknown } | undefined;

    #source: string;

    public constructor(
        source: string,
        result: { contents: unknown; errors: YAMLParseError[]; warnings: YAMLWarning[] },
        ranges: MappingRanges,
        stringifyOptions: StringifyOptions = {},
    ) {
        this.#source = source;
        this.#ranges = ranges;
        this.#stringifyOptions = stringifyOptions;
        this.contents = result.contents;
        this.errors = result.errors;
        this.warnings = result.warnings;
    }

    /**
     * The document's value as plain JavaScript, resolving aliases and merge
     * keys.
     *
     * `reviver` runs over the converted value the way `JSON.parse`'s does. It
     * belongs here rather than on the parse options because it rewrites plain
     * values, and the document holds a node tree until this point.
     */
    public toJS(options?: { reviver?: (key: unknown, value: unknown) => unknown }): unknown {
        const value = nodeToJS(this.contents);

        return options?.reviver ? applyReviver({ "": value }, "", value, options.reviver) : value;
    }

    /** Alias of {@link YAMLDocument.toJS}, so `JSON.stringify` works directly. */
    public toJSON(): unknown {
        return this.toJS();
    }

    /**
     * Value at `path`, or `undefined` if any segment is missing.
     *
     * This reads from the converted value rather than walking the node tree.
     * Walking nodes cannot see through an `Alias` or a merge key — both are
     * resolved by the conversion, against an anchor map that only exists when
     * the walk starts at the root — so `get("b")` on `a: &amp;x 1\nb: *x` used to
     * come back `undefined`. The conversion is memoised and dropped whenever an
     * edit changes the tree.
     */
    public getIn(path: ReadonlyArray<number | string>): unknown {
        this.#converted ??= { value: nodeToJS(this.contents) };

        let current: unknown = this.#converted.value;

        for (const segment of path) {
            if (current === null || (typeof current !== "object" && typeof current !== "string")) {
                return undefined;
            }

            current = (current as Record<string, unknown>)[segment];
        }

        return current;
    }

    /** Value of a top-level key. */
    public get(key: number | string): unknown {
        return this.getIn([key]);
    }

    /** Whether `path` resolves to something present in the document. */
    public hasIn(path: ReadonlyArray<number | string>): boolean {
        return this.getIn(path) !== undefined;
    }

    /** Whether a top-level key is present. */
    public has(key: number | string): boolean {
        return this.hasIn([key]);
    }

    /**
     * Set the value at `path`, creating any missing intermediate mappings.
     *
     * The edit is a source splice, so comments, blank lines and key order
     * elsewhere in the file survive untouched. Only block mappings can be
     * edited: a path that runs through a flow collection (`{a: 1}`) or a
     * sequence throws, because there is no unambiguous place to splice.
     */
    public setIn(path: ReadonlyArray<number | string>, value: unknown): void {
        if (path.length === 0) {
            throw new YAMLStringifyError("setIn requires a non-empty path");
        }

        const keys = path.map(String);

        // Walk as far down the existing structure as the path allows.
        let container: YAMLMap = this.#rootMapping();
        let depth = 0;

        while (depth < keys.length - 1) {
            const next = container.get(keys[depth]!, true);

            if (!isMap(next)) {
                break;
            }

            container = next;
            depth += 1;
        }

        const entries = this.#ranges.get(container) ?? [];
        const remaining = keys.slice(depth);

        // An empty or comment-only document has a root mapping with no entries
        // and therefore nothing to anchor an insert to; append at the end of the
        // source instead so a config file can be created from nothing.
        if (entries.length === 0 && container !== this.contents) {
            throw new YAMLStringifyError(`cannot edit ${JSON.stringify(path)}: the target is not a block mapping`);
        }

        const existing = remaining.length === 1 ? entries.find((entry) => entry.key === remaining[0]) : undefined;

        if (existing) {
            this.#replaceValue(existing, value);
        } else {
            this.#insertEntry(entries, remaining, value);
        }

        // Keep the parsed tree consistent with the text we just edited.
        let cursor: YAMLMap = container;

        for (const key of remaining.slice(0, -1)) {
            const created = new YAMLMap();

            cursor.set(createNode(key), created);
            cursor = created;
        }

        cursor.set(createNode(remaining.at(-1)!), createNode(value));

        this.#converted = undefined;
    }

    /** Set a top-level key. */
    public set(key: number | string, value: unknown): void {
        this.setIn([key], value);
    }

    /** The document source with every pending edit applied. */
    public toString(): string {
        if (this.#edits.length === 0) {
            return this.#source;
        }

        // Apply back-to-front so earlier offsets stay valid.
        const ordered = this.#edits.toSorted((a, b) => b.start - a.start);

        let output = this.#source;

        for (const edit of ordered) {
            output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
        }

        this.#source = output;
        this.#edits.length = 0;

        return output;
    }

    #rootMapping(): YAMLMap {
        // An empty or comment-only document has no contents yet; treat it as an
        // empty mapping so the first `setIn` can create one.
        if (this.contents === null || this.contents === undefined) {
            const root = new YAMLMap();

            this.contents = root;
            this.#converted = undefined;

            return root;
        }

        if (!isMap(this.contents)) {
            throw new YAMLStringifyError("cannot edit a document whose root is not a mapping");
        }

        return this.contents;
    }

    #replaceValue(entry: MappingEntryRange, value: unknown): void {
        const rendered = renderValue(value, entry.column, this.#stringifyOptions);
        // `valueStart - 1` is the colon; replacing from there covers the
        // separating space, so an inline value and a block value both land
        // correctly.
        const start = entry.valueStart > 0 ? entry.valueStart - 1 : entry.end;
        const end = Math.max(start, trimTrailingSpace(this.#source, entry.end));

        this.#edits.push({ end, start, text: rendered });
    }

    #insertEntry(entries: MappingEntryRange[], keys: string[], value: unknown): void {
        let anchor: MappingEntryRange | undefined;

        for (const entry of entries) {
            if (anchor === undefined || entry.end > anchor.end) {
                anchor = entry;
            }
        }

        const indent = anchor?.column ?? 0;

        // Nest the remaining path segments under one another.
        let text = "";

        for (const [index, key] of keys.entries()) {
            const pad = " ".repeat(indent + index * (this.#stringifyOptions.indent ?? 2));

            text += `\n${pad}${key}:`;

            if (index === keys.length - 1) {
                text += renderValue(value, indent + index * (this.#stringifyOptions.indent ?? 2), this.#stringifyOptions);
            }
        }

        const at = trimTrailingSpace(this.#source, anchor?.end ?? this.#source.length);

        // With no anchor there is no preceding entry, so the leading newline the
        // loop added would open the file with a blank line.
        let body = at === 0 ? text.slice(1) : text;

        // Nothing follows the insert point in a file that never ended in a
        // newline, so add the one a YAML file is expected to end with.
        if (!this.#source.slice(at).includes("\n")) {
            body += "\n";
        }

        this.#edits.push({ end: at, start: at, text: body });
    }
}

export { YAMLDocument };

export { type ParseOptions } from "./types";
