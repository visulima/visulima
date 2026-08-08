/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";

import {
    Alias,
    createNode,
    isAlias,
    isCollection,
    isMap,
    isNode,
    isPair,
    isScalar,
    isSeq,
    Pair,
    parse,
    parseAllNodes,
    parseNodes,
    Scalar,
    stringify,
    toJS,
    visit,
    YAMLMap,
    YAMLParseError,
    YAMLSeq,
} from "../src";

const HEX_TAG_RE = /^0x[0-9a-f]+$/;

describe("node model › construction and guards", () => {
    it("wraps plain values into a node tree", () => {
        expect.assertions(4);

        const tree = createNode({ a: 1, b: [1, 2] }) as YAMLMap;

        expect(isMap(tree)).toBe(true);
        expect(isSeq(tree.get("b", true))).toBe(true);
        expect(isScalar(tree.items[0]!.value)).toBe(true);
        expect(toJS(tree)).toStrictEqual({ a: 1, b: [1, 2] });
    });

    it("wraps a Map, keeping non-string keys", () => {
        expect.assertions(1);

        const tree = createNode(new Map<unknown, unknown>([[1, "one"]])) as YAMLMap;

        expect(toJS(tree)).toStrictEqual({ 1: "one" });
    });

    it("distinguishes the node kinds", () => {
        expect.assertions(7);

        expect(isScalar(new Scalar(1))).toBe(true);
        expect(isSeq(new YAMLSeq())).toBe(true);
        expect(isMap(new YAMLMap())).toBe(true);
        expect(isPair(new Pair("k", "v"))).toBe(true);
        expect(isAlias(new Alias("a"))).toBe(true);
        expect(isCollection(new YAMLMap())).toBe(true);
        expect(isNode(new Pair("k", "v"))).toBe(false);
    });

    it("leaves an already-built node alone", () => {
        expect.assertions(1);

        const scalar = new Scalar("x");

        expect(createNode(scalar)).toBe(scalar);
    });
});

describe("node model › collection access", () => {
    it("reads and writes by key and by path", () => {
        expect.assertions(5);

        const tree = createNode({ a: { b: { c: 1 } }, list: [10, 20] }) as YAMLMap;

        expect(tree.getIn(["a", "b", "c"])).toBe(1);
        expect(tree.getIn(["list", 1])).toBe(20);
        expect(tree.hasIn(["a", "b"])).toBe(true);
        expect(tree.hasIn(["a", "nope"])).toBe(false);

        tree.setIn(["a", "b", "d"], new Scalar(2));

        expect(tree.getIn(["a", "b", "d"])).toBe(2);
    });

    it("creates intermediate maps when setting a deep path", () => {
        expect.assertions(1);

        const tree = new YAMLMap();

        tree.setIn(["x", "y"], new Scalar(1));

        expect(toJS(tree)).toStrictEqual({ x: { y: 1 } });
    });

    it("deletes by key and by path", () => {
        expect.assertions(3);

        const tree = createNode({ a: 1, b: { c: 2 } }) as YAMLMap;

        expect(tree.delete("a")).toBe(true);
        expect(tree.deleteIn(["b", "c"])).toBe(true);
        expect(toJS(tree)).toStrictEqual({ b: {} });
    });

    it("returns the scalar node when asked to keep it", () => {
        expect.assertions(2);

        const tree = createNode({ a: 1 }) as YAMLMap;

        expect(tree.get("a")).toBe(1);
        expect(isScalar(tree.get("a", true))).toBe(true);
    });

    it("indexes a sequence by position", () => {
        expect.assertions(4);

        const seq = createNode([1, 2, 3]) as YAMLSeq;

        expect(seq.get(1)).toBe(2);
        expect(seq.has(2)).toBe(true);
        expect(seq.has(9)).toBe(false);
        expect(seq.delete(0)).toBe(true);
    });
});

describe("node model › aliases", () => {
    it("resolves an alias to the anchored value, shared not copied", () => {
        expect.assertions(2);

        const shared = new YAMLMap();

        shared.anchor = "base";
        shared.set(new Scalar("a"), new Scalar(1));

        const root = new YAMLMap();

        root.set(new Scalar("first"), shared);
        root.set(new Scalar("second"), new Alias("base"));

        const plain = toJS(root) as { first: unknown; second: unknown };

        expect(plain.first).toStrictEqual({ a: 1 });
        // The same object, not a structural copy.
        expect(plain.second).toBe(plain.first);
    });
});

describe("node model › visit", () => {
    it("visits every node kind", () => {
        expect.assertions(3);

        const tree = createNode({ a: [1, 2] });
        let maps = 0;
        let seqs = 0;
        let scalars = 0;

        visit(tree, {
            Map: () => {
                maps += 1;
            },
            Scalar: () => {
                scalars += 1;
            },
            Seq: () => {
                seqs += 1;
            },
        });

        expect(maps).toBe(1);
        expect(seqs).toBe(1);
        // The key `a` plus the two sequence entries.
        expect(scalars).toBe(3);
    });

    it("replaces a node when the visitor returns one", () => {
        expect.assertions(1);

        const tree = createNode({ a: 1, b: 2 });

        visit(tree, {
            Scalar: (_key, node) => {
                if ((node as Scalar).value === 1) {
                    return new Scalar(99);
                }

                return undefined;
            },
        });

        expect(toJS(tree)).toStrictEqual({ a: 99, b: 2 });
    });

    it("removes a node on visit.REMOVE", () => {
        expect.assertions(1);

        const tree = createNode([1, 2, 3]);

        visit(tree, {
            Scalar: (_key, node) => {
                if ((node as Scalar).value === 2) {
                    return visit.REMOVE;
                }

                return undefined;
            },
        });

        expect(toJS(tree)).toStrictEqual([1, 3]);
    });

    it("stops the walk on visit.BREAK", () => {
        expect.assertions(1);

        const tree = createNode([1, 2, 3, 4]);
        let seen = 0;

        visit(tree, {
            Scalar: () => {
                seen += 1;

                return visit.BREAK;
            },
        });

        expect(seen).toBe(1);
    });

    it("does not descend on visit.SKIP", () => {
        expect.assertions(1);

        const tree = createNode({ a: [1, 2, 3] });
        let scalars = 0;

        visit(tree, {
            Scalar: () => {
                scalars += 1;
            },
            Seq: () => visit.SKIP,
        });

        // Only the key `a`; the sequence's entries were skipped.
        expect(scalars).toBe(1);
    });
});

describe("node model › parsing into nodes", () => {
    it("preserves the style each scalar was written in", () => {
        expect.assertions(4);

        const tree = parseNodes("a: plain\nb: \u0022double\u0022\nc: 'single'\nd: |\n  block\n") as YAMLMap;

        expect((tree.get("a", true) as Scalar).type).toBe("PLAIN");
        expect((tree.get("b", true) as Scalar).type).toBe("QUOTE_DOUBLE");
        expect((tree.get("c", true) as Scalar).type).toBe("QUOTE_SINGLE");
        expect((tree.get("d", true) as Scalar).type).toBe("BLOCK_LITERAL");
    });

    it("keeps mapping keys as nodes rather than flattening them", () => {
        expect.assertions(2);

        const tree = parseNodes("a: 1") as YAMLMap;

        expect(isScalar(tree.items[0]!.key)).toBe(true);
        expect((tree.items[0]!.key as Scalar).value).toBe("a");
    });

    it("records the tag and the anchor on the node", () => {
        expect.assertions(3);

        const tree = parseNodes("a: !!str 5\nb: &anchored 1") as YAMLMap;
        const tagged = tree.get("a", true) as Scalar;

        expect(tagged.tag).toBe("tag:yaml.org,2002:str");
        expect(tagged.value).toBe("5");
        expect((tree.get("b", true) as Scalar).anchor).toBe("anchored");
    });

    it("keeps an alias as a reference, resolved only by toJS", () => {
        expect.assertions(3);

        const tree = parseNodes("a: &x { k: 1 }\nb: *x") as YAMLMap;
        const alias = tree.get("b", true);

        expect(isAlias(alias)).toBe(true);
        expect((alias as Alias).source).toBe("x");

        const plain = toJS(tree) as { a: unknown; b: unknown };

        // Resolved to the same object, not a copy.
        expect(plain.b).toBe(plain.a);
    });

    it("builds nested collections as nodes", () => {
        expect.assertions(3);

        const tree = parseNodes("a:\n  - 1\n  - b: 2\n") as YAMLMap;
        const seq = tree.get("a", true) as YAMLSeq;

        expect(isSeq(seq)).toBe(true);
        expect(isScalar(seq.items[0])).toBe(true);
        expect(isMap(seq.items[1])).toBe(true);
    });

    it("converts back to the same value plain parsing produces", () => {
        expect.assertions(1);

        const source = "a: 1\nb: [1, 2]\nc:\n  d: true\ne: null\n";

        expect(toJS(parseNodes(source))).toStrictEqual(parse(source));
    });

    it("returns one tree per document in a stream", () => {
        expect.assertions(2);

        const trees = parseAllNodes("a: 1\n---\nb: 2\n");

        expect(trees).toHaveLength(2);
        expect(trees.map((tree) => toJS(tree))).toStrictEqual([{ a: 1 }, { b: 2 }]);
    });

    it("is walkable with visit", () => {
        expect.assertions(1);

        const tree = parseNodes("a:\n  - 1\n  - 2\n");
        let scalars = 0;

        visit(tree, {
            Scalar: () => {
                scalars += 1;
            },
        });

        // The key `a` plus the two entries.
        expect(scalars).toBe(3);
    });
});

describe("node model › options that interact with the tree", () => {
    // Each case here corresponds to a bug that shipped: the node path is a
    // second value representation, so anything branching on it needs coverage
    // under `nodes` as well as natively.

    it("resolves merge keys through toJS while keeping the pair in the tree", () => {
        expect.assertions(3);

        const source = "d: &a\n  x: 1\ne:\n  <<: *a\n  y: 2\n";
        const tree = parseNodes(source) as YAMLMap;

        // The tree keeps `<<` and its alias, so the document still round-trips.
        const nested = tree.get("e", true) as YAMLMap;

        expect(nested.items.map((pair) => String((pair.key as Scalar).value))).toStrictEqual(["<<", "y"]);
        expect(isAlias(nested.items[0]!.value)).toBe(true);

        // Resolution happens on conversion, matching what `parse` produces.
        expect(toJS(tree)).toStrictEqual(parse(source));
    });

    it("keeps an explicit key when a merge would also supply it", () => {
        expect.assertions(1);

        // The explicit `x` wins whichever side of the merge key it is written on.
        expect(toJS(parseNodes("d: &a\n  x: 1\ne:\n  x: 2\n  <<: *a\n"))).toStrictEqual({ d: { x: 1 }, e: { x: 2 } });
    });

    it("flattens a complex key the same way the native path does", () => {
        expect.assertions(1);

        // `? [a, b]` and the plain key `"a,b"` are distinct entries; flattening
        // both to `[object Object]` (or to the node's own fields) collapsed them.
        const source = "? [a,b]\n: 1\n\u0022a,b\u0022: 2\n";

        expect(toJS(parseNodes(source))).toStrictEqual(parse(source));
    });

    it("wraps a value resolved by a custom implicit tag", () => {
        expect.assertions(2);

        const customTags = [{ default: true, resolve: (raw: string) => Number.parseInt(raw.slice(2), 16), tag: "!hex", test: HEX_TAG_RE }];
        const tree = parseNodes("a: 0xff\n", { customTags }) as YAMLMap;

        // This path returned early and skipped the node wrap entirely, so the
        // value sat in the tree unwrapped and `visit` could not reach it.
        expect(isScalar(tree.get("a", true))).toBe(true);
        expect(tree.get("a")).toBe(255);
    });

    it("never lets a document reach the prototype chain through toJS", () => {
        expect.assertions(3);

        const result = toJS(parseNodes("__proto__:\n  polluted: yes\n")) as Record<string, unknown>;

        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(Object.hasOwn(result, "__proto__")).toBe(true);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("reports a parse error instead of returning an empty tree", () => {
        expect.assertions(1);

        // `loadDocuments` collects diagnostics rather than throwing, which made
        // a malformed document indistinguishable from an empty one.
        expect(() => parseNodes("a: [1, 2\nb: {\n")).toThrow(YAMLParseError);
    });

    it("serializes a node tree back to YAML", () => {
        expect.assertions(2);

        // The node API exposes construction and mutation, so there has to be a
        // way back out; `stringify` reaches it through each node's `toJSON`.
        expect(stringify(createNode({ a: 1, b: [1, 2] }))).toBe("a: 1\nb:\n  - 1\n  - 2\n");
        expect(stringify(parseNodes("a: 1\n"))).toBe("a: 1\n");
    });

    it("keeps a stringKeys-flattened key as a Scalar", () => {
        expect.assertions(2);

        // A bare string here would be a `Pair.key` that `visit` skips and
        // `isScalar` rejects, leaving one un-node in an otherwise uniform tree.
        const tree = parseNodes("? [a,b]\n: 1", { stringKeys: true }) as YAMLMap;

        expect(isScalar(tree.items[0]!.key)).toBe(true);
        expect(toJS(tree)).toStrictEqual({ "[a,b]": 1 });
    });

    it("builds a large mapping without scanning every pair", () => {
        expect.assertions(2);

        // `get`/`has` used to scan `items`, making a mapping quadratic to build:
        // 8 000 keys took ~370ms against ~4ms natively.
        //
        // A single absolute measurement with a very wide margin, deliberately
        // not a ratio. Two earlier shapes failed on CI — an absolute 1000ms
        // limit (measured 1005ms on Windows) and a ratio between two sizes
        // (expected ~8, limit 30, measured 35 on a loaded runner) — because
        // both put the pass/fail line close to the noise. Here 50 000 keys take
        // ~56ms locally while the quadratic version would take ~14s, so the
        // limit sits far from either.
        const source = Array.from({ length: 50_000 }, (_, index) => `k${String(index)}: ${String(index)}`).join("\n");

        const started = performance.now();
        const tree = parseNodes(source) as YAMLMap;
        const elapsed = performance.now() - started;

        expect(tree.get("k49999")).toBe(49_999);
        expect(elapsed).toBeLessThan(10_000);
    });

    it("keeps the index correct after items are spliced directly", () => {
        expect.assertions(3);

        // `items` is public and `visit` REMOVE splices it, so a cached index has
        // to notice it went stale.
        const tree = parseNodes("a: 1\nb: 2\nc: 3\n") as YAMLMap;

        expect(tree.get("b")).toBe(2);

        visit(tree, {
            Pair: (_key, node) => {
                const key = (node as Pair).key as Scalar;

                return key.value === "b" ? visit.REMOVE : undefined;
            },
        });

        expect(tree.has("b")).toBe(false);
        expect(tree.get("c")).toBe(3);
    });
});
