// eslint-disable-next-line max-classes-per-file
import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class Foo {}

describe("classes", () => {
    it("returns constructor name with object literal notation for an empty class", () => {
        expect.assertions(1);

        expect(inspect(new Foo())).toBe("Foo {}");
    });

    it("returns `<Anonymous Class>{}` for anonymous classes", () => {
        expect.assertions(1);

        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        const anon = () => class {};

        expect(inspect(new (anon())())).toBe("<Anonymous Class> {}");
    });

    it("returns toStringTag value as name if present", () => {
        expect.assertions(1);

        class Bar {
            // eslint-disable-next-line class-methods-use-this
            public get [Symbol.toStringTag]() {
                return "Baz";
            }
        }
        const bar = new Bar();

        expect(inspect(bar)).toBe("Bar [Baz] {}");
    });

    describe("properties", () => {
        it("inspects and outputs properties", () => {
            expect.assertions(1);

            const foo = new Foo();

            // @ts-expect-error - testing non-standard property
            foo.bar = 1;
            // @ts-expect-error - testing non-standard property
            foo.baz = "hello";

            expect(inspect(foo)).toBe("Foo { bar: 1, baz: 'hello' }");
        });

        it("inspects and outputs Symbols", () => {
            expect.assertions(1);

            const foo = new Foo();

            // @ts-expect-error - testing non-standard property
            foo[Symbol("foo")] = 1;

            expect(inspect(foo)).toBe("Foo { [Symbol(foo)]: 1 }");
        });
    });

    it("should print \"Symbol.toStringTag\" on a instances", () => {
        expect.assertions(4);

        // eslint-disable-next-line func-style
        function C() {
            this.a = 1;
        }

        expect(Object.prototype.toString.call(new C()), "instance, no toStringTag, Object.prototype.toString").toBe("[object Object]");
        expect(inspect(new C()), "instance, no toStringTag").toBe("C { a: 1 }");

        C.prototype[Symbol.toStringTag] = "Class!";

        expect(Object.prototype.toString.call(new C()), "instance, with toStringTag, Object.prototype.toString").toBe("[object Class!]");
        expect(inspect(new C()), "instance, with toStringTag").toBe("C [Class!] { a: 1 }");
    });
});
