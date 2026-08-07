/*
 * Part of the hand-written, performance-sensitive parser. The file-scope
 * disables mirror `loader.ts`: a single mutable `State` cursor is threaded
 * through every function (parameter reassignment), and scanning is done with
 * `charCodeAt` against a `0` EOF sentinel.
 */
/* eslint-disable no-param-reassign */
/* eslint-disable unicorn/no-null */

/**
 * The parser's mutable cursor and the primitives that save, restore and fail on
 * it. Kept apart from the scanners and the composer so those files describe
 * grammar rather than bookkeeping; nothing here knows about YAML's syntax.
 */

import { YAMLParseError, YAMLWarning } from "../errors";
import type { ScalarStyle } from "../nodes/nodes";
import type { ScalarResolver } from "../schema/schemas";
import { selectScalarResolver } from "../schema/schemas";
import type { TagRegistry } from "../schema/tags";
import { buildTagRegistry } from "../schema/tags";
import type { ParseOptions } from "../types";
import type { LineCounter } from "./line-counter";
import type { MappingRanges } from "./ranges";

/** The three node shapes the composer distinguishes. */
type NodeKind = "mapping" | "scalar" | "sequence";

/** The mutable parser cursor + accumulators. */
class State {
    public input: string;

    public length: number;

    public position = 0;

    public line = 0;

    public lineStart = 0;

    public lineIndent = 0;

    // Position of the first tab in the current line's leading white space, or
    // -1. Tabs are illegal as block indentation; block collections consult this
    // to reject them. Reset on every line break.
    public firstTabInLine = -1;

    // Line of a `---` marker that carried content on the same line, or -1. In
    // strict mode a block collection whose first entry sits on this line is
    // rejected (`--- a: b`). Reset once the document's top node is composed.
    public documentMarkerLine = -1;

    public documents: unknown[] = [];

    public tag: string | null = null;

    public anchor: string | null = null;

    public kind: NodeKind | null = null;

    public result: unknown = null;

    public anchorMap = new Map<string, unknown>();

    public tagMap = new Map<string, string>();

    public aliasCount = 0;

    /** Current `composeNode` recursion depth; bounded by `options.maxDepth`. */
    public depth = 0;

    /**
     * Block-mapping source spans, or `null` to skip recording them. Only
     * `parseDocument` turns this on — the plain `parse` path never pays for it.
     */
    public mappingRanges: MappingRanges | null = null;

    /**
     * Scalar resolution for the active schema. Chosen once per parse so the
     * per-scalar path stays a single indirect call.
     */
    public readonly resolveScalar: ScalarResolver;

    /**
     * Build a `Scalar`/`YAMLMap`/`YAMLSeq` tree instead of native values.
     * Off for `parse`, which is what keeps its single-pass path fast.
     */
    public readonly nodes: boolean;

    /** Line-break offsets collector, when the caller supplied one. */
    public readonly lineCounter: LineCounter | undefined;

    /** Style of the scalar just read, used to annotate its node. */
    public scalarStyle: ScalarStyle | undefined = undefined;

    /** Custom scalar tags for this parse, or undefined when none were given. */
    public readonly tags: TagRegistry | undefined;

    public readonly options: ParseOptions & Required<Pick<ParseOptions, "duplicateKeys" | "maxAliasCount" | "maxDepth" | "preventProtoPollution" | "strict">>;

    public constructor(input: string, options: ParseOptions) {
        this.input = input;
        this.length = input.length;
        // Spread first, then apply the defaults with `??`. The other order lets a
        // key that is present but `undefined` — the shape you get from
        // `parse(src, { maxAliasCount: config.maxAliasCount })` — overwrite the
        // default, silently disabling the alias limit, the duplicate-key error,
        // strict mode and the prototype-pollution guard.
        this.options = {
            ...options,
            duplicateKeys: options.duplicateKeys ?? "error",
            maxAliasCount: options.maxAliasCount ?? 100,
            maxDepth: options.maxDepth ?? 1000,
            preventProtoPollution: options.preventProtoPollution ?? true,
            strict: options.strict ?? true,
        };
        this.resolveScalar = selectScalarResolver(this.options.schema, this.options.version, this.options.intAsBigInt);
        this.tags = buildTagRegistry(this.options.customTags);
        this.nodes = options.nodes ?? false;
        this.lineCounter = options.lineCounter;
    }
}

interface Snapshot {
    anchor: string | null;
    firstTabInLine: number;
    kind: NodeKind | null;
    line: number;
    lineIndent: number;
    lineStart: number;
    position: number;
    result: unknown;
    tag: string | null;
}

const snapshotState = (state: State): Snapshot => {
    return {
        anchor: state.anchor,
        firstTabInLine: state.firstTabInLine,
        kind: state.kind,
        line: state.line,
        lineIndent: state.lineIndent,
        lineStart: state.lineStart,
        position: state.position,
        result: state.result,
        tag: state.tag,
    };
};

const restoreState = (state: State, snapshot: Snapshot): void => {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
};

/**
 * State that a speculative parse must be able to undo, beyond the cursor that
 * `Snapshot` already covers: anchors registered by the attempt and the alias
 * budget it consumed.
 */
interface SpeculationUndo {
    aliasCount: number;
    anchorMap: Map<string, unknown>;
    cursor: Snapshot;
}

const beginSpeculation = (state: State): SpeculationUndo => {
    return { aliasCount: state.aliasCount, anchorMap: new Map(state.anchorMap), cursor: snapshotState(state) };
};

const rollbackSpeculation = (state: State, undo: SpeculationUndo): void => {
    state.anchorMap = undo.anchorMap;
    state.aliasCount = undo.aliasCount;
    restoreState(state, undo.cursor);
};

const throwError = (state: State, message: string): never => {
    throw new YAMLParseError(
        message,
        {
            column: state.position - state.lineStart,
            line: state.line,
            position: state.position,
        },
        state.input,
    );
};

const emitWarning = (state: State, message: string): void => {
    if (state.options.onWarning) {
        state.options.onWarning(
            new YAMLWarning(
                message,
                {
                    column: state.position - state.lineStart,
                    line: state.line,
                    position: state.position,
                },
                state.input,
            ),
        );
    }
};

export type { NodeKind, Snapshot, SpeculationUndo };
export { beginSpeculation, emitWarning, restoreState, rollbackSpeculation, snapshotState, State, throwError };
