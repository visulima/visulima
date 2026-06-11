import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearListCache, listVisJson } from "../src/list-cache";

const FAKE_VIS = fileURLToPath(new URL("__fixtures__/fake-vis.mjs", import.meta.url));

let workspaceRoot: string;

beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), "vis-mcp-cache-"));
    clearListCache();
});

afterEach(() => {
    clearListCache();
    rmSync(workspaceRoot, { force: true, recursive: true });
});

describe(listVisJson, () => {
    it("should return the same parsed payload to back-to-back callers within the TTL", async () => {
        expect.assertions(2);

        const [first, second] = await Promise.all([
            listVisJson<unknown[]>(FAKE_VIS, workspaceRoot, ["list", "--json"]),
            listVisJson<unknown[]>(FAKE_VIS, workspaceRoot, ["list", "--json"]),
        ]);

        // Both resolve to the *same array instance* because the second caller is
        // served the memoized in-flight promise rather than a fresh subprocess.
        expect(first).toBe(second);
        expect(first).toHaveLength(2);
    });

    it("should re-fetch (distinct payload instance) once the TTL elapses", async () => {
        expect.assertions(1);

        const first = await listVisJson<unknown[]>(FAKE_VIS, workspaceRoot, ["list", "--json"], 0);
        const second = await listVisJson<unknown[]>(FAKE_VIS, workspaceRoot, ["list", "--json"], 0);

        // A zero TTL forces a fresh subprocess, so the parsed arrays are
        // different instances even though their contents match.
        expect(first).not.toBe(second);
    });

    it("should key on args so `list --json` and `list --targets --json` don't collide", async () => {
        expect.assertions(2);

        const projects = await listVisJson<unknown[]>(FAKE_VIS, workspaceRoot, ["list", "--json"]);
        const targets = await listVisJson<unknown[]>(FAKE_VIS, workspaceRoot, ["list", "--targets", "--json"]);

        expect(projects).toHaveLength(2);
        // The --targets fixture returns three projects (one without targets).
        expect(targets).toHaveLength(3);
    });

    it("should not cache a rejected lookup", async () => {
        expect.assertions(2);

        await expect(listVisJson<unknown[]>("/definitely-not-a-real-binary", workspaceRoot, ["list", "--json"])).rejects.toThrow();

        // A subsequent call against a working binary must not see the poisoned
        // entry — it gets a fresh, successful lookup.
        const retry = await listVisJson<unknown[]>(FAKE_VIS, workspaceRoot, ["list", "--json"]);

        expect(retry).toHaveLength(2);
    });
});
