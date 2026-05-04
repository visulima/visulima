import { describe, expect, it } from "vitest";

import { INHERIT_SENTINEL, mergeArrayWithInherit, mergeTargetWithInherit } from "../../src/task/target-merge";

describe(mergeArrayWithInherit, () => {
    it("returns parent (cloned) when child is undefined", () => {
        expect.assertions(2);

        const parent = ["a", "b"];
        const result = mergeArrayWithInherit(parent, undefined);

        expect(result).toStrictEqual(["a", "b"]);
        expect(result).not.toBe(parent);
    });

    it("replaces parent wholesale when child has no @inherit", () => {
        expect.assertions(1);

        expect(mergeArrayWithInherit(["a", "b"], ["c"])).toStrictEqual(["c"]);
    });

    it("returns empty array when child is empty (full reset)", () => {
        expect.assertions(1);

        expect(mergeArrayWithInherit(["a", "b"], [])).toStrictEqual([]);
    });

    it("splices parent inline at the @inherit slot", () => {
        expect.assertions(1);

        expect(mergeArrayWithInherit(["a", "b"], [INHERIT_SENTINEL, "c"])).toStrictEqual(["a", "b", "c"]);
    });

    it("preserves child entries surrounding @inherit", () => {
        expect.assertions(1);

        expect(mergeArrayWithInherit(["mid"], ["pre", INHERIT_SENTINEL, "post"])).toStrictEqual(["pre", "mid", "post"]);
    });

    it("expands every occurrence of @inherit independently", () => {
        expect.assertions(1);

        expect(mergeArrayWithInherit(["x"], [INHERIT_SENTINEL, "y", INHERIT_SENTINEL])).toStrictEqual(["x", "y", "x"]);
    });

    it("treats a missing parent as empty when child uses @inherit", () => {
        expect.assertions(1);

        expect(mergeArrayWithInherit(undefined, [INHERIT_SENTINEL, "x"])).toStrictEqual(["x"]);
    });

    it("does not mutate either input array", () => {
        expect.assertions(2);

        const parent = ["a"];
        const child = [INHERIT_SENTINEL, "b"];

        mergeArrayWithInherit(parent, child);

        expect(parent).toStrictEqual(["a"]);
        expect(child).toStrictEqual([INHERIT_SENTINEL, "b"]);
    });
});

describe(mergeTargetWithInherit, () => {
    it("merges scalar fields with later wins", () => {
        expect.assertions(2);

        const merged = mergeTargetWithInherit({ command: "old" }, { command: "new" });

        expect(merged.command).toBe("new");
        expect(Object.keys(merged)).toContain("command");
    });

    it("applies @inherit to dependsOn", () => {
        expect.assertions(1);

        const merged = mergeTargetWithInherit({ dependsOn: ["build"] }, { dependsOn: [INHERIT_SENTINEL, "lint"] });

        expect(merged.dependsOn).toStrictEqual(["build", "lint"]);
    });

    it("replaces dependsOn when child omits @inherit", () => {
        expect.assertions(1);

        const merged = mergeTargetWithInherit({ dependsOn: ["build"] }, { dependsOn: ["custom"] });

        expect(merged.dependsOn).toStrictEqual(["custom"]);
    });

    it("applies @inherit to inputs", () => {
        expect.assertions(1);

        const merged = mergeTargetWithInherit({ inputs: ["src/**"] }, { inputs: [INHERIT_SENTINEL, "proto/**"] });

        expect(merged.inputs).toStrictEqual(["src/**", "proto/**"]);
    });

    it("applies @inherit to outputs", () => {
        expect.assertions(1);

        const merged = mergeTargetWithInherit({ outputs: ["dist/**"] }, { outputs: [INHERIT_SENTINEL, "build/**"] });

        expect(merged.outputs).toStrictEqual(["dist/**", "build/**"]);
    });

    it("applies @inherit to aliases", () => {
        expect.assertions(1);

        const merged = mergeTargetWithInherit({ aliases: ["t"] }, { aliases: [INHERIT_SENTINEL, "spec"] });

        expect(merged.aliases).toStrictEqual(["t", "spec"]);
    });

    it("returns parent's array (cloned) when child omits the field", () => {
        expect.assertions(2);

        const merged = mergeTargetWithInherit({ inputs: ["a"] }, { command: "x" });

        expect(merged.inputs).toStrictEqual(["a"]);
        expect(merged.command).toBe("x");
    });

    it("does not synthesize array fields the parent never had", () => {
        expect.assertions(1);

        const merged = mergeTargetWithInherit({ command: "a" }, { command: "b" });

        expect(merged.dependsOn).toBeUndefined();
    });

    it("supports an empty array as a deliberate reset", () => {
        expect.assertions(1);

        const merged = mergeTargetWithInherit({ dependsOn: ["build"] }, { dependsOn: [] });

        expect(merged.dependsOn).toStrictEqual([]);
    });
});
