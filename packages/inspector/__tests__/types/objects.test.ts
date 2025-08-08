import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe.each([
    ["Objects", inspect],
    ["Objects with null prototype", (object, ...rest) => inspect(Object.assign(Object.create(null), object), ...rest)],
])("inspect with %s", (name, function_) => {
    // eslint-disable-next-line vitest/require-hook
    let tag = "[Object: null prototype] ";

    if (name === "Objects") {
        tag = "";
    }

    it("should return '{}' for an empty object", () => {
        expect.assertions(1);

        expect(function_({})).toBe(`${tag}{}`);
    });

    it("should correctly indent a simple object", async () => {
        expect.assertions(2);

        const object = { a: 1, b: 2 };

        await expect(inspect(object, { indent: 2 })).toMatchSnapshot(`simple object with indent`);
        await expect(inspect(object, { indent: "\t" })).toMatchSnapshot(`simple object with indent`);
    });

    it("should correctly indent a two-level nested object", async () => {
        expect.assertions(2);

        const object = { a: 1, b: { c: 3, d: 4 } };

        await expect(inspect(object, { indent: 2 })).toMatchSnapshot(`two deep object with indent`);
        await expect(inspect(object, { indent: "\t" })).toMatchSnapshot(`two deep object with indent`);
    });

    it("should quote keys that contain special characters", () => {
        expect.assertions(2);

        expect(function_({ "a.b": 1 })).toBe(`${tag}{ 'a.b': 1 }`);
        expect(function_({ "a b": 1 })).toBe(`${tag}{ 'a b': 1 }`);
    });

    it("should quote an empty string key", () => {
        expect.assertions(1);

        expect(function_({ "": 1 })).toBe(`${tag}{ '': 1 }`);
    });

    it("should escape and quote keys containing a single quote", () => {
        expect.assertions(1);

        expect(function_({ "'": 1 })).toBe(`${tag}{ '\\'': 1 }`);
    });

    it("should quote keys containing a double quote", () => {
        expect.assertions(1);

        expect(function_({ '"': 1 })).toBe(`${tag}{ '"': 1 }`);
    });

    if (name === "Objects") {
        // eslint-disable-next-line vitest/no-conditional-tests
        it("should detect and represent direct circular references", () => {
            expect.assertions(1);

            const main = {};

            // @ts-expect-error - missing property
            main.a = main;

            expect(function_(main)).toBe(`${tag}{ a: [Circular] }`);
        });

        // eslint-disable-next-line vitest/no-conditional-tests
        it("should detect and represent nested circular references", () => {
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

    it("should return '{}' for an empty object with an anonymous prototype", () => {
        expect.assertions(1);

        expect(function_(Object.create({ a: 1 }))).toBe(`${tag}{}`);
    });

    it("should identify and return '[Object: null prototype] {}' for an object with a null prototype", () => {
        expect.assertions(1);

        expect(function_(Object.create(Object.create(null)))).toBe("[Object: null prototype] {}");
    });

    it("should only show own properties for objects with an anonymous prototype", () => {
        expect.assertions(1);

        const object = Object.create({ a: 1 });

        object.b = 2;

        expect(function_(object)).toBe(`${tag}{ b: 2 }`);
    });

    describe("with maxStringLength option", () => {
        it("should return the full representation when maxStringLength is greater than the actual length", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 20 })).toBe(`${tag}{ a: 1, b: 2, c: 3 }`);
        });

        it("should truncate object values when maxStringLength is 19", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 19 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("should truncate object values when maxStringLength is 18", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 18 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("should truncate object values when maxStringLength is 17", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 17 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("should truncate object values when maxStringLength is 16", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 16 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("should truncate object values when maxStringLength is 15", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 15 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("should truncate object values when maxStringLength is 14", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 14 })).toBe(`${tag}{ a: 1, …(2) }`);
        });

        it("should truncate the entire object when maxStringLength is 13", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 13 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 12", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 12 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 11", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 11 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 10", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 10 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 9", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 9 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 8", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 8 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 7", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 7 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 6", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 6 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 5", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 5 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 4", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 4 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 3", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 3 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 2", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 2 })).toBe(`${tag}{ …(3) }`);
        });

        it("should truncate the entire object when maxStringLength is 1", () => {
            expect.assertions(1);

            expect(function_({ a: 1, b: 2, c: 3 }, { maxStringLength: 1 })).toBe(`${tag}{ …(3) }`);
        });
    });

    describe("with sorted option", () => {
        it("should sort object keys when 'sorted' is true", () => {
            expect.assertions(1);

            expect(
                function_(
                    {
                        b: 1,
                        a: 2,
                    },
                    { sorted: true },
                ),
            ).toBe(`${tag}{ a: 2, b: 1 }`);
        });
    });

    describe("with getters", () => {
        it("should not invoke getters by default", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; } })).toBe(`${tag}{ a: [Function: get a] }`);
        });

        it("should invoke getters when 'getters' is true", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; } }, { getters: true })).toBe(`${tag}{ a: 1 }`);
        });

        it("should invoke getters when 'getters' is 'get'", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; } }, { getters: "get" })).toBe(`${tag}{ a: 1 }`);
        });

        it("should not invoke getters when 'getters' is 'set'", () => {
            expect.assertions(1);

            expect(function_({ get a() { return 1; } }, { getters: "set" })).toBe(`${tag}{ a: [Function: get a] }`);
        });

        it("should handle objects with both getters and setters correctly", () => {
            expect.assertions(3);

            expect(function_({ get a() { return 1; }, set a(v) {} }, { getters: true })).toBe(`${tag}{ a: 1 }`);

            expect(function_({ get a() { return 1; }, set a(v) {} }, { getters: "get" })).toBe(`${tag}{ a: 1 }`);

            expect(function_({ get a() { return 1; }, set a(v) {} }, { getters: "set" })).toBe(`${tag}{ a: [Function: get a] }`);
        });

        it("should handle getters that throw errors", () => {
            expect.assertions(1);

            expect(
                function_({
                    get a() {
                        throw new Error("foo");
                    },
                }),
            ).toBe(`${tag}{ a: [Function: get a] }`);
        });

        it("should show an empty object for a class with only a getter", () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/no-extraneous-class
            class Foo {
                public get a() {
                    return 1;
                }
            }

            expect(inspect(new Foo())).toBe("Foo {}");
        });

        it("should show properties for a class with a constructor and a getter", () => {
            expect.assertions(1);
            function Foo() {
                // @ts-expect-error - testing non-standard property
                this.b = 2;
            }
            Object.defineProperty(Foo.prototype, "a", {
                get() {
                    return 1;
                },
            });
            expect(inspect(new Foo())).toBe("Foo { b: 2 }");
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
