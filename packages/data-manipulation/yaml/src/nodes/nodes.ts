/* eslint-disable max-classes-per-file */
/*
 * The node kinds reference each other (a map holds pairs, a pair holds nodes,
 * `toJS` walks all of them), so declaration order cannot satisfy
 * no-use-before-define without splitting a cohesive model across files.
 */
/* eslint-disable @typescript-eslint/no-use-before-define */

/**
 * The node model: an explicit tree of `Scalar`, `YAMLMap`, `YAMLSeq`, `Pair`
 * and `Alias`, mirroring `yaml`'s.
 *
 * `parse` deliberately never builds this — it produces native JavaScript values
 * in a single pass, which is where its speed comes from. The tree exists for
 * the cases native values cannot express: distinguishing a quoted `"1"` from
 * the number `1`, holding an anchor or a tag alongside a value, keeping a
 * collection's flow/block style, or walking a document generically.
 */

/**
 * Discriminant identifying a node's kind.
 *
 * A plain string field rather than `instanceof` so the guards keep working
 * across module instances — two copies of this package in one dependency tree
 * would otherwise produce nodes that fail each other's checks.
 */
type NodeKindName = "ALIAS" | "MAP" | "PAIR" | "SCALAR" | "SEQ";

/** How a scalar was written, preserved so it can be written back the same way. */
type ScalarStyle = "BLOCK_FOLDED" | "BLOCK_LITERAL" | "PLAIN" | "QUOTE_DOUBLE" | "QUOTE_SINGLE";

/** Fields every node may carry. */
interface NodeBase {
    /** Anchor name, without the `&amp;`. */
    anchor?: string;

    /** Comment written after the node, without the `#`. */
    comment?: string;

    /** Comment written on the lines before the node. */
    commentBefore?: string;

    /** Blank line before the node. */
    spaceBefore?: boolean;

    /** Explicit tag, e.g. `!!str`. */
    tag?: string;
}

/** A single value. */
class Scalar<T = unknown> implements NodeBase {
    public readonly kind: NodeKindName = "SCALAR";

    public value: T;

    public anchor?: string;

    public comment?: string;

    public commentBefore?: string;

    public spaceBefore?: boolean;

    public tag?: string;

    /** The style it was written in, when known. */
    public type?: ScalarStyle;

    public constructor(value: T) {
        this.value = value;
    }

    public toJSON(): unknown {
        return toJS(this);
    }

    public toString(): string {
        return String(this.value);
    }
}

/** A reference to an anchored node, written `*name`. */
class Alias {
    public readonly kind: NodeKindName = "ALIAS";

    /** The anchor name this points at. */
    public source: string;

    public comment?: string;

    public commentBefore?: string;

    public spaceBefore?: boolean;

    public constructor(source: string) {
        this.source = source;
    }

    public toString(): string {
        return `*${this.source}`;
    }
}

/** One `key: value` entry of a mapping. */
class Pair<K = unknown, V = unknown> {
    public readonly kind: NodeKindName = "PAIR";

    public key: K;

    public value: V;

    public comment?: string;

    public commentBefore?: string;

    public spaceBefore?: boolean;

    public constructor(key: K, value: V) {
        this.key = key;
        this.value = value;
    }

    public toJSON(): unknown {
        return { key: toJS(this.key), value: toJS(this.value) };
    }
}

const isNodeKind = (value: unknown, kind: NodeKindName): boolean => typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === kind;

const isScalar = <T = unknown>(value: unknown): value is Scalar<T> => isNodeKind(value, "SCALAR");
const isAlias = (value: unknown): value is Alias => isNodeKind(value, "ALIAS");
const isPair = <K = unknown, V = unknown>(value: unknown): value is Pair<K, V> => isNodeKind(value, "PAIR");
const isMap = (value: unknown): value is YAMLMap => isNodeKind(value, "MAP");
const isSeq = (value: unknown): value is YAMLSeq => isNodeKind(value, "SEQ");
const isCollection = (value: unknown): value is YAMLMap | YAMLSeq => isMap(value) || isSeq(value);
const isNode = (value: unknown): boolean => isScalar(value) || isAlias(value) || isCollection(value);

/** Compare a path segment against a mapping key, unwrapping scalars. */
const sameKey = (a: unknown, b: unknown): boolean => {
    const left = isScalar(a) ? a.value : a;
    const right = isScalar(b) ? b.value : b;

    return left === right;
};

/** Shared behaviour of the two collection kinds. */
abstract class Collection implements NodeBase {
    public anchor?: string;

    public comment?: string;

    public commentBefore?: string;

    /** Written in flow style (`[a, b]`) rather than block. */
    public flow?: boolean;

    public spaceBefore?: boolean;

    public tag?: string;

    public abstract items: unknown[];

    /** Read the value at `key`, or `undefined`. */
    public abstract get(key: unknown, keepScalar?: boolean): unknown;

    /** Replace or add the value at `key`. */
    public abstract set(key: unknown, value: unknown): void;

    /** Whether `key` is present. */
    public abstract has(key: unknown): boolean;

    /** Remove `key`, reporting whether anything was removed. */
    public abstract delete(key: unknown): boolean;

    /** Read the value at a path of keys. */
    public getIn(path: Iterable<unknown>, keepScalar = false): unknown {
        const [head, ...rest] = [...path];

        if (head === undefined) {
            return undefined;
        }

        const node = this.get(head, true);

        if (rest.length === 0) {
            return keepScalar || !isScalar(node) ? node : node.value;
        }

        return isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }

    /** Whether a path of keys resolves. */
    public hasIn(path: Iterable<unknown>): boolean {
        const [head, ...rest] = [...path];

        if (head === undefined) {
            return false;
        }

        if (rest.length === 0) {
            return this.has(head);
        }

        const node = this.get(head, true);

        return isCollection(node) ? node.hasIn(rest) : false;
    }

    /** Set the value at a path, creating intermediate maps as needed. */
    public setIn(path: Iterable<unknown>, value: unknown): void {
        const [head, ...rest] = [...path];

        if (head === undefined) {
            return;
        }

        if (rest.length === 0) {
            this.set(head, value);

            return;
        }

        let node = this.get(head, true);

        if (!isCollection(node)) {
            node = new YAMLMap();
            this.set(head, node);
        }

        (node as Collection).setIn(rest, value);
    }

    /** Remove the value at a path. */
    public deleteIn(path: Iterable<unknown>): boolean {
        const [head, ...rest] = [...path];

        if (head === undefined) {
            return false;
        }

        if (rest.length === 0) {
            return this.delete(head);
        }

        const node = this.get(head, true);

        return isCollection(node) ? node.deleteIn(rest) : false;
    }

    public toJSON(): unknown {
        return toJS(this);
    }
}

/** A mapping, holding `Pair` items in document order. */
class YAMLMap extends Collection {
    public readonly kind: NodeKindName = "MAP";

    public items: Pair[] = [];

    /**
     * Key → first matching pair, so a lookup does not scan `items`.
     *
     * Parsing calls `has` and `set` once per key, which made building a mapping
     * quadratic: 8 000 keys took ~370 ms against ~4 ms for the native path, and
     * `parseDocument` is exactly the entry point aimed at large hand-edited
     * files.
     */
    #index: Map<unknown, Pair> | undefined;

    /**
     * How many items the index covers. `items` is public and callers splice it
     * directly (`visit` with REMOVE does), so a length that no longer matches is
     * the cheap signal that the index went stale and must be rebuilt.
     */
    #indexedCount = 0;

    #keyIndex(): Map<unknown, Pair> {
        if (this.#index === undefined || this.#indexedCount !== this.items.length) {
            const index = new Map<unknown, Pair>();

            for (const pair of this.items) {
                const plain = isScalar(pair.key) ? pair.key.value : pair.key;

                // First wins, matching the `find` this replaced.
                if (!index.has(plain)) {
                    index.set(plain, pair);
                }
            }

            this.#index = index;
            this.#indexedCount = this.items.length;
        }

        return this.#index;
    }

    #find(key: unknown): Pair | undefined {
        return this.#keyIndex().get(isScalar(key) ? key.value : key);
    }

    public get(key: unknown, keepScalar = false): unknown {
        const pair = this.#find(key);

        if (!pair) {
            return undefined;
        }

        return keepScalar || !isScalar(pair.value) ? pair.value : pair.value.value;
    }

    public set(key: unknown, value: unknown): void {
        const pair = this.#find(key);

        if (pair) {
            pair.value = value;

            return;
        }

        const added = new Pair(key, value);

        this.items.push(added);

        // Extend the index rather than dropping it — otherwise every append
        // would force a full rebuild on the next lookup and the quadratic cost
        // would simply move.
        if (this.#index !== undefined && this.#indexedCount === this.items.length - 1) {
            this.#index.set(isScalar(key) ? key.value : key, added);
            this.#indexedCount = this.items.length;
        }
    }

    public has(key: unknown): boolean {
        return this.#find(key) !== undefined;
    }

    public delete(key: unknown): boolean {
        const index = this.items.findIndex((item) => sameKey(item.key, key));

        if (index === -1) {
            return false;
        }

        this.items.splice(index, 1);
        this.#index = undefined;

        return true;
    }

    /** Append a pair without checking for an existing key. */
    public add(pair: Pair): void {
        this.items.push(pair);
    }
}

/** A sequence, indexed by position. */
class YAMLSeq extends Collection {
    public readonly kind: NodeKindName = "SEQ";

    public items: unknown[] = [];

    public get(key: unknown, keepScalar = false): unknown {
        const index = asIndex(key);
        const item = index === undefined ? undefined : this.items[index];

        return keepScalar || !isScalar(item) ? item : item.value;
    }

    public set(key: unknown, value: unknown): void {
        const index = asIndex(key);

        if (index !== undefined) {
            this.items[index] = value;
        }
    }

    public has(key: unknown): boolean {
        const index = asIndex(key);

        return index !== undefined && index < this.items.length;
    }

    public delete(key: unknown): boolean {
        const index = asIndex(key);

        if (index === undefined || index >= this.items.length) {
            return false;
        }

        this.items.splice(index, 1);

        return true;
    }

    /** Append an item. */
    public add(value: unknown): void {
        this.items.push(value);
    }
}

/** A sequence index, or undefined when `key` is not one. */
const asIndex = (key: unknown): number | undefined => {
    const raw = isScalar(key) ? key.value : key;
    const index = typeof raw === "number" ? raw : Number(raw);

    return Number.isInteger(index) && index >= 0 ? index : undefined;
};

/** Whether a pair's key is the merge key `&lt;&lt;`. */
const isMergeKey = (key: unknown): boolean => (isScalar(key) ? key.value : key) === "<<";

/**
 * Write one key of a converted mapping without letting the document reach the
 * prototype chain.
 *
 * The loader guards its own writes, but `toJS` builds a second object from the
 * node tree and `__proto__` is an inherited accessor there too — assigning it
 * would swap the result's prototype instead of storing a key. Unlike the parse
 * path this has no opt-out: nothing legitimate needs a node tree to mutate a
 * prototype.
 */
const assignConverted = (target: Record<string, unknown>, key: string, value: unknown): void => {
    // Both branches write an own data property; `defineProperty` is required for
    // `__proto__` because plain assignment would hit the inherited accessor.
    Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });
};

/**
 * The string a collection key is stored under once a mapping is flattened to a
 * plain object.
 *
 * The brackets and braces matter: without them every collection key collapsed
 * to `[object Object]`, so `? [a, b]` collided with the plain key `"a,b"` and
 * the two entries silently merged. The loader flattens native keys with this
 * same function, so both paths agree on the spelling.
 */
const keyToString = (node: unknown): string => {
    // The loader calls this for every key of every plain-object mapping, so the
    // overwhelmingly common cases answer before any of the node checks run.
    if (typeof node === "string") {
        return node;
    }

    if (node === null || typeof node !== "object") {
        return String(node);
    }

    if (isScalar(node)) {
        return keyToString(node.value);
    }

    if (isSeq(node)) {
        return `[${node.items.map((part) => keyToString(part)).join(",")}]`;
    }

    if (isMap(node)) {
        return `{${node.items
            .map((pair) => `${keyToString(pair.key)}: ${keyToString(pair.value)}`)
            .toSorted((a, b) => a.localeCompare(b))
            .join(", ")}}`;
    }

    if (isAlias(node)) {
        return `*${node.source}`;
    }

    if (Array.isArray(node)) {
        return `[${node.map((part) => keyToString(part)).join(",")}]`;
    }

    if (Object.prototype.toString.call(node) === "[object Object]") {
        return `{${Object.entries(node as Record<string, unknown>)
            .map(([key, item]) => `${key}: ${keyToString(item)}`)
            .toSorted((a, b) => a.localeCompare(b))
            .join(", ")}}`;
    }

    // Some other object (a Date, a class instance). Its own tag is the only
    // stable spelling available; `String(node)` would throw the base-to-string
    // lint and read `[object Object]` for all of them anyway.
    return Object.prototype.toString.call(node);
};

/**
 * The mappings a merge key pulls from: one for `&lt;&lt;: *a`, several for
 * `&lt;&lt;: [*a, *b]`. Anything that does not resolve to a mapping is skipped —
 * the parser has already rejected the malformed forms.
 */
const mergeSources = (value: unknown, seen: Map<string, unknown>): Record<string, unknown>[] => {
    const resolved = toJS(value, seen);

    if (Array.isArray(resolved)) {
        return resolved.filter((item) => isPlainRecord(item)) as Record<string, unknown>[];
    }

    return isPlainRecord(resolved) ? [resolved as Record<string, unknown>] : [];
};

const isPlainRecord = (value: unknown): boolean => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Convert a mapping, splicing in whatever its merge keys reference.
 *
 * A key already present wins, which covers both orders: an explicit key written
 * before the merge survives it, and one written after simply overwrites.
 */
const mapToJS = (value: YAMLMap, seen: Map<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};

    if (value.anchor) {
        seen.set(value.anchor, out);
    }

    for (const pair of value.items) {
        if (isMergeKey(pair.key)) {
            applyMerge(out, pair.value, seen);

            continue;
        }

        assignConverted(out, keyToString(pair.key), toJS(pair.value, seen));
    }

    return out;
};

/** Splice a merge key's referenced mappings into `out`, keeping existing keys. */
const applyMerge = (out: Record<string, unknown>, value: unknown, seen: Map<string, unknown>): void => {
    for (const source of mergeSources(value, seen)) {
        for (const [key, item] of Object.entries(source)) {
            if (!Object.hasOwn(out, key)) {
                assignConverted(out, key, item);
            }
        }
    }
};

/**
 * Convert a node tree to plain JavaScript.
 *
 * `anchors` resolves aliases back to the value their anchor names, so a
 * document with shared references produces shared references rather than
 * duplicated copies.
 *
 * Merge keys are resolved here rather than while parsing, so the tree keeps the
 * `&lt;&lt;` pair and its alias and can still be written back out unchanged — the
 * same split the `yaml` reference makes.
 */
const toJS = (value: unknown, anchors?: Map<string, unknown>): unknown => {
    const seen = anchors ?? new Map<string, unknown>();

    if (isScalar(value)) {
        if (value.anchor) {
            seen.set(value.anchor, value.value);
        }

        return value.value;
    }

    if (isAlias(value)) {
        return seen.get(value.source);
    }

    if (isSeq(value)) {
        const out: unknown[] = [];

        if (value.anchor) {
            seen.set(value.anchor, out);
        }

        for (const item of value.items) {
            out.push(toJS(item, seen));
        }

        return out;
    }

    if (isMap(value)) {
        return mapToJS(value, seen);
    }

    if (isPair(value)) {
        return { key: toJS(value.key, seen), value: toJS(value.value, seen) };
    }

    return value;
};

/** Wrap a plain JavaScript value into a node tree. */
const createNode = (value: unknown): unknown => {
    if (isNode(value) || isPair(value)) {
        return value;
    }

    if (Array.isArray(value)) {
        const seq = new YAMLSeq();

        for (const item of value) {
            seq.items.push(createNode(item));
        }

        return seq;
    }

    if (value instanceof Map) {
        const map = new YAMLMap();

        for (const [key, item] of value) {
            map.items.push(new Pair(createNode(key), createNode(item)));
        }

        return map;
    }

    if (typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]") {
        const map = new YAMLMap();

        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            map.items.push(new Pair(new Scalar(key), createNode(item)));
        }

        return map;
    }

    return new Scalar(value);
};

export type { NodeKindName, ScalarStyle };
export { Alias, Collection, createNode, isAlias, isCollection, isMap, isNode, isPair, isScalar, isSeq, keyToString, Pair, Scalar, toJS, YAMLMap, YAMLSeq };
