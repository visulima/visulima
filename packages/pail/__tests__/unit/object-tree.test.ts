import { describe, expect, it } from "vitest";

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
});
