import { describe, expect, it } from "vitest";

import objectMerge from "../src/util/object-merge";

describe(objectMerge, () => {
    it("merges path into empty path object", () => {
        expect.assertions(1);

        const a = {
            paths: {},
        };
        const b = {
            paths: { path1: { description: "this is a test", name: "test" } },
        };
        const expected = {
            paths: { path1: { description: "this is a test", name: "test" } },
        };

        objectMerge(a, b);

        expect(a).toStrictEqual(expected);
    });

    it("merges path into undefined", () => {
        expect.assertions(1);

        const a = {};
        const b = {
            paths: { path1: { description: "this is a test", name: "test" } },
        };
        const expected = {
            paths: { path1: { description: "this is a test", name: "test" } },
        };

        objectMerge(a, b);

        expect(a).toStrictEqual(expected);
    });

    it("merges path and component into nothing", () => {
        expect.assertions(1);

        const a = {};
        const b = {
            components: { schemas: { fun: { name: "fun" }, fun2: { name: "fun2" } } },
            paths: { path1: { description: "this is a test", name: "test" } },
        };
        const expected = {
            components: { schemas: { fun: { name: "fun" }, fun2: { name: "fun2" } } },
            paths: { path1: { description: "this is a test", name: "test" } },
        };

        objectMerge(a, b);

        expect(a).toStrictEqual(expected);
    });

    it("merges path without overriding other path", () => {
        expect.assertions(1);

        const a = {
            paths: { path1: { description: "this is a test", name: "test" } },
        };
        const b = {
            paths: { path2: { description: "this is a test", name: "test" } },
        };
        const expected = {
            paths: {
                path1: { description: "this is a test", name: "test" },
                path2: { description: "this is a test", name: "test" },
            },
        };

        objectMerge(a as object, b as object);

        expect(a).toStrictEqual(expected);
    });

    it("merges 2 deep", () => {
        expect.assertions(1);

        const a = {
            a: {
                b: {
                    description: "this is a test",
                    name: "test",
                    old: "hi",
                },
            },
        };
        const b = {
            a: {
                b: {
                    description: "this is a test2",
                    name: "test2",
                },
            },
        };
        const expected = {
            a: {
                b: {
                    description: "this is a test2",
                    name: "test2",
                    old: "hi",
                },
            },
        };

        objectMerge(a as object, b as object);

        expect(a).toStrictEqual(expected);
    });

    it("overrides 3 deep", () => {
        expect.assertions(1);

        const a = {
            a: {
                b: {
                    c: {
                        description: "this is a test",
                        name: "test",
                        old: "hi",
                    },
                },
            },
        };
        const b = {
            a: {
                b: {
                    c: {
                        description: "this is a test2",
                        name: "test2",
                    },
                },
            },
        };
        const expected = {
            a: {
                b: {
                    c: {
                        description: "this is a test2",
                        name: "test2",
                    },
                },
            },
        };

        objectMerge(a as object, b as object);

        expect(a).toStrictEqual(expected);
    });

    it("ignores __proto__ keys instead of polluting the prototype", () => {
        expect.assertions(3);

        const a: Record<string, unknown> = {};
        // Build `b` with a real own `__proto__` key (as the `yaml` parser surfaces it).
        const b: Record<string, unknown> = {};

        Object.defineProperty(b, "__proto__", {
            configurable: true,
            enumerable: true,
            value: { polluted: true },
            writable: true,
        });

        objectMerge(a, b);

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.prototype).not.toHaveProperty("polluted");
        expect(Object.getPrototypeOf(a)).toBe(Object.prototype);
    });

    it("ignores forbidden sub-keys during deep merge", () => {
        expect.assertions(2);

        const a: Record<string, Record<string, unknown>> = { components: { schemas: {} } };
        const b: Record<string, Record<string, unknown>> = { components: {} };

        Object.defineProperty(b.components, "constructor", {
            configurable: true,
            enumerable: true,
            value: { hacked: true },
            writable: true,
        });

        objectMerge(a, b);

        expect((a.components as Record<string, unknown>).hacked).toBeUndefined();
        expect(a.components.constructor).toBe(Object);
    });

    it("overrides 4 deep", () => {
        expect.assertions(1);

        const a = {
            a: {
                b: {
                    c: {
                        d: {
                            description: "this is a test",
                            name: "test",
                            old: "hi",
                        },
                    },
                },
            },
        };
        const b = {
            a: {
                b: {
                    c: {
                        d: {
                            description: "this is a test2",
                            name: "test2",
                        },
                    },
                },
            },
        };
        const expected = {
            a: {
                b: {
                    c: {
                        d: {
                            description: "this is a test2",
                            name: "test2",
                        },
                    },
                },
            },
        };

        objectMerge(a as object, b as object);

        expect(a).toStrictEqual(expected);
    });
});
