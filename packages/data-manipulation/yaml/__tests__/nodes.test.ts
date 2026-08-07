/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it } from "vitest";

import { Alias, createNode, isAlias, isCollection, isMap, isNode, isPair, isScalar, isSeq, Pair, parse, parseAllNodes, parseNodes, Scalar, toJS, visit, YAMLMap, YAMLSeq } from "../src";

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
