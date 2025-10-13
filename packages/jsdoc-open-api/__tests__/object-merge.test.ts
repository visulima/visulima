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
