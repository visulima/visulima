import { format as utilFormat } from "node:util";

import { bench, describe } from "vitest";
import * as quickFormat from "quick-format-unescaped";

import { format as fmt } from "../src/index";

describe("format simple", () => {
    bench("util.format", () => {
        utilFormat("%s %j %d", "a", { a: { x: 1 } }, 1);
    });

    bench("@visulima/fmt", () => {
        fmt("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
    });

    bench("quick-format-unescaped", () => {
        quickFormat.default("%s %j %d", ["a", [{ a: { x: 1 } }, 1]]);
    });
});

describe("format tail object", () => {
    bench("util.format", () => {
        utilFormat("hello %s %j %d", "world", { obj: true }, 4, { another: "obj" });
    });

    bench("@visulima/fmt", () => {
        fmt("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
    });

    bench("quick-format-unescaped", () => {
        quickFormat.default("hello %s %j %d", ["world", [{ obj: true }, 4, { another: "obj" }]]);
    });
});
