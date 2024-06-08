// eslint-disable-next-line max-classes-per-file
import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

class Foo {}

describe("classes", () => {
    it("returns constructor name with object literal notation for an empty class", () => {
        expect.assertions(1);

        expect(inspect(new Foo())).toBe("Foo{}");
    });

    it("returns `<Anonymous Class>{}` for anonymous classes", () => {
        expect.assertions(1);

        const anon = () => class {};

        expect(inspect(new (anon())())).toBe("<Anonymous Class>{}");
    });

    it("returns toStringTag value as name if present", () => {
        expect.assertions(1);

        class Bar {
            get [Symbol.toStringTag]() {
                return "Baz";
            }
        }
        const bar = new Bar();

        expect(inspect(bar)).toBe("Baz{}");
    });

    describe("properties", () => {
        it("inspects and outputs properties", () => {
            expect.assertions(1);

            const foo = new Foo();
            foo.bar = 1;
            foo.baz = "hello";

            expect(inspect(foo)).toBe("Foo{ bar: 1, baz: 'hello' }");
        });

        it("inspects and outputs Symbols", () => {
            expect.assertions(1);

            const foo = new Foo();
            foo[Symbol("foo")] = 1;

            expect(inspect(foo)).toBe("Foo{ [Symbol(foo)]: 1 }");
        });
    });
});
