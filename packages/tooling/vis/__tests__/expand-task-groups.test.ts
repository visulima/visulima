import { describe, expect, it } from "vitest";

import { expandTaskGroups } from "../src/workspace";

describe(expandTaskGroups, () => {
    it("returns [] for undefined input", () => {
        expect.assertions(1);
        expect(expandTaskGroups(undefined, {})).toStrictEqual([]);
    });

    it("passes bare dependency entries through unchanged", () => {
        expect.assertions(1);
        expect(expandTaskGroups(["build", "^types"], {})).toStrictEqual(["build", "^types"]);
    });

    it("expands a single-level group reference", () => {
        expect.assertions(1);

        const result = expandTaskGroups([{ group: "lint" }], {
            lint: ["eslint", "prettier", "types"],
        });

        expect(result).toStrictEqual(["eslint", "prettier", "types"]);
    });

    it("recursively expands nested groups", () => {
        expect.assertions(1);

        const result = expandTaskGroups([{ group: "pre-build" }], {
            lint: ["eslint", "prettier"],
            "pre-build": [{ group: "lint" }, "codegen"],
        });

        expect(result).toStrictEqual(["eslint", "prettier", "codegen"]);
    });

    it("preserves config-form entries alongside group references", () => {
        expect.assertions(1);

        const result = expandTaskGroups([{ group: "lint" }, { dependencies: true, target: "build" }], {
            lint: ["eslint"],
        });

        expect(result).toStrictEqual(["eslint", { dependencies: true, target: "build" }]);
    });

    it("throws a clear error for an unknown group", () => {
        expect.assertions(1);
        expect(() => expandTaskGroups([{ group: "missing" }], {})).toThrow(/Unknown taskGroup "missing"/);
    });

    it("detects direct group cycles", () => {
        expect.assertions(1);
        expect(() => expandTaskGroups([{ group: "a" }], { a: [{ group: "a" }] })).toThrow(/Cycle detected.*a.+a/);
    });

    it("detects indirect group cycles", () => {
        expect.assertions(1);
        expect(() =>
            expandTaskGroups([{ group: "a" }], {
                a: [{ group: "b" }],
                b: [{ group: "a" }],
            }),
        ).toThrow(/Cycle detected.*a.+b.+a/);
    });
});
