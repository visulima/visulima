import { format as utilityFormat } from "node:util";

import quickFormat from "quick-format-unescaped";
// eslint-disable-next-line import/no-extraneous-dependencies
import { bench, describe } from "vitest";

import { format as fmt } from "../src";

describe("format simple", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("util.format", () => {
        utilityFormat("%s %j %d", "a", { a: { x: 1 } }, 1);
    });

    bench("@visulima/fmt", () => {
        fmt("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
    });

    bench.skipIf(process.env.CODSPEED_ENV)("quick-format-unescaped", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        quickFormat("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
    });
});

describe("format tail object", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("util.format", () => {
        utilityFormat("hello %s %j %d", "world", { obj: true }, 4, { another: "obj" });
    });

    bench("@visulima/fmt", () => {
        fmt("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
    });

    bench.skipIf(process.env.CODSPEED_ENV)("quick-format-unescaped", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        quickFormat("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
    });
});
