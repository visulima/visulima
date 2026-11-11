import { inspect as nodeInspect } from "node:util";

import { inspect } from "@visulima/inspector";
import { inspect as loupeInspect } from "loupe";
import objectInspect from "object-inspect";
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test } from "vitest";

const mapObjectReferenceA = {};
const mapObjectReferenceB = {};

// eslint-disable-next-line func-style
function getArguments(...args: unknown[]) {
    args;

    return arguments; // eslint-disable-line prefer-rest-params
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class A {}

const casses = [
    ["arguments", getArguments(1, 2, 3)],
    ["array literal", [1, 2, 3]],
    ["boolean literal", true],
    ["buffer", Buffer.from("hello world")],
    ["class", new A()],
    ["date", new Date(123)],
    ["map", new Map().set("a", 1)],
    ["map (complex)", new Map().set(mapObjectReferenceA, new Map().set(mapObjectReferenceB, 1))],

    ["null", null],
    ["number literal", 1],
    ["object from null", Object.create(null)],
    ["object literal", { a: 1 }],
    // eslint-disable-next-line prefer-regex-literals
    ["regex constructor", new RegExp("abc")],
    ["regex literal", /^abc$/],
    ["set", new Set().add(1)],
    // eslint-disable-next-line no-new-wrappers,unicorn/new-for-builtins,sonarjs/no-primitive-wrappers
    ["string constructor ", new String()],
    ["string literal", "abc"],
    ["undefined", undefined],
];

describe.each(casses)("inspect %s", (_, caseValue) => {
    test("@visulima/inspector", async ({ bench }) => {
        await bench("@visulima/inspector", () => {
            inspect(caseValue);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("loupe", async ({ bench }) => {
        await bench("loupe", () => {
            loupeInspect(caseValue);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("objectInspect", async ({ bench }) => {
        await bench("objectInspect", () => {
            objectInspect(caseValue);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("node util.inspect", async ({ bench }) => {
        await bench("node util.inspect", () => {
            nodeInspect(caseValue);
        }).run();
    });
});
