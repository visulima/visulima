import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getAffectedProjects } from "../../src/affected";

const emptyGraph = { dependencies: {}, nodes: {} };

describe("affected detection — spawn failures", () => {
    it("names the missing workspace root rather than blaming git", async () => {
        expect.assertions(2);

        // Spawning into a directory that does not exist reports ENOENT with
        // `path: "git"` and `syscall: "spawn git"` — byte for byte what a
        // missing binary reports. Classifying on those fields alone told
        // people to `apk add git` while git was sitting right there.
        const missingRoot = join(tmpdir(), `vis-missing-root-${String(process.pid)}`);

        const error = await getAffectedProjects({
            base: "main",
            head: "HEAD",
            projectGraph: emptyGraph,
            projects: {},
            workspaceRoot: missingRoot,
        }).catch((error_: unknown) => error_);

        expect((error as Error).message).toContain(missingRoot);
        expect((error as Error).message).not.toContain("apk add git");
    });

    it("leaves a real repository alone", async () => {
        expect.assertions(1);

        const scratch = mkdtempSync(join(tmpdir(), "vis-affected-"));

        try {
            // Not a git repo, so this fails — but on git's own terms (a
            // non-zero exit), not with the missing-binary hint.
            const error = await getAffectedProjects({
                base: "main",
                head: "HEAD",
                projectGraph: emptyGraph,
                projects: {},
                workspaceRoot: scratch,
            }).catch((error_: unknown) => error_);

            expect((error as Error | undefined)?.message ?? "").not.toContain("does not exist");
        } finally {
            rmSync(scratch, { force: true, recursive: true });
        }
    });
});
