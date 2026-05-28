import { describe, expect, it } from "vitest";

import type { TreeRenderFunction, TreeSortFunction } from "../../src/object-tree";
import { renderObjectTree } from "../../src/object-tree";

describe(renderObjectTree, () => {
    it("should render a simple object", () => {
        expect.assertions(1);

        const object = {
            age: 30,
            name: "John",
        };

        const result = renderObjectTree(object);

        expect(result).toBe("├─ name: John\n└─ age: 30");
    });

    it("should render nested objects", () => {
        expect.assertions(1);

        const object = {
            active: true,
            user: {
                age: 25,
                name: "Alice",
            },
        };

        const result = renderObjectTree(object);

        expect(result).toBe("├─ user\n│  ├─ name: Alice\n│  └─ age: 25\n└─ active: true");
    });

    it("should return array when joined is false", () => {
        expect.assertions(2);

        const object = {
            name: "Test",
            value: 42,
        };

        const result = renderObjectTree(object, { joined: false, sortFn: (a, b) => a.localeCompare(b) });

        expect(result).toBeInstanceOf(Array);
        expect(result).toStrictEqual(["├─ name: Test", "└─ value: 42"]);
    });

    it("should use custom separators", () => {
        expect.assertions(1);

        const object = {
            key1: "value1",
            key2: "value2",
        };

        const result = renderObjectTree(object, {
            keyNeighbour: "+-- ",
            keyNoNeighbour: String.raw`\-- `,
            separator: " = ",
            sortFn: (a, b) => a.localeCompare(b),
        });

        expect(result).toBe("+-- key1 = value1\n\\-- key2 = value2");
    });

    it("should use custom render function", () => {
        expect.assertions(1);

        const object = {
            count: 5,
            message: "hello",
        };

        const result = renderObjectTree(object, {
            renderFn: (node) => {
                if (typeof node === "string") {
                    return node.toUpperCase();
                }

                return ["boolean", "number", "string"].includes(typeof node) ? String(node) : undefined;
            },
        });

        expect(result).toBe("├─ message: HELLO\n└─ count: 5");
    });

    it("should handle circular references", () => {
        expect.assertions(1);

        const object: any = { name: "circular" };

        object.self = object;

        const result = renderObjectTree(object);

        expect(result).toContain(" (circular ref.)");
    });

    it("should handle empty objects", () => {
        expect.assertions(1);

        const result = renderObjectTree({});

        expect(result).toBe("");
    });

    it("should not false-positive on deep nesting without cycles", () => {
        expect.assertions(2);

        const object = {
            level1: {
                level2: {
                    level3: {
                        level4: { level5: { level6: {} } },
                    },
                },
            },
        };

        const result = renderObjectTree(object);
        const resultString = typeof result === "string" ? result : result.join("\n");

        expect(resultString).toBeDefined();
        expect(resultString).not.toContain("(circular ref.)");
    });

    it("should handle objects with null and undefined values", () => {
        expect.assertions(1);

        const object = { a: null, b: undefined, c: { d: "value" } };

        const result = renderObjectTree(object);

        expect(result).toBeDefined();
    });

    it("should detect circular references on current path only", () => {
        expect.assertions(1);

        const object: Record<string, unknown> = { a: { b: {} } };

        (object.a as Record<string, unknown>).b = object.a; // circular reference

        const result = renderObjectTree(object);
        const resultString = typeof result === "string" ? result : result.join("\n");

        expect(resultString).toContain("(circular ref.)");
    });

    it("should render a primitive root value", () => {
        expect.assertions(1);

        expect(renderObjectTree(42 as unknown as Record<string, unknown>)).toBe("42");
    });

    it("should throw when joined is not a boolean", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { joined: "yes" as unknown as boolean })).toThrow(TypeError);
    });

    it("should throw when spacerNoNeighbour is not a string", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { spacerNoNeighbour: 1 as unknown as string })).toThrow(TypeError);
    });

    it("should throw when spacerNeighbour is not a string", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { spacerNeighbour: 1 as unknown as string })).toThrow(TypeError);
    });

    it("should throw when keyNoNeighbour is not a string", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { keyNoNeighbour: 1 as unknown as string })).toThrow(TypeError);
    });

    it("should throw when keyNeighbour is not a string", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { keyNeighbour: 1 as unknown as string })).toThrow(TypeError);
    });

    it("should throw when separator is not a string", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { separator: 1 as unknown as string })).toThrow(TypeError);
    });

    it("should throw when renderFn is not a function", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { renderFn: "nope" as unknown as TreeRenderFunction })).toThrow(TypeError);
    });

    it("should throw when sortFn is not a function or undefined", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { sortFn: "nope" as unknown as TreeSortFunction })).toThrow(TypeError);
    });

    it("should throw when breakCircularWith is not a string or null", () => {
        expect.assertions(1);

        expect(() => renderObjectTree({}, { breakCircularWith: 1 as unknown as string })).toThrow(TypeError);
    });
});
