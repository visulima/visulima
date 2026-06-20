import { describe, expect, it, vi } from "vitest";

// Simulate Windows 8.3 short-name canonicalization: only `realpathSync.native`
// expands `RUNNER~1` → `runneradmin`; the plain `realpathSync` (and a bare
// resolve) leave the short form untouched. This reproduces the PR #687
// windows-latest failure where a short-form cwd never matched a long-form
// manifest path. discoverPackages must canonicalize cwd through `.native` so
// the containment check compares like with like.
vi.mock(import("node:fs"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:fs")>();
    // Expand the 8.3 token wherever it appears so the mock is separator- and
    // drive-agnostic (on Windows `resolve` turns the POSIX literals below into
    // `C:\Users\RUNNER~1\...`). Only `.native` expands; plain realpathSync does not.
    const expand = (p: string): string => p.replace("RUNNER~1", "runneradmin");
    const realpathSync = Object.assign((p: string): string => p, { native: expand });

    return { ...actual, realpathSync };
});

const { discoverPackages } = await import("../../../src/release/core/workspace");
const { VisReleaseError } = await import("../../../src/release/errors");

type PackageManifest = import("../../../src/release/types").PackageManifest;

describe("workspace: discoverPackages containment with 8.3 short-name cwd", () => {
    it("accepts a long-form manifest under a short-form (8.3) workspace cwd", async () => {
        expect.assertions(1);

        const reader = {
            listPackages: async () => [{
                manifest: { name: "a", version: "1.0.0" } as PackageManifest,
                manifestPath: "/Users/runneradmin/Temp/ws/packages/a/package.json",
            }],
        };

        const result = await discoverPackages(reader, { defaultManaged: true }, { cwd: "/Users/RUNNER~1/Temp/ws" });

        expect(result.packages).toHaveLength(1);
    });

    it("still rejects a manifest genuinely outside the canonicalized workspace", async () => {
        expect.assertions(1);

        const reader = {
            listPackages: async () => [{
                manifest: { name: "evil", version: "1.0.0" } as PackageManifest,
                manifestPath: "/Users/runneradmin/Temp/elsewhere/package.json",
            }],
        };

        await expect(discoverPackages(reader, { defaultManaged: true }, { cwd: "/Users/RUNNER~1/Temp/ws" })).rejects.toThrow(VisReleaseError);
    });
});
