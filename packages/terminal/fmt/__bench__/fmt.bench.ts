import { format as utilityFormat } from "node:util";

// eslint-disable-next-line import/no-extraneous-dependencies
import quickFormat from "quick-format-unescaped";
// eslint-disable-next-line import/no-extraneous-dependencies
import { bench, describe } from "vitest";

import { format as fmt } from "../src";

describe("format simple", () => {
    bench("util.format", () => {
        utilityFormat("%s %j %d", "a", { a: { x: 1 } }, 1);
    });

    bench("@visulima/fmt", () => {
        fmt("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
    });

    bench("quick-format-unescaped", () => {
        quickFormat("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
    });
});

describe("format tail object", () => {
    bench("util.format", () => {
        utilityFormat("hello %s %j %d", "world", { obj: true }, 4, { another: "obj" });
    });

    bench("@visulima/fmt", () => {
        fmt("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
    });

    bench("quick-format-unescaped", () => {
        quickFormat("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
    });
});
