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

    public get(key: unknown, keepScalar = false): unknown {
        const pair = this.items.find((item) => sameKey(item.key, key));

        if (!pair) {
            return undefined;
        }

        return keepScalar || !isScalar(pair.value) ? pair.value : pair.value.value;
    }

    public set(key: unknown, value: unknown): void {
        const pair = this.items.find((item) => sameKey(item.key, key));

        if (pair) {
            pair.value = value;

            return;
        }

        this.items.push(new Pair(key, value));
    }

    public has(key: unknown): boolean {
        return this.items.some((item) => sameKey(item.key, key));
    }

    public delete(key: unknown): boolean {
        const index = this.items.findIndex((item) => sameKey(item.key, key));

        if (index === -1) {
            return false;
        }

        this.items.splice(index, 1);

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

/**
 * Convert a node tree to plain JavaScript.
 *
 * `anchors` resolves aliases back to the value their anchor names, so a
 * document with shared references produces shared references rather than
 * duplicated copies.
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
        const out: Record<string, unknown> = {};

        if (value.anchor) {
            seen.set(value.anchor, out);
        }

        for (const pair of value.items) {
            out[String(toJS(pair.key, seen))] = toJS(pair.value, seen);
        }

        return out;
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
export { Alias, Collection, createNode, isAlias, isCollection, isMap, isNode, isPair, isScalar, isSeq, Pair, Scalar, toJS, YAMLMap, YAMLSeq };
