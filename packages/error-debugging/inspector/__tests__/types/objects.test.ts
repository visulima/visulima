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

        expect(inspect(object, { indent: 2 })).toBe(["{", "  a: 1,", "  b: 2", "}"].join("\n"));
        expect(inspect(object, { indent: "\t" })).toBe(["{", "	a: 1,", "	b: 2", "}"].join("\n"));
    });

    it("should show two deep object with indent", () => {
        expect.assertions(2);

        const object = { a: 1, b: { c: 3, d: 4 } };

        expect(inspect(object, { indent: 2 })).toBe(["{", "  a: 1,", "  b: {", "    c: 3,", "    d: 4", "  }", "}"].join("\n"));
        expect(inspect(object, { indent: "\t" })).toBe(["{", "	a: 1,", "	b: {", "		c: 3,", "		d: 4", "	}", "}"].join("\n"));
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

        expect(function_({ "'": 1 })).toBe(String.raw`${tag}{ '\'': 1 }`);
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

    describe("truncate", () => {
        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 20 })).toBe(`${tag}{ a: 1, b: 2, c: 3 }`);
        });

        it("truncates object values longer than truncate (19)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 19 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("truncates object values longer than truncate (18)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 18 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("truncates object values longer than truncate (17)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 17 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("truncates object values longer than truncate (16)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 16 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("truncates object values longer than truncate (15)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 15 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("truncates object values longer than truncate (14)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 14 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("truncates object values longer than truncate (13)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 13 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (12)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 12 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (11)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 11 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (10)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 10 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (9)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 9 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (8)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 8 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (7)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 7 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (6)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 6 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (5)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 5 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (4)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 4 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (3)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 3 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (2)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 2 })).toBe(`${tag}{ …(3) }`);
        });

        it("truncates object values longer than truncate (1)", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { truncate: 1 })).toBe(`${tag}{ …(3) }`);
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
