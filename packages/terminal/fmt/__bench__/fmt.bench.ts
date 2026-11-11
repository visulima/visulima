import { format as utilityFormat } from "node:util";

import quickFormat from "quick-format-unescaped";
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test } from "vitest";

import { format as fmt } from "../src";

describe("format simple", () => {
    test.skipIf(process.env.CODSPEED_ENV)("util.format", async ({ bench }) => {
        await bench("util.format", () => {
            utilityFormat("%s %j %d", "a", { a: { x: 1 } }, 1);
        }).run();
    });

    test("@visulima/fmt", async ({ bench }) => {
        await bench("@visulima/fmt", () => {
            fmt("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("quick-format-unescaped", async ({ bench }) => {
        await bench("quick-format-unescaped", () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            quickFormat("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
        }).run();
    });
});

describe("format tail object", () => {
    test.skipIf(process.env.CODSPEED_ENV)("util.format", async ({ bench }) => {
        await bench("util.format", () => {
            utilityFormat("hello %s %j %d", "world", { obj: true }, 4, { another: "obj" });
        }).run();
    });

    test("@visulima/fmt", async ({ bench }) => {
        await bench("@visulima/fmt", () => {
            fmt("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("quick-format-unescaped", async ({ bench }) => {
        await bench("quick-format-unescaped", () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            quickFormat("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
        }).run();
    });
});
