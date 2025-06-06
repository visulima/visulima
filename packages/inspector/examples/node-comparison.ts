/* eslint-disable no-console */
import { inspect as utilityInspect } from "node:util";

import { inspect } from "@visulima/inspector";

const valuesToInspect = [
    // Primitives
    "a string",
    12_345,
    12_345n,
    true,
    false,
    // eslint-disable-next-line unicorn/no-null
    null,
    undefined,
    Symbol("foo"),

    // Objects
    { a: 1, b: 2 },
    { a: 1, b: { c: { d: 4 } } },
    (() => {
        const o = { a: 1 };

        // @ts-expect-error - we are testing circular references
        o.b = o;

        return o;
    })(),
    Object.create(null, {
        a: {
            enumerable: true,
            value: 1,
        },
        b: {
            enumerable: true,
            get() {
                return 2;
            },
        },
    }),

    // Arrays
    [1, 2, 3],
    [1, "2", Symbol("3")],
    // eslint-disable-next-line no-sparse-arrays
    [1, , 3],
    (() => {
        const a = [1];

        // @ts-expect-error - we are testing circular references
        a.push(a);

        return a;
    })(),

    // Map
    new Map([
        ["a", 1],
        ["b", 2],
    ]),

    // Set
    // eslint-disable-next-line perfectionist/sort-sets
    new Set([1, 2, 1, 3, 2]),

    // Date
    new Date(),

    // RegExp
    /abc/gi,

    // Error
    new Error("This is an error"),

    // Promise
    Promise.resolve(1),

    // Proxy
    new Proxy({ a: 1 }, {}),

    // TypedArrays
    new Int8Array([1, 2, 3]),
    new Uint8Array([1, 2, 3]),
    new Int16Array([1, 2, 3]),
    new Uint16Array([1, 2, 3]),
    new Int32Array([1, 2, 3]),
    new Uint32Array([1, 2, 3]),
    new Float32Array([1, 2, 3]),
    new Float64Array([1, 2, 3]),
    new BigInt64Array([1n, 2n, 3n]),
    new BigUint64Array([1n, 2n, 3n]),

    // DataView
    new DataView(new ArrayBuffer(16)),

    // WeakMap
    new WeakMap([
        [{}, 1],
        [{}, 2],
    ]),

    // WeakSet
    new WeakSet([{}, {}]),

    // Arguments
    // eslint-disable-next-line func-names
    (function () {
        // eslint-disable-next-line prefer-rest-params
        return arguments;
    // @ts-expect-error - we are testing arguments
    })(1, 2, 3),

    // Boxed Primitives
    // eslint-disable-next-line no-new-object
    new Object("a string"),
    // eslint-disable-next-line no-new-object
    new Object(12_345),
    // eslint-disable-next-line no-new-object
    new Object(12_345n),
    // eslint-disable-next-line no-new-object
    new Object(true),
    // eslint-disable-next-line no-new-object
    new Object(Symbol("foo")),

    // Async Function
    async () => {},

    // Generator Function
    // eslint-disable-next-line func-names
    (function* () {
        yield 1;
    })(),
];

if (typeof Buffer !== "undefined") {
    valuesToInspect.push(Buffer.from("hello world"));
}

if (typeof SharedArrayBuffer !== "undefined") {
    valuesToInspect.push(new SharedArrayBuffer(16));
}

if (typeof Uint8ClampedArray !== "undefined") {
    valuesToInspect.push(new Uint8ClampedArray([1, 2, 3]));
}

console.log("Comparing @visulima/inspector with node:util.inspect");
console.log("=".repeat(80), "\n");

for (const value of valuesToInspect) {
    console.log(`Inspecting value:`, value);
    console.log("-".repeat(80));

    console.log("node:util.inspect:");
    console.log(utilityInspect(value, {
        breakLength: 80,
        colors: true,
        compact: true,
        customInspect: true,
        // eslint-disable-next-line unicorn/no-null
        depth: null,
        getters: false,
        // eslint-disable-next-line unicorn/no-null
        maxArrayLength: null,
        // eslint-disable-next-line unicorn/no-null
        maxStringLength: null,
        showHidden: true,
        showProxy: true,
        sorted: false,
    }));

    console.log("-".repeat(80));

    console.log("@visulima/inspector:");
    console.log(inspect(value, {
        breakLength: 80,
        compact: true,
        customInspect: true,
        depth: undefined,
        getters: false,
        maxArrayLength: undefined,
        maxStringLength: undefined,
        showHidden: true,
        showProxy: true,
        sorted: false,
    }));
    console.log("=".repeat(80), "\n");
}
