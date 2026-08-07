/**
 * Source spans for block-mapping entries.
 *
 * Kept in its own module so the document layer can depend on these types
 * without pulling the `State` class into the public declaration graph.
 */

/**
 * Source span of one `key: value` entry inside a block mapping, recorded only
 * when `State.mappingRanges` is set (i.e. by `parseDocument`). The document
 * layer uses these to splice edits into the original text instead of
 * re-serializing, which is what preserves comments and formatting.
 */
interface MappingEntryRange {
    /** Column the key starts at — the indent a sibling entry must match. */
    column: number;

    /** Offset just past the entry's value. */
    end: number;

    key: string;

    /** Offset of the first character of the key. */
    start: number;

    /** Offset of the first character of the value, or -1 when it is empty. */
    valueStart: number;
}

/** Block mappings in a parse, keyed by the object each one produced. */
type MappingRanges = WeakMap<object, MappingEntryRange[]>;

export type { MappingEntryRange, MappingRanges };
