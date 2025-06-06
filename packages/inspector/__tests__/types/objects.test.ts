import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe.each([
    ["objects", inspect],
    ["objects (Object.create(null))", (object, ...rest) => inspect(Object.assign(Object.create(null), object), ...rest)],
])("%s", (name, function_) => {
    // eslint-disable-next-line vitest/require-hook
    let tag = "[Object: null prototype] ";

    if (name === "objects") {
        tag = "";
    }

    it("returns `{}` for empty objects", () => {
        expect.assertions(1);

        expect(function_({})).toBe(`${tag}{}`);
    });

    it("should show a simple object with indent", () => {
        expect.assertions(2);

        const object = { a: 1, b: 2 };

        expect(inspect(object, { indent: 2 })).toMatchFileSnapshot(`simple object with indent ${name}`);
        expect(inspect(object, { indent: "\t" })).toMatchFileSnapshot(`simple object with indent ${name}`);
    });

    it("should show two deep object with indent", () => {
        expect.assertions(2);

        const object = { a: 1, b: { c: 3, d: 4 } };

        expect(inspect(object, { indent: 2 })).toMatchFileSnapshot(`two deep object with indent ${name}`);
        expect(inspect(object, { indent: "\t" })).toMatchFileSnapshot(`two deep object with indent ${name}`);
    });

    it("quotes a key if it contains special chars", () => {
        expect.assertions(2);

        expect(function_({ "a.b": 1 })).toBe(`${tag}{ 'a.b': 1 }`);
        expect(function_({ "a b": 1 })).toBe(`${tag}{ 'a b': 1 }`);
    });

    it("quotes a key if it is empty", () => {
        expect.assertions(1);

        expect(function_({ "": 1 })).toBe(`${tag}{ '': 1 }`);
    });

    it("quotes a key if it contains a single quote", () => {
        expect.assertions(1);

        expect(function_({ "'": 1 })).toBe(`${tag}{ '\\'': 1 }`);
    });

    it("quotes a key if it contains a double quote", () => {
        expect.assertions(1);

        expect(function_({ "\"": 1 })).toBe(`${tag}{ '"': 1 }`);
    });

    if (name === "objects") {
        // eslint-disable-next-line vitest/no-conditional-tests
        it("should detects circular references", () => {
            expect.assertions(1);

            const main = {};

            // @ts-expect-error - missing property
            main.a = main;

            expect(function_(main)).toBe(`${tag}{ a: [Circular] }`);
        });

        // eslint-disable-next-line vitest/no-conditional-tests
        it("should detects circular references in nested objects", () => {
            expect.assertions(2);

            const object = { a: 1, b: [3, 4] };

            // @ts-expect-error - missing property
            object.c = object;

            expect(inspect(object)).toBe("{ a: 1, b: [ 3, 4 ], c: [Circular] }");

            const double = {};

            // @ts-expect-error - missing property
            double.a = [double];
            // @ts-expect-error - missing property
            double.b = {};
            // @ts-expect-error - missing property
            double.b.inner = double.b;
            // @ts-expect-error - missing property
            double.b.obj = double;

            expect(inspect(double)).toBe("{ a: [ [Circular] ], b: { inner: [Circular], obj: [Circular] } }");
        });
    }

    it("returns `{}` for empty objects with an anonoymous prototype", () => {
        expect.assertions(1);

        expect(function_(Object.create({ a: 1 }))).toBe(`${tag}{}`);
    });

    it("returns `{}` for empty objects with a null prototype", () => {
        expect.assertions(1);

        expect(function_(Object.create(Object.create(null)))).toBe("[Object: null prototype] {}");
    });

    it("shows objects' own properties for objects with an anonoymous prototype", () => {
        expect.assertions(1);

        const object = Object.create({ a: 1 });

        object.b = 2;

        expect(function_(object)).toBe(`${tag}{ b: 2 }`);
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 20 })).toBe(`${tag}{ a: 1, b: 2, c: 3 }`);
        });

        it("maxStringLengths object values longer than maxStringLength (19)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 19 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (18)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 18 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (17)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 17 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (16)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 16 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (15)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 15 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (14)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 14 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (13)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 13 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (12)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 12 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (11)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 11 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (10)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 10 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (9)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 9 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (8)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 8 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (7)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 7 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (6)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 6 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (5)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 5 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (4)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 4 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (3)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 3 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (2)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 2 })).toBe(`${tag}{ …(3) }`);
        });

        it("maxStringLengths object values longer than maxStringLength (1)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 1 })).toBe(`${tag}{ …(3) }`);
        });
    });

    describe("sorted", () => {
        it("returns the object with sorted keys", () => {
            expect.assertions(1);

            expect(function_({ a: 2, b: 1 }, { sorted: true })).toBe(`${tag}{ a: 2, b: 1 }`);
        });

        it("returns the object with sorted keys using a custom sort function", () => {
            expect.assertions(1);

            expect(
                function_({ a: 2, b: 1 }, {
                    sorted: (a, b) => {
                        if (a > b) {
                            return -1;
                        }

                        if (a < b) {
                            return 1;
                        }

                        return 0;
                    },
                }),
            ).toBe(`${tag}{ b: 1, a: 2 }`);
        });
    });

    describe("getters", () => {
        it("returns the object with getters invoked", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; } }, { getters: true })).toBe(`${tag}{ a: 1 }`);
        });

        it("returns the object with getters invoked (get)", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; } }, { getters: "get" })).toBe(`${tag}{ a: 1 }`);
        });

        it("returns the object with getters invoked (set)", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; }, set a(v) {} }, { getters: "set" })).toBe(`${tag}{ a: 1 }`);
        });

        it("returns the object with getters not invoked if they have a setter", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; }, set a(v) {} }, { getters: "get" })).toBe(`${tag}${name === "objects" ? `{ a: [Function: get a() {\n        return 1;\n      }] }` : "{ a: 1 }"}`);
        });

        it("returns the object with getters not invoked if they don't have a setter", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; } }, { getters: "set" })).toBe(`${tag}${name === "objects" ? `{ a: [Function: get a() {\n        return 1;\n      }] }` : "{ a: 1 }"}`);
        });

        it("catches errors thrown by getters", () => {
            expect.assertions(1);

            expect(
               function_(
                    {
                        get a() {
                            throw new Error("test");
                        },
                    },
                    { getters: true },
                ),
            ).toBe(`${tag}{ a: [Function: get a] }`);
        });
    });
});

describe("object prototype", () => {
    it("should display correct when prototype is Object.prototype", () => {
        expect.assertions(1);

        const object = {};

        expect(inspect(object)).toBe("{}");
    });

    it("should display correct when prototype is null", () => {
        expect.assertions(1);

        const object = Object.create(null);

        expect(inspect(object)).toBe("[Object: null prototype] {}");
    });

    it("should display correct when prototype from new", () => {
        expect.assertions(1);

        // eslint-disable-next-line func-style
        function Foo() {}

        const object = new Foo();

        expect(inspect(object)).toBe("Foo {}");
    });
});
