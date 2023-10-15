import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import deepClone from "../src";

const rnd = (max) => Math.round(Math.random() * max);

const standardObjectAssert = (copy: object, input: object): void => {
    expect(copy).toStrictEqual(input);
    expect(String(copy)).toBe(String(input));
    expect(copy).not.toBe(input);
};

const assertRegExp = (copy: RegExp, input: RegExp) => {
    expect(copy.source).toBe(input.source);
    expect(copy.flags).toBe(input.flags);
    expect(copy.dotAll).toBe(input.dotAll);
    expect(copy.global).toBe(input.global);
    expect(copy.ignoreCase).toBe(input.ignoreCase);
    expect(copy.multiline).toBe(input.multiline);
    expect(copy.sticky).toBe(input.sticky);
    expect(copy.unicode).toBe(input.unicode);
    expect(copy.lastIndex).toBe(input.lastIndex);

    standardObjectAssert(copy, input);
};

describe("deepClone", () => {
    it("should throw TypeError when trying to copy WeakMap objects", () => {
        expect(() => {
            const entries = [
                [new Object(), "foo"],
                [new Object(), 64],
            ] as const;

            deepClone(new WeakMap<object, unknown>(entries));
        }).toThrow(TypeError);

        expect(() => {
            const object = {
                foo: new WeakMap(),
            };

            deepClone(object);
        }).toThrow(TypeError);

        expect(() => {
            const values = ["bar", new WeakMap(), "baz"];

            deepClone(new Set(values));
        }).toThrow(TypeError);
    });

    it("should throw TypeError when trying to copy WeakSet objects", () => {
        expect(() => {
            const values = [new Object(), new Object()];

            deepClone(new WeakSet(values));
        }).toThrow(TypeError);

        expect(() => {
            const array = [new WeakSet()];

            deepClone(array);
        }).toThrow(TypeError);

        expect(() => {
            const entries = [
                ["foo", 64],
                [77, new WeakSet()],
            ] as const;

            deepClone(new Map<unknown, unknown>(entries));
        }).toThrow(TypeError);
    });

    it("should throw TypeError when trying to copy SharedArrayBuffer objects", () => {
        expect(() => {
            deepClone(new SharedArrayBuffer(64));
        }).toThrow(TypeError);

        expect(() => {
            const array = [new SharedArrayBuffer(128)];

            deepClone(array);
        }).toThrow(TypeError);
    });

    it("should throw TypeError when trying to copy DataView objects", () => {
        expect(() => {
            deepClone(new DataView(new ArrayBuffer(64)));
        }).toThrow(TypeError);

        expect(() => {
            const array = [new DataView(new ArrayBuffer(128))];

            deepClone(array);
        }).toThrow(TypeError);
    });

    it("should throw TypeError when trying to copy Promise objects", async () => {
        try {
            // eslint-disable-next-line compat/compat
            const promise = new Promise((resolve) => {
                resolve(undefined);
            });

            deepClone(promise);
        } catch (error) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error).toBeInstanceOf(TypeError);
        }

        try {
            // eslint-disable-next-line compat/compat
            deepClone(new Promise(() => {}));
        } catch (error) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error).toBeInstanceOf(TypeError);
        }
    });

    it("default – does not copy proto properties", async () => {
        expect(deepClone(Object.create({ a: 1 })).a, "value not copied").toBeUndefined();
    });

    it("proto option – copies enumerable proto properties", async () => {
        expect(deepClone(Object.create({ a: 1 }), { proto: true }).a, "value copied").toBe(1);
    });

    it("circles option - circular object", async () => {
        const o = { circular: undefined, nest: { a: 1, b: 2 } };
        o.circular = o;

        expect(deepClone(o, { circles: true }), "same values").toStrictEqual(o);
        expect(deepClone(o, { circles: true }), "different objects").not.toBe(o);
        expect(deepClone(o, { circles: true }).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o, { circles: true });

        expect(c.circular, "circular references point to copied parent").toBe(c);
        expect(c.circular, "circular references do not point to original parent").not.toBe(o);
    });

    it("circles option – deep circular object", async () => {
        const o = { nest: { a: 1, b: 2, circular: undefined } };
        o.nest.circular = o;

        expect(deepClone(o, { circles: true }), "same values").toStrictEqual(o);
        expect(deepClone(o, { circles: true }), "different objects").not.toBe(o);
        expect(deepClone(o, { circles: true }).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o, { circles: true });

        expect(c.nest.circular, "circular references point to copied parent").toBe(c);
        expect(c.nest.circular, "circular references do not point to original parent").not.toBe(o);
    });

    it("circles option alone – does not copy proto properties", async () => {
        expect(deepClone(Object.create({ a: 1 }), { circles: true }).a, "value not copied").toBeUndefined();
    });

    it("circles and proto option – copies enumerable proto properties", async () => {
        expect(deepClone(Object.create({ a: 1 }), { circles: true, proto: true }).a, "value copied").toBe(1);
    });

    it("circles and proto option - circular object", async () => {
        const o = { circular: undefined, nest: { a: 1, b: 2 } };
        o.circular = o;

        expect(deepClone(o, { circles: true, proto: true }), "same values").toStrictEqual(o);
        expect(deepClone(o, { circles: true, proto: true }), "different objects").not.toBe(o);
        expect(deepClone(o, { circles: true, proto: true }).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o, { circles: true, proto: true });

        expect(c.circular, "circular references point to copied parent").toBe(c);
        expect(c.circular, "circular references do not point to original parent").not.toBe(o);
    });

    it("circles and proto option – deep circular object", async () => {
        const o = { nest: { a: 1, b: 2, circular: undefined } };
        o.nest.circular = o;

        expect(deepClone(o, { circles: true, proto: true }), "same values").toStrictEqual(o);
        expect(deepClone(o, { circles: true, proto: true }), "different objects").not.toBe(o);
        expect(deepClone(o, { circles: true, proto: true }).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o, { circles: true, proto: true });

        expect(c.nest.circular, "circular references point to copied parent").toBe(c);
        expect(c.nest.circular, "circular references do not point to original parent").not.toBe(o);
    });

    it("circles and proto option – deep circular array", async () => {
        const o = { nest: [1, 2] };

        // @ts-expect-error - circular reference
        o.nest.push(o);

        expect(deepClone(o, { circles: true, proto: true }), "same values").toStrictEqual(o);
        expect(deepClone(o, { circles: true, proto: true }), "different objects").not.toBe(o);
        expect(deepClone(o, { circles: true, proto: true }).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o, { circles: true, proto: true });

        expect(c.nest[2], "circular references point to copied parent").toBe(c);
        expect(c.nest[2], "circular references do not point to original parent").not.toBe(o);
    });

    it.each([
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [(data) => deepClone(data, { proto: true }), "proto option"],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [(data) => deepClone(data, { circles: true, proto: true }), "circles and proto option"],
    ])(`should work with classes, when proto option is enabled`, (clone) => {
        class Foo {
            public constructor(
                // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
                readonly a: number,
                // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
                readonly b: string,
            ) {}

            // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-member-accessibility
            yeeHaw() {
                throw new Error("Don't invoke me, bro");
            }
        }

        const fooInput = new Foo(64, "bar");
        const fooCopy = clone(fooInput);

        expect(fooCopy.a).toBe(fooInput.a);
        expect(fooCopy.b).toBe(fooInput.b);

        // eslint-disable-next-line vitest/prefer-strict-equal
        expect(Object.getPrototypeOf(fooCopy)).toEqual(Object.getPrototypeOf(fooInput));
        expect(fooCopy.yeeHaw).toBe(fooInput.yeeHaw);
        expect(fooCopy.constructor).toBe(fooInput.constructor);

        expect(Object.getPrototypeOf(fooCopy)).toBe(Foo.prototype);
        expect(fooCopy.yeeHaw).toBe(Foo.prototype.yeeHaw);
        expect(fooCopy.constructor).toBe(Foo);

        standardObjectAssert(fooCopy, fooInput);

        class Bar extends Foo {
            // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
            constructor(
                a: number,
                b: string,
                // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
                readonly c: boolean,
            ) {
                super(a, b);
            }
        }

        const barInput = new Bar(128, "baz", true);
        const barCopy = clone(barInput);

        expect(barCopy.a).toBe(barInput.a);
        expect(barCopy.b).toBe(barInput.b);
        expect(barCopy.c).toBe(barInput.c);

        expect(Object.getPrototypeOf(barCopy)).toBe(Object.getPrototypeOf(barInput));
        expect(barCopy.yeeHaw).toBe(barInput.yeeHaw);
        expect(barCopy.constructor).toBe(barInput.constructor);

        expect(Object.getPrototypeOf(barCopy)).toBe(Bar.prototype);
        expect(barCopy.yeeHaw).toBe(Bar.prototype.yeeHaw);
        expect(barCopy.constructor).toBe(Bar);

        expect(Object.getPrototypeOf(Object.getPrototypeOf(barCopy))).toBe(Foo.prototype);
        expect(barCopy.yeeHaw).toBe(Foo.prototype.yeeHaw);

        standardObjectAssert(barCopy, barInput);
    });

    describe.each([
        [deepClone, "default"],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [(data) => deepClone(data, { proto: true }), "proto option"],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [(data) => deepClone(data, { circles: true }), "circles option"],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [(data) => deepClone(data, { circles: true, proto: true }), "circles and proto option"],
    ])("should", (clone, label) => {
        it(`${label} – number`, async () => {
            expect(clone(64)).toBe(64);
            expect(clone(123_456_789)).toBe(123_456_789);
            expect(clone(-77)).toBe(-77);
            expect(clone(-80_000)).toBe(-80_000);

            expect(clone(1.5)).toBe(1.5);
            expect(clone(420.69)).toBe(420.69);
            expect(clone(-13.37)).toBe(-13.37);
            expect(clone(-654.56)).toBe(-654.56);

            expect(clone(Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
            expect(clone(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
            expect(clone(Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
            expect(clone(Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);

            expect(clone(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
            expect(clone(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);

            expect(clone(Number.NaN)).toBeNaN();
            expect(clone(Number.NaN)).not.toBe(0);
            expect(clone(-1)).not.toBeNaN();
        });

        it(`${label} – string`, async () => {
            expect(clone("foobar")).toBe("foobar");
            expect(clone("yee haw, pardner'")).toBe("yee haw, pardner'");
            expect(clone("")).toBe("");
            expect(clone("úǹíćòdé")).toBe("úǹíćòdé");

            expect(clone("definitely a c-string\0undefined behavior yo")).toBe("definitely a c-string\0undefined behavior yo");

            const veryLongString: string = "a".repeat(1024) + "b".repeat(512) + "c".repeat(256);
            expect(clone(veryLongString)).toBe(veryLongString);
        });

        it(`${label} – BigInt`, async () => {
            expect(clone(BigInt("13579"))).toBe(BigInt("13579"));
            expect(clone(BigInt("99999999999999999999999999999999"))).toBe(BigInt("99999999999999999999999999999999"));
            expect(clone(BigInt("-864297531"))).toBe(BigInt("-864297531"));
            expect(clone(BigInt("-31866526658764854719684918615"))).toBe(BigInt("-31866526658764854719684918615"));
        });

        it(`${label} - should work with symbols (same symbol instance, not just same description)`, () => {
            const fooSymInput = Symbol("foo");
            const fooSymCopy = clone(fooSymInput);

            expect(fooSymCopy).toBe(fooSymInput);
            expect(fooSymCopy.description).toBe(fooSymInput.description);

            // eslint-disable-next-line symbol-description
            const emptySym1Input = Symbol();
            const emptySym2Copy = clone(emptySym1Input);

            expect(emptySym2Copy).toBe(emptySym1Input);
            expect(emptySym2Copy.description).toBe(emptySym1Input.description);

            const barDesc = "bar";
            const barSym1 = Symbol(barDesc);
            const barSym2Copied = clone(Symbol(barDesc));

            expect(barSym2Copied).not.toBe(barSym1);
            expect(barSym2Copied.description).toBe(barSym1.description);

            // eslint-disable-next-line symbol-description
            const emptySym3 = Symbol();
            // eslint-disable-next-line symbol-description
            const emptySym4Copied = clone(Symbol());

            expect(emptySym4Copied).not.toBe(emptySym3);
            expect(emptySym4Copied.description).toBe(emptySym3.description);
        });

        // eslint-disable-next-line vitest/expect-expect
        it(`${label} – RegExp`, async () => {
            const fooInput = /(pee)+ (poo)+/;
            assertRegExp(clone(fooInput), fooInput);

            // eslint-disable-next-line prefer-regex-literals
            const barInput = new RegExp("");
            assertRegExp(clone(barInput), barInput);
            assertRegExp(clone(fooInput), fooInput);

            const bazInput = /foo/gi;
            assertRegExp(clone(bazInput), bazInput);
            assertRegExp(clone(fooInput), fooInput);
        });

        it(`${label} – RegExp with extra functions`, async () => {
            const key = "i don't know man i'm running out of random strings";

            const yeeInput = /foobar/;
            (yeeInput as any).haw = { [key]: 7 };
            (yeeInput as any).yeehaw = true;

            const yeeCopy = clone(yeeInput);

            expect((yeeCopy as any).haw[key]).toBe((yeeInput as any).haw[key]);

            standardObjectAssert((yeeCopy as any).haw, (yeeInput as any).haw);

            expect((yeeCopy as any).yeehaw).toBeTruthy();

            assertRegExp(yeeCopy, yeeInput);
        });

        it(`${label} – JSDOM`, async () => {
            const source = new JSDOM(`<p>Hello world</p>`).window.document;

            const copy: typeof JSDOM = clone<typeof JSDOM>(source);

            expect(source.body.isEqualNode(copy.body)).toBeTruthy();
        });

        it(`${label} – boolean`, async () => {
            expect(clone(true), "same value").toBeTruthy();
            expect(clone(false), "same value").toBeFalsy();
        });

        it(`${label} – undefined`, async () => {
            expect(clone(undefined), "same value").toBeUndefined();
        });

        it(`${label} – null`, async () => {
            expect(clone(null), "same value").toBeNull();
        });

        it(`${label} – function`, async () => {
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = () => {};

            expect(clone(function_), "same function").toBe(function_);
        });

        it(`${label} – async function`, async () => {
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = async () => {};

            expect(clone(function_), "same function").toBe(function_);
        });

        it(`${label} – generator function`, async () => {
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle,@typescript-eslint/no-empty-function
            const function_ = function* () {};

            expect(clone(function_), "same function").toBe(function_);
        });

        it(`${label} – date`, async () => {
            const date = new Date();

            expect(+clone(date), "same value").toBe(+date);
            expect(clone(date), "different object").not.toBe(date);
        });

        it(`${label} – shallow object`, async () => {
            const o = { a: 1, b: 2 };

            expect(clone(o), "same values").toStrictEqual(o);
            expect(clone(o), "different object").not.toBe(o);
        });

        it(`${label} – shallow array`, async () => {
            const o = [1, 2, [], BigInt("123456789"), undefined];

            expect(clone(o), "same values").toStrictEqual(o);
            expect(clone(o), "different arrays").not.toBe(o);
        });

        it(`${label} – deep object`, async () => {
            const o = { nest: { a: 1, b: 2 } };

            expect(clone(o), "same values").toStrictEqual(o);
            expect(clone(o), "different objects").not.toBe(o);
            expect(clone(o.nest), "different nested objects").not.toBe(o.nest);
        });

        it(`${label} – deep array`, async () => {
            const o = [{ a: 1, b: 2 }, [3], [[], BigInt("123456789"), undefined], new Object()];

            // eslint-disable-next-line vitest/prefer-strict-equal
            expect(clone(o), "same values").toEqual(o);
            expect(clone(o), "different arrays").not.toBe(o);
            expect(clone(o)[0], "different array elements").not.toBe(o[0]);
            expect(clone(o)[1], "different array elements").not.toBe(o[1]);

            expect(clone(o)[2][0]).toStrictEqual(o[2][0]);
            expect(clone(o)[2][1]).toStrictEqual(o[2][1]);
            expect(clone(o)[2][2]).toStrictEqual(o[2][2]);
            expect(clone(o)[2]).toStrictEqual(o[2]);
            expect(clone(o)[3]).not.toBe(o[3]);
        });

        it(`${label} – nested number`, async () => {
            expect(clone({ a: 1 }).a, "same value").toBe(1);
        });

        it(`${label} – nested string`, async () => {
            expect(clone({ s: "str" }).s, "same value").toBe("str");
        });

        it(`${label} – nested boolean`, async () => {
            expect(clone({ b: true }).b, "same value").toBeTruthy();
        });

        it(`${label} – nested function`, async () => {
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = () => {};

            expect(clone({ fn: function_ }).fn, "same function").toBe(function_);
        });

        it(`${label} – nested async function`, async () => {
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = async () => {};

            expect(clone({ fn: function_ }).fn, "same function").toBe(function_);
        });

        it(`${label} – nested generator function`, async () => {
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle,@typescript-eslint/no-empty-function
            const function_ = function* () {};

            expect(clone({ fn: function_ }).fn, "same function").toBe(function_);
        });

        it(`${label} – nested date`, async () => {
            const date = new Date();

            expect(+clone({ d: date }).d, "same value").toBe(+date);
            expect(clone({ d: date }).d, "different object").not.toBe(date);
        });

        it(`${label} – nested date in array`, async () => {
            const date = new Date();

            expect(+clone({ d: [date] }).d[0], "same value").toBe(+date);
            expect(clone({ d: [date] }).d[0], "different object").not.toBe(date);

            expect(+clone({ d: [date] }, { circles: true }).d[0], "same value").toBe(+date);
            expect(clone({ d: [date] }, { circles: true }).d, "different object").not.toBe(date);
        });

        it(`${label} – nested null`, async () => {
            expect(clone({ n: null }).n, "same value").toBeNull();
        });

        it(`${label} – arguments`, async () => {
            // eslint-disable-next-line func-style,@typescript-eslint/naming-convention,no-underscore-dangle
            function function_(...arguments_) {
                expect(clone(arguments_), "same values").toStrictEqual(arguments_);
                expect(clone(arguments_), "different object").not.toBe(arguments_);

                // eslint-disable-next-line prefer-rest-params
                expect(clone(arguments), "same values").toStrictEqual(arguments);
                // eslint-disable-next-line prefer-rest-params
                expect(clone(arguments), "different object").not.toBe(arguments);
            }

            function_(1, 2, 3);
        });

        it(`${label} -copies buffers from object correctly`, async () => {
            const input = Date.now().toString(36);
            const inputBuffer = Buffer.from(input);
            const clonedBuffer = clone({ a: inputBuffer }).a;

            expect(Buffer.isBuffer(clonedBuffer), "cloned value is buffer").toBeTruthy();
            expect(clonedBuffer, "cloned buffer is not same as input buffer").not.toBe(inputBuffer);

            expect(clonedBuffer.toString(), "cloned buffer content is correct").toBe(input);
        });

        it(`${label} -copies buffers from arrays correctly`, async () => {
            const input = Date.now().toString(36);
            const inputBuffer = Buffer.from(input);
            const [clonedBuffer] = clone([inputBuffer]);

            expect(Buffer.isBuffer(clonedBuffer), "cloned value is buffer").toBeTruthy();
            expect(clonedBuffer, "cloned buffer is not same as input buffer").not.toBe(inputBuffer);

            expect(clonedBuffer.toString(), "cloned buffer content is correct").toBe(input);
        });

        it(`${label} -copies TypedArrays from object correctly`, async () => {
            const [input1, input2] = [rnd(10), rnd(10)];
            const buffer = new ArrayBuffer(8);
            const int32View = new Int32Array(buffer);

            int32View[0] = input1;
            int32View[1] = input2;

            const cloned = clone({ a: int32View }).a;

            expect(cloned instanceof Int32Array, "cloned value is instance of class").toBeTruthy();
            expect(cloned, "cloned value is not same as input value").not.toBe(int32View);

            expect(cloned[0], "cloned value content is correct").toBe(input1);
            expect(cloned[1], "cloned value content is correct").toBe(input2);
        });

        it(`${label} -copies TypedArrays from array correctly`, async () => {
            const [input1, input2] = [rnd(10), rnd(10)];
            const buffer = new ArrayBuffer(16);
            const int32View = new Int32Array(buffer);

            int32View[0] = input1;
            int32View[1] = input2;

            const [cloned] = clone([int32View]);

            expect(cloned instanceof Int32Array, "cloned value is instance of class").toBeTruthy();
            expect(cloned, "cloned value is not same as input value").not.toBe(int32View);
            expect(cloned[0], "cloned value content is correct").toBe(input1);
            expect(cloned[1], "cloned value content is correct").toBe(input2);
        });

        it(`${label} -copies complex TypedArrays`, async () => {
            const [input1, input2, input3] = [rnd(10), rnd(10), rnd(10)];
            const buffer = new ArrayBuffer(4);
            const view1 = new Int8Array(buffer, 0, 2);
            const view2 = new Int8Array(buffer, 2, 2);
            const view3 = new Int8Array(buffer);

            view1[0] = input1;
            view2[0] = input2;
            view3[3] = input3;

            const cloned = clone({ view1, view2, view3 });

            expect(cloned.view1 instanceof Int8Array, "cloned value is instance of class").toBeTruthy();
            expect(cloned.view2 instanceof Int8Array, "cloned value is instance of class").toBeTruthy();
            expect(cloned.view3 instanceof Int8Array, "cloned value is instance of class").toBeTruthy();
            expect(cloned.view1, "cloned value is not same as input value").not.toBe(view1);
            expect(cloned.view2, "cloned value is not same as input value").not.toBe(view2);
            expect(cloned.view3, "cloned value is not same as input value").not.toBe(view3);
            expect([...cloned.view1], "cloned value content is correct").toStrictEqual([input1, 0]);
            expect([...cloned.view2], "cloned value content is correct").toStrictEqual([input2, input3]);
            expect([...cloned.view3], "cloned value content is correct").toStrictEqual([input1, 0, input2, input3]);
        });

        it(`${label} - should work with Int8Array objects`, () => {
            const fooInput = new Int8Array([-128, -64, 0, 63, 127]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);
            standardObjectAssert(fooCopy, fooInput);
        });

        it(`${label} - should work with Uint8Array objects`, () => {
            const fooInput = new Uint8Array([0, 63, 127, 255]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);
            standardObjectAssert(fooCopy, fooInput);
        });

        it(`${label} - should work with Uint8ClampedArray objects`, () => {
            const fooInput = new Uint8Array([0, 63, 127, 255]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);
            standardObjectAssert(fooCopy, fooInput);
        });

        it(`${label} - should work with Int16Array objects`, () => {
            const fooInput = new Int16Array([-0x80_00, -0x40_00, 0, 0x3f_ff, 0x7f_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);
            standardObjectAssert(fooCopy, fooInput);
        });

        it(`${label} - should work with Uint16Array objects`, () => {
            const fooInput = new Uint16Array([0, 0x3f_ff, 0x7f_ff, 0xff_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);
            standardObjectAssert(fooCopy, fooInput);
        });

        it(`${label} - should work with Int32Array objects`, () => {
            const fooInput = new Int32Array([-0x80_00_00_00, -0x40_00_00_00, 0, 0x3f_ff_ff_ff, 0x7f_ff_ff_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);
            standardObjectAssert(fooCopy, fooInput);
        });

        it(`${label} - should work with Uint32Array objects`, () => {
            const fooInput = new Uint32Array([0, 0x3f_ff_ff_ff, 0x7f_ff_ff_ff, 0xff_ff_ff_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);
            standardObjectAssert(fooCopy, fooInput);
        });

        it(`${label} - maps`, async () => {
            const map = new Map([["a", 1]]);

            expect([...clone(map)], "same value").toStrictEqual([["a", 1]]);
            expect(clone(map), "different object").not.toBe(map);
        });

        it(`${label} - sets`, async () => {
            const set = new Set([1]);

            expect([...clone(set)], "same value").toStrictEqual([1]);
            expect(clone(set), "different object").not.toBe(set);
        });

        it(`${label} - nested maps`, async () => {
            const data = { m: new Map([["a", 1]]) };

            expect([...clone(data).m], "same value").toStrictEqual([["a", 1]]);
            expect(clone(data).m, "different object").not.toBe(data.m);
        });

        it(`${label} - nested sets`, async () => {
            const data = { s: new Set([1]) };

            expect([...clone(data).s], "same value").toStrictEqual([1]);
            expect(clone(data).s, "different object").not.toBe(data.s);
        });
    });
});
