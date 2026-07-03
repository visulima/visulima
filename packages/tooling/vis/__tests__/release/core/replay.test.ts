import { describe, expect, it } from "vitest";

import { parseChangeFile } from "../../../src/release/core/change-file";
import { conditionSatisfiedBy, evaluateReplayFiles, isReplayFile, parseReplayCondition } from "../../../src/release/core/replay";
import { VisReleaseError } from "../../../src/release/errors";
import type { ChangeFile, PlannedRelease } from "../../../src/release/types";

const mkRelease = (name: string, oldVersion: string, newVersion: string): PlannedRelease => {
    return {
        changeFiles: [],
        isCascadeBump: false,
        isDependencyBump: false,
        isGroupBump: false,
        name,
        newVersion,
        oldVersion,
        reasons: ["EXPLICIT"],
        sources: [],
        type: "patch",
    };
};

describe("replay: parseReplayCondition", () => {
    it("parses a version condition", () => {
        expect.hasAssertions();

        expect(parseReplayCondition("@scope/a@1.2.0", "f.md")).toStrictEqual({ kind: "version", package: "@scope/a", version: "1.2.0" });
    });

    it("parses a prerelease version condition", () => {
        expect.hasAssertions();

        expect(parseReplayCondition("pkg@2.0.0-rc.1", "f.md")).toStrictEqual({ kind: "version", package: "pkg", version: "2.0.0-rc.1" });
    });

    it("parses exit-prerelease (hyphen and space forms)", () => {
        expect.hasAssertions();

        expect(parseReplayCondition("exit-prerelease:@scope/a", "f.md")).toStrictEqual({ kind: "exit-prerelease", package: "@scope/a" });
        expect(parseReplayCondition("exit prerelease: pkg", "f.md")).toStrictEqual({ kind: "exit-prerelease", package: "pkg" });
    });

    it("throws on an unrecognised condition", () => {
        expect.hasAssertions();

        expect(() => parseReplayCondition("nonsense", "f.md")).toThrow(VisReleaseError);
        expect(() => parseReplayCondition(42, "f.md")).toThrow(VisReleaseError);
    });

    it("rejects empty or malformed replay target package names", () => {
        expect.hasAssertions();

        expect(() => parseReplayCondition("exit-prerelease:   ", "f.md")).toThrow(VisReleaseError);
        expect(() => parseReplayCondition("bad name@1.2.3", "f.md")).toThrow(VisReleaseError);
    });
});

describe("replay: change-file parsing", () => {
    it("parses a replay file with no explicit bump (defaults to none)", () => {
        expect.hasAssertions();

        const file = parseChangeFile(`---\n"@scope/a":\n  replay:\n    - "@scope/a@1.1.0"\n    - "exit-prerelease:@scope/a"\n---\nReplayed note.\n`, "r.md");

        if (!("package" in file.payload)) {
            throw new Error("expected nested shape");
        }

        expect(file.payload.bump).toBe("none");
        expect(file.payload.replay).toStrictEqual([
            { kind: "version", package: "@scope/a", version: "1.1.0" },
            { kind: "exit-prerelease", package: "@scope/a" },
        ]);
        expect(isReplayFile(file)).toBe(true);
    });

    it("does not flag a normal nested file as a replay file", () => {
        expect.hasAssertions();

        const file = parseChangeFile(`---\n"@scope/a":\n  bump: minor\n---\nBody.\n`, "n.md");

        expect(isReplayFile(file)).toBe(false);
    });

    it("rejects a file that sets both bump and replay", () => {
        expect.hasAssertions();

        expect(() => parseChangeFile(`---\n"@scope/a":\n  bump: major\n  replay:\n    - "@scope/a@1.1.0"\n---\nBody.\n`, "bad.md")).toThrow(VisReleaseError);
    });
});

describe("replay: conditionSatisfiedBy", () => {
    it("matches an exact version milestone", () => {
        expect.hasAssertions();

        expect(conditionSatisfiedBy({ kind: "version", package: "a", version: "1.1.0" }, mkRelease("a", "1.0.0", "1.1.0"))).toBe(true);
        expect(conditionSatisfiedBy({ kind: "version", package: "a", version: "1.1.0" }, mkRelease("a", "1.0.0", "1.2.0"))).toBe(false);
        expect(conditionSatisfiedBy({ kind: "version", package: "a", version: "1.1.0" }, mkRelease("b", "1.0.0", "1.1.0"))).toBe(false);
    });

    it("matches exiting a prerelease line", () => {
        expect.hasAssertions();

        expect(conditionSatisfiedBy({ kind: "exit-prerelease", package: "a" }, mkRelease("a", "1.0.0-rc.3", "1.0.0"))).toBe(true);
        // Still in prerelease → not satisfied.
        expect(conditionSatisfiedBy({ kind: "exit-prerelease", package: "a" }, mkRelease("a", "1.0.0-rc.3", "1.0.0-rc.4"))).toBe(false);
        // Was already stable → not an exit.
        expect(conditionSatisfiedBy({ kind: "exit-prerelease", package: "a" }, mkRelease("a", "1.0.0", "1.1.0"))).toBe(false);
    });
});

describe("replay: evaluateReplayFiles", () => {
    const replayFile = (id: string, conditions: string): ChangeFile =>
        parseChangeFile(`---\n"@scope/a":\n  replay:\n${conditions}\n---\nReplay body ${id}.\n`, `${id}.md`);

    it("injects the body and consumes the file when all conditions fire", () => {
        expect.hasAssertions();

        const file = replayFile("a", `    - "@scope/a@1.1.0"`);
        const evaluation = evaluateReplayFiles([file], [mkRelease("@scope/a", "1.0.0", "1.1.0")]);

        expect(evaluation.injectionsByPackage.get("@scope/a")).toStrictEqual([file]);
        expect(evaluation.consumed).toStrictEqual([file]);
        expect(evaluation.retained).toStrictEqual([]);
    });

    it("injects the body only once when two conditions match the same release", () => {
        expect.hasAssertions();

        // `@scope/a@1.0.0` + `exit-prerelease:@scope/a` both fire when an rc
        // graduates to 1.0.0 in the same run — the note must appear once.
        const file = replayFile("dup", `    - "@scope/a@1.0.0"\n    - "exit-prerelease:@scope/a"`);
        const evaluation = evaluateReplayFiles([file], [mkRelease("@scope/a", "1.0.0-rc.3", "1.0.0")]);

        expect(evaluation.injectionsByPackage.get("@scope/a")).toStrictEqual([file]);
        expect(evaluation.consumed).toStrictEqual([file]);
    });

    it("retains the file while any condition is still pending", () => {
        expect.hasAssertions();

        const file = replayFile("b", `    - "@scope/a@1.1.0"\n    - "@scope/a@2.0.0"`);
        const evaluation = evaluateReplayFiles([file], [mkRelease("@scope/a", "1.0.0", "1.1.0")]);

        // One condition fired (injects once), the other pending → retained.
        expect(evaluation.injectionsByPackage.get("@scope/a")).toStrictEqual([file]);
        expect(evaluation.consumed).toStrictEqual([]);
        expect(evaluation.retained).toStrictEqual([file]);
    });

    it("retains and does not inject when no condition fires", () => {
        expect.hasAssertions();

        const file = replayFile("c", `    - "@scope/a@9.9.9"`);
        const evaluation = evaluateReplayFiles([file], [mkRelease("@scope/a", "1.0.0", "1.1.0")]);

        expect(evaluation.injectionsByPackage.size).toBe(0);
        expect(evaluation.retained).toStrictEqual([file]);
    });
});
