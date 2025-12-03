import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import CustomerrorProto from "../__fixtures__/customerror.proto";
import customerrorSubclass from "../__fixtures__/customerror.subclass";
import { deepClone } from "../src";

const rnd = (max) => Math.round(Math.random() * max);

const assertObject = (copy: object, input: object): void => {
    expect(copy).toStrictEqual(input);
    expect(String(copy)).toBe(String(input));
    expect(copy).not.toBe(input);
};

const assertErrorValues = (copy: Error, input: Error) => {
    expect(copy.message, "equal messages").toStrictEqual(input.message);
    expect(copy.name, "equal names").toStrictEqual(input.name);
    expect(copy.stack, "equal stack trace").toStrictEqual(input.stack);
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

    assertObject(copy, input);
};

describe(deepClone, () => {
    it("should throw TypeError when trying to copy WeakMap objects", () => {
        expect.assertions(3);

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
        expect.assertions(3);

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
        expect.assertions(2);

        expect(() => {
            deepClone(new SharedArrayBuffer(64));
        }).toThrow(TypeError);

        expect(() => {
            const array = [new SharedArrayBuffer(128)];

            deepClone(array);
        }).toThrow(TypeError);
    });

    it("should throw TypeError when trying to copy Promise objects", async () => {
        expect.assertions(2);

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

    it("should clone a DataView object", () => {
        expect.assertions(4);

        const dataview64 = new DataView(new ArrayBuffer(64));

        expect(deepClone(dataview64), "same values").toStrictEqual(dataview64);
        expect(deepClone(dataview64), "different objects").not.toBe(dataview64);

        const dataview128 = new DataView(new ArrayBuffer(128));

        expect(deepClone(dataview128), "same values").toStrictEqual(dataview128);
        expect(deepClone(dataview128), "different objects").not.toBe(dataview128);
    });

    it("should clone enumerable proto properties", async () => {
        expect.assertions(1);

        expect(deepClone(Object.create({ a: 1 })).a, "value copied").toBe(1);
    });

    it("should clone a circular object", async () => {
        expect.assertions(5);

        const o = { circular: undefined, nest: { a: 1, b: 2 } };

        o.circular = o;

        expect(deepClone(o), "same values").toStrictEqual(o);
        expect(deepClone(o), "different objects").not.toBe(o);
        expect(deepClone(o).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o);

        expect(c.circular, "circular references point to copied parent").toBe(c);
        expect(c.circular, "circular references do not point to original parent").not.toBe(o);
    });

    it("should deep clone a circular object", async () => {
        expect.assertions(5);

        const o = { nest: { a: 1, b: 2, circular: undefined } };

        o.nest.circular = o;

        expect(deepClone(o), "same values").toStrictEqual(o);
        expect(deepClone(o), "different objects").not.toBe(o);
        expect(deepClone(o).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o);

        expect(c.nest.circular, "circular references point to copied parent").toBe(c);
        expect(c.nest.circular, "circular references do not point to original parent").not.toBe(o);
    });

    it("should deep clone a circular array", async () => {
        expect.assertions(5);

        const o = { nest: [1, 2] };

        // @ts-expect-error - circular reference
        o.nest.push(o);

        expect(deepClone(o), "same values").toStrictEqual(o);
        expect(deepClone(o), "different objects").not.toBe(o);
        expect(deepClone(o).nest, "different nested objects").not.toBe(o.nest);

        const c = deepClone(o);

        expect(c.nest[2], "circular references point to copied parent").toBe(c);
        expect(c.nest[2], "circular references do not point to original parent").not.toBe(o);
    });

    it(`should strict clone all classes properties`, () => {
        expect.assertions(25);

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
        const fooCopy = deepClone(fooInput, { strict: true });

        expect(fooCopy.a).toBe(fooInput.a);
        expect(fooCopy.b).toBe(fooInput.b);

        // eslint-disable-next-line vitest/prefer-strict-equal
        expect(Object.getPrototypeOf(fooCopy)).toEqual(Object.getPrototypeOf(fooInput));
        expect(fooCopy.yeeHaw).toBe(fooInput.yeeHaw);
        expect(fooCopy.constructor).toBe(fooInput.constructor);

        expect(Object.getPrototypeOf(fooCopy)).toBe(Foo.prototype);
        expect(fooCopy.yeeHaw).toBe(Foo.prototype.yeeHaw);
        expect(fooCopy.constructor).toBe(Foo);

        assertObject(fooCopy, fooInput);

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
        const barCopy = deepClone(barInput, { strict: true });

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

        assertObject(barCopy, barInput);
    });

    describe.each([
        [deepClone, "loose"],

        [(data: any) => deepClone(data, { strict: true }), "strict"],
    ])("should", (clone, label) => {
        it(`${label} clone a number`, async () => {
            expect.assertions(17);

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

        it(`${label} clone a string`, async () => {
            expect.assertions(6);

            expect(clone("foobar")).toBe("foobar");
            expect(clone("yee haw, pardner'")).toBe("yee haw, pardner'");
            expect(clone("")).toBe("");
            expect(clone("úǹíćòdé")).toBe("úǹíćòdé");

            expect(clone("definitely a c-string\0undefined behavior yo")).toBe("definitely a c-string\0undefined behavior yo");

            const veryLongString: string = "a".repeat(1024) + "b".repeat(512) + "c".repeat(256);

            expect(clone(veryLongString)).toBe(veryLongString);
        });

        it(`${label} clone a BigInt`, async () => {
            expect.assertions(4);

            expect(clone(13_579n)).toBe(13_579n);
            expect(clone(99_999_999_999_999_999_999_999_999_999_999n)).toBe(99_999_999_999_999_999_999_999_999_999_999n);
            expect(clone(-864_297_531n)).toBe(-864_297_531n);
            expect(clone(-31_866_526_658_764_854_719_684_918_615n)).toBe(-31_866_526_658_764_854_719_684_918_615n);
        });

        it(`${label} clone a symbols (same symbol instance, not just same description)`, () => {
            expect.assertions(8);

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

        it(`${label} clone a RegExp`, async () => {
            expect.assertions(60);

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

        it(`${label} clone a JSDOM`, async () => {
            expect.assertions(1);

            const source = new JSDOM(`<p>Hello world</p>`).window.document;

            const copy: typeof JSDOM = clone<typeof JSDOM>(source);

            expect(source.body.isEqualNode(copy.body)).toBe(true);
        });

        it(`${label} clone a boolean`, async () => {
            expect.assertions(2);

            expect(clone(true), "same value").toBe(true);
            expect(clone(false), "same value").toBe(false);
        });

        it(`${label} clone a undefined`, async () => {
            expect.assertions(1);

            expect(clone(undefined), "same value").toBeUndefined();
        });

        it(`${label} clone a null`, async () => {
            expect.assertions(1);

            expect(clone(null), "same value").toBeNull();
        });

        it(`${label} clone a function`, async () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = () => {};

            expect(clone(function_), "same function").toBe(function_);
        });

        it(`${label} clone a async function`, async () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = async () => {};

            expect(clone(function_), "same function").toBe(function_);
        });

        it(`${label} clone a generator function`, async () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = function* () {};

            expect(clone(function_), "same function").toBe(function_);
        });

        it(`${label} clone a date`, async () => {
            expect.assertions(2);

            const date = new Date();

            expect(+clone(date), "same value").toBe(+date);
            expect(clone(date), "different object").not.toBe(date);
        });

        it(`${label} clone a shallow object`, async () => {
            expect.assertions(2);

            const o = { a: 1, b: 2 };

            expect(clone(o), "same values").toStrictEqual(o);
            expect(clone(o), "different object").not.toBe(o);
        });

        it(`${label} clone a shallow array`, async () => {
            expect.assertions(2);

            const o = [1, 2, [], 123_456_789n, undefined];

            expect(clone(o), "same values").toStrictEqual(o);
            expect(clone(o), "different arrays").not.toBe(o);
        });

        it(`${label} clone a deep object`, async () => {
            expect.assertions(3);

            const o = { nest: { a: 1, b: 2 } };

            expect(clone(o), "same values").toStrictEqual(o);
            expect(clone(o), "different objects").not.toBe(o);
            expect(clone(o.nest), "different nested objects").not.toBe(o.nest);
        });

        it(`${label} clone a deep array`, async () => {
            expect.assertions(9);

            const o = [{ a: 1, b: 2 }, [3], [[], 123_456_789n, undefined], new Object()];

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

        it(`${label} clone a nested number`, async () => {
            expect.assertions(1);

            expect(clone({ a: 1 }).a, "same value").toBe(1);
        });

        it(`${label} clone a nested string`, async () => {
            expect.assertions(1);

            expect(clone({ s: "str" }).s, "same value").toBe("str");
        });

        it(`${label} clone a nested boolean`, async () => {
            expect.assertions(1);

            expect(clone({ b: true }).b, "same value").toBe(true);
        });

        it(`${label} clone a nested function`, async () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = () => {};

            expect(clone({ fn: function_ }).fn, "same function").toBe(function_);
        });

        it(`${label} clone a nested async function`, async () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = async () => {};

            expect(clone({ fn: function_ }).fn, "same function").toBe(function_);
        });

        it(`${label} clone a nested generator function`, async () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const function_ = function* () {};

            expect(clone({ fn: function_ }).fn, "same function").toBe(function_);
        });

        it(`${label} clone a nested date`, async () => {
            expect.assertions(2);

            const date = new Date();

            expect(+clone({ d: date }).d, "same value").toBe(+date);
            expect(clone({ d: date }).d, "different object").not.toBe(date);
        });

        it(`${label} clone a nested date in array`, async () => {
            expect.assertions(4);

            const date = new Date();

            expect(+clone({ d: [date] }).d[0], "same value").toBe(+date);
            expect(clone({ d: [date] }).d[0], "different object").not.toBe(date);

            expect(+clone({ d: [date] }).d[0], "same value").toBe(+date);
            expect(clone({ d: [date] }).d, "different object").not.toBe(date);
        });

        it(`${label} clone a nested null`, async () => {
            expect.assertions(1);

            expect(clone({ n: null }).n, "same value").toBeNull();
        });

        it(`${label} clone a arguments`, async () => {
            expect.assertions(4);

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

        it(`${label} clone buffers from object correctly`, async () => {
            expect.assertions(3);

            const input = Date.now().toString(36);
            const inputBuffer = Buffer.from(input);
            const clonedBuffer = clone({ a: inputBuffer }).a;

            expect(Buffer.isBuffer(clonedBuffer), "cloned value is buffer").toBe(true);
            expect(clonedBuffer, "cloned buffer is not same as input buffer").not.toBe(inputBuffer);

            expect(clonedBuffer.toString(), "cloned buffer content is correct").toBe(input);
        });

        it(`${label} clone buffers from arrays correctly`, async () => {
            expect.assertions(3);

            const input = Date.now().toString(36);
            const inputBuffer = Buffer.from(input);
            const [clonedBuffer] = clone([inputBuffer]);

            expect(Buffer.isBuffer(clonedBuffer), "cloned value is buffer").toBe(true);
            expect(clonedBuffer, "cloned buffer is not same as input buffer").not.toBe(inputBuffer);

            expect(clonedBuffer.toString(), "cloned buffer content is correct").toBe(input);
        });

        it(`${label} clone TypedArrays from object correctly`, async () => {
            expect.assertions(4);

            const [input1, input2] = [rnd(10), rnd(10)];
            const buffer = new ArrayBuffer(8);
            const int32View = new Int32Array(buffer);

            int32View[0] = input1;
            int32View[1] = input2;

            const cloned = clone({ a: int32View }).a;

            expect(cloned instanceof Int32Array, "cloned value is instance of class").toBe(true);
            expect(cloned, "cloned value is not same as input value").not.toBe(int32View);

            expect(cloned[0], "cloned value content is correct").toBe(input1);
            expect(cloned[1], "cloned value content is correct").toBe(input2);
        });

        it(`${label} clone TypedArrays from array correctly`, async () => {
            expect.assertions(4);

            const [input1, input2] = [rnd(10), rnd(10)];
            const buffer = new ArrayBuffer(16);
            const int32View = new Int32Array(buffer);

            int32View[0] = input1;
            int32View[1] = input2;

            const [cloned] = clone([int32View]);

            expect(cloned instanceof Int32Array, "cloned value is instance of class").toBe(true);
            expect(cloned, "cloned value is not same as input value").not.toBe(int32View);
            expect(cloned[0], "cloned value content is correct").toBe(input1);
            expect(cloned[1], "cloned value content is correct").toBe(input2);
        });

        it(`${label} clone complex TypedArrays`, async () => {
            expect.assertions(9);

            const [input1, input2, input3] = [rnd(10), rnd(10), rnd(10)];
            const buffer = new ArrayBuffer(4);
            const view1 = new Int8Array(buffer, 0, 2);
            const view2 = new Int8Array(buffer, 2, 2);
            const view3 = new Int8Array(buffer);

            view1[0] = input1;
            view2[0] = input2;
            view3[3] = input3;

            const cloned = clone({ view1, view2, view3 });

            expect(cloned.view1 instanceof Int8Array, "cloned value is instance of class").toBe(true);
            expect(cloned.view2 instanceof Int8Array, "cloned value is instance of class").toBe(true);
            expect(cloned.view3 instanceof Int8Array, "cloned value is instance of class").toBe(true);
            expect(cloned.view1, "cloned value is not same as input value").not.toBe(view1);
            expect(cloned.view2, "cloned value is not same as input value").not.toBe(view2);
            expect(cloned.view3, "cloned value is not same as input value").not.toBe(view3);
            expect([...cloned.view1], "cloned value content is correct").toStrictEqual([input1, 0]);
            expect([...cloned.view2], "cloned value content is correct").toStrictEqual([input2, input3]);
            expect([...cloned.view3], "cloned value content is correct").toStrictEqual([input1, 0, input2, input3]);
        });

        it(`${label} clone a Int8Array objects`, () => {
            expect.assertions(9);

            const fooInput = new Int8Array([-128, -64, 0, 63, 127]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);

            assertObject(fooCopy, fooInput);
        });

        it(`${label} clone a Uint8Array objects`, () => {
            expect.assertions(9);

            const fooInput = new Uint8Array([0, 63, 127, 255]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);

            assertObject(fooCopy, fooInput);
        });

        it(`${label} clone a Uint8ClampedArray objects`, () => {
            expect.assertions(9);

            const fooInput = new Uint8Array([0, 63, 127, 255]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);

            assertObject(fooCopy, fooInput);
        });

        it(`${label} clone a Int16Array objects`, () => {
            expect.assertions(9);

            const fooInput = new Int16Array([-0x80_00, -0x40_00, 0, 0x3f_ff, 0x7f_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);

            assertObject(fooCopy, fooInput);
        });

        it(`${label} clone a Uint16Array objects`, () => {
            expect.assertions(9);

            const fooInput = new Uint16Array([0, 0x3f_ff, 0x7f_ff, 0xff_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);

            assertObject(fooCopy, fooInput);
        });

        it(`${label} clone a Int32Array objects`, () => {
            expect.assertions(9);

            const fooInput = new Int32Array([-0x80_00_00_00, -0x40_00_00_00, 0, 0x3f_ff_ff_ff, 0x7f_ff_ff_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);

            assertObject(fooCopy, fooInput);
        });

        it(`${label} clone a Uint32Array objects`, () => {
            expect.assertions(9);

            const fooInput = new Uint32Array([0, 0x3f_ff_ff_ff, 0x7f_ff_ff_ff, 0xff_ff_ff_ff]);
            const fooCopy = clone(fooInput);

            expect(fooCopy).toHaveLength(fooInput.length);
            expect(fooCopy[0]).toBe(fooInput[0]);
            expect(fooCopy[1]).toBe(fooInput[1]);
            expect(fooCopy[2]).toBe(fooInput[2]);
            expect(fooCopy[3]).toBe(fooInput[3]);
            expect(fooCopy[4]).toBe(fooInput[4]);

            assertObject(fooCopy, fooInput);
        });

        it(`${label} clone a Map`, async () => {
            expect.assertions(2);

            const map = new Map([["a", 1]]);

            expect([...clone(map)], "same value").toStrictEqual([["a", 1]]);
            expect(clone(map), "different object").not.toBe(map);
        });

        it(`${label} clone a Set`, async () => {
            expect.assertions(2);

            const set = new Set([1]);

            expect([...clone(set)], "same value").toStrictEqual([1]);
            expect(clone(set), "different object").not.toBe(set);
        });

        it(`${label} clone a nested Map`, async () => {
            expect.assertions(2);

            const data = { m: new Map([["a", 1]]) };

            expect([...clone(data).m], "same value").toStrictEqual([["a", 1]]);
            expect(clone(data).m, "different object").not.toBe(data.m);
        });

        it(`${label} clone a nested Set`, async () => {
            expect.assertions(2);

            const data = { s: new Set([1]) };

            expect([...clone(data).s], "same value").toStrictEqual([1]);
            expect(clone(data).s, "different object").not.toBe(data.s);
        });

        it(`${label} clone a generic <Error> object`, () => {
            expect.assertions(7);

            const error1 = new Error("beep");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of Error").instanceof(Error);

            assertErrorValues(error2, error1);
        });

        it(`${label} clone a <TypeError>`, () => {
            expect.assertions(7);

            const error1 = new TypeError("invalid type");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of TypeError").instanceof(TypeError);

            assertErrorValues(error2, error1);
        });

        it(`${label} clone a <RangeError>`, () => {
            expect.assertions(7);

            const error1 = new RangeError("out-of-range");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of RangeError").instanceof(RangeError);

            assertErrorValues(error2, error1);
        });

        it(`${label} clone a <SyntaxError>`, () => {
            expect.assertions(7);

            const error1 = new SyntaxError("bad syntax");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of SyntaxError").instanceof(SyntaxError);

            assertErrorValues(error2, error1);
        });

        it(`${label} clone a <ReferenceError>`, () => {
            expect.assertions(7);

            const error1 = new ReferenceError("undefined variable");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of ReferenceError").instanceof(ReferenceError);

            assertErrorValues(error2, error1);
        });

        it(`${label} clone a <EvalError>`, () => {
            expect.assertions(7);

            const error1 = new EvalError("eval err1");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of EvalError").instanceof(EvalError);

            assertErrorValues(error2, error1);
        });

        it(`${label} clone a <URIError>`, () => {
            expect.assertions(7);

            const error1 = new URIError("bad URI");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of URIError").instanceof(URIError);

            assertErrorValues(error2, error1);
        });

        it.todo(`${label} clone a environments missing a "stack" trace`, () => {
            expect.assertions(9);

            const createError = (message: string) => {
                const error = new Error(message);

                error.stack = "";

                return error;
            };

            // Blank `stack` property...
            const error1 = new Error("beep");

            error1.stack = "";
            error1.constructor = createError;

            const error2 = clone(error1);

            expect(error2.stack, "no stack trace").toBe("");
        });

        it(`${label} clone a "code" property (Node.js)`, () => {
            expect.assertions(1);

            const error1 = new Error("beep") as any;

            error1.code = 43;

            const error2 = clone(error1);

            expect(error2.code, "equal codes").toStrictEqual(error1.code);
        });

        it(`${label} clone a "errno" property (Node.js)`, () => {
            expect.assertions(1);

            const error1 = new Error("beep") as any;

            error1.errno = "EACCES";

            const error2 = clone(error1);

            expect(error2.errno, "equal errno").toStrictEqual(error1.errno);
        });

        it(`${label} clone a "syscall" property (Node.js)`, () => {
            expect.assertions(1);

            const error1 = new Error("beep") as any;

            error1.syscall = "boop";

            const error2 = clone(error1);

            expect(error2.syscall, "equal syscall").toStrictEqual(error1.syscall);
        });

        it(`${label} clone a additional (enumerable) properties`, () => {
            expect.assertions(6);

            // Data descriptor...
            const error1 = new Error("errrr") as any;

            error1.beep = "boop";
            error1.boop = "beep";

            const error2 = clone(error1);

            expect(error2.beep, "data descriptor").toStrictEqual(error1.beep);
            expect(error2.boop, "data descriptor").toStrictEqual(error1.boop);

            // Accessor descriptor...
            const error3 = new Error("errrr");

            Object.defineProperty(error1, "beep", {
                configurable: true,
                enumerable: true,
                get: function get() {
                    return "boop";
                },
            });

            Object.defineProperty(error3, "boop", {
                configurable: false,
                enumerable: true,
                get: function get() {
                    return "beep";
                },
            });

            const error4 = clone(error3) as any;

            expect((error3 as any).beep, "accessor descriptor").toStrictEqual(error4.beep);
            expect((error3 as any).boop, "accessor descriptor").toStrictEqual(error4.boop);

            // Deep equal...
            const error5 = new Error("errrr") as any;

            error5.arr = [1, 2, [3, 4, 5]];

            const error6 = clone(error5);

            expect(error6.arr, "new instances").not.toBe(error5.arr);
            expect(error6.arr, "deep equal").toStrictEqual(error5.arr);
        });

        it(`${label} clone a custom errors (proto)`, () => {
            expect.assertions(8);

            // @ts-expect-error - TS doesn't like this
            const error1 = new CustomerrorProto("custom error");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of CustomError").instanceof(CustomerrorProto);
            expect(error2, "instance of Error").instanceof(Error);

            assertErrorValues(error2, error1);
        });

        it("should clone a custom errors (subclass; ES2015)", () => {
            expect.assertions(8);

            const CustomError2 = customerrorSubclass();

            const error1 = new CustomError2("custom error");
            const error2 = clone(error1);

            assertObject(error2, error1);

            expect(error2, "instance of CustomError").instanceof(CustomError2);
            expect(error2, "instance of Error").instanceof(Error);

            assertErrorValues(error2, error1);
        });
    });

    it(`clone a RegExp`, async () => {
        expect.assertions(12);

        const yeeInput = /foobar/;

        assertRegExp(deepClone<RegExp>(yeeInput) as RegExp, yeeInput);
    });

    it(`clone strict a RegExp with extra functions`, async () => {
        expect.assertions(17);

        const key = "i don't know man i'm running out of random strings";

        const yeeInput = /foobar/;

        (yeeInput as any).haw = { [key]: 7 };
        (yeeInput as any).yeehaw = true;

        const yeeCopy = deepClone<RegExp>(yeeInput, { strict: true });

        expect((yeeCopy as any).haw[key]).toBe((yeeInput as any).haw[key]);

        assertObject((yeeCopy as any).haw, (yeeInput as any).haw);

        expect((yeeCopy as any).yeehaw).toBe(true);

        assertRegExp(yeeCopy as RegExp, yeeInput);
    });
});
