import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileAccessTracker } from "../../src/file-access-tracker";

// The default exclude patterns (`/dev/`, `/tmp/`, `/etc/`, ...) describe system locations. They
// must apply to a path's location *inside* the workspace, never to the workspace's own address:
// a project in `~/dev/app` or `/tmp/ci/checkout` would otherwise record no accesses at all.
describe("fileAccessTracker.resolveAccessPath", () => {
    let base: string;

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        base = join(tmpdir(), `tracker-paths-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await mkdir(base, { recursive: true });
    });

    afterEach(async () => {
        await rm(base, { force: true, recursive: true });
    });

    const workspaceUnder = async (...segments: string[]): Promise<string> => {
        const root = join(base, ...segments, "ws");

        await mkdir(root, { recursive: true });

        return root;
    };

    it.each(["dev", "tmp", "etc", "proc", "sys"])("tracks a workspace that lives under a '%s' directory", async (segment) => {
        expect.assertions(1);

        const root = await workspaceUnder(segment);
        const tracker = new FileAccessTracker(root);

        expect(tracker.resolveAccessPath(join(root, "src", "index.ts"))).toBe(join(root, "src", "index.ts"));
    });

    it("still excludes system-looking and generated paths inside the workspace", async () => {
        expect.assertions(3);

        const root = await workspaceUnder("project");
        const tracker = new FileAccessTracker(root);

        expect(tracker.resolveAccessPath(join(root, "tmp", "scratch.txt"))).toBeUndefined();
        expect(tracker.resolveAccessPath(join(root, "node_modules", "pkg", "native.so"))).toBeUndefined();
        expect(tracker.resolveAccessPath(join(root, "node_modules", ".package-lock.json"))).toBeUndefined();
    });

    it("ignores paths outside the workspace, including siblings that share its prefix", async () => {
        expect.assertions(3);

        const root = await workspaceUnder("project");
        const tracker = new FileAccessTracker(root);

        expect(tracker.resolveAccessPath(join(base, "project", "elsewhere", "a.ts"))).toBeUndefined();
        // `<root>-cache` starts with `<root>`; a bare startsWith check would call it inside.
        expect(tracker.resolveAccessPath(`${root}-cache/a.ts`)).toBeUndefined();
        expect(tracker.resolveAccessPath("/etc/hosts")).toBeUndefined();
    });

    it("honours custom exclude patterns against the in-workspace path only", async () => {
        expect.assertions(2);

        const root = await workspaceUnder("generated");
        const tracker = new FileAccessTracker(root, [/\/generated\//]);

        // The workspace itself sits under a `generated` directory, which must not matter.
        expect(tracker.resolveAccessPath(join(root, "src", "a.ts"))).toBe(join(root, "src", "a.ts"));
        expect(tracker.resolveAccessPath(join(root, "generated", "a.ts"))).toBeUndefined();
    });
});
