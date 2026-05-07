import { homedir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getVisCacheDir, getVisHomeDir, getVisStateDir, getVisWorkspaceDir, hashWorkspace } from "../../src/util/vis-paths";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

describe("util/vis-paths", () => {
    let homeOverride: string;
    let originalHome: string | undefined;

    beforeEach(() => {
        homeOverride = createTemporaryDirectory("vis-paths-home-");
        originalHome = process.env["HOME"];
        process.env["HOME"] = homeOverride;
    });

    afterEach(() => {
        if (originalHome === undefined) {
            delete process.env["HOME"];
        } else {
            process.env["HOME"] = originalHome;
        }

        cleanupTemporaryDirectory(homeOverride);
    });

    describe(getVisHomeDir, () => {
        it("returns ~/.vis under the active homedir", () => {
            expect.assertions(1);
            expect(getVisHomeDir()).toBe(join(homedir(), ".vis"));
        });
    });

    describe(getVisCacheDir, () => {
        it("returns ~/.vis/cache", () => {
            expect.assertions(1);
            expect(getVisCacheDir()).toBe(join(homedir(), ".vis", "cache"));
        });
    });

    describe(getVisStateDir, () => {
        it("returns ~/.vis/state", () => {
            expect.assertions(1);
            expect(getVisStateDir()).toBe(join(homedir(), ".vis", "state"));
        });
    });

    describe(hashWorkspace, () => {
        it("returns a 12-char hex hash", () => {
            expect.assertions(1);
            expect(hashWorkspace("/tmp/repo")).toMatch(/^[a-f0-9]{12}$/);
        });

        it("is deterministic for the same input", () => {
            expect.assertions(1);
            expect(hashWorkspace("/tmp/repo")).toBe(hashWorkspace("/tmp/repo"));
        });

        it("differs for different inputs (worktree isolation)", () => {
            expect.assertions(1);
            // Two checkouts of the same repo at different paths must
            // produce different hashes — that's the whole point of
            // path-keying.
            expect(hashWorkspace("/tmp/repo")).not.toBe(hashWorkspace("/tmp/repo-worktree"));
        });
    });

    describe(getVisWorkspaceDir, () => {
        it("composes ~/.vis/workspaces/<hash>", () => {
            expect.assertions(1);

            const hash = hashWorkspace("/tmp/repo");

            expect(getVisWorkspaceDir("/tmp/repo")).toBe(join(homedir(), ".vis", "workspaces", hash));
        });
    });
});
