import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { vi } from "vitest";

// Shared registry-mock helper used across the includeLocked / includePrerelease /
// target / catalog-update describe blocks. Extracted to avoid duplicating the
// same fetch-spy setup four times.
export const mockFetch = (responses: Record<string, { latest: string; versions: string[] } | "error">) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const packageName = url.replace("https://registry.npmjs.org/", "");
        const data = responses[packageName];

        if (!data || data === "error") {
            return { ok: false, status: 404, statusText: "Not Found" } as Response;
        }

        const versionsObject: Record<string, unknown> = {};

        for (const v of data.versions) {
            versionsObject[v] = {};
        }

        return {
            json: async () => {
                return { "dist-tags": { latest: data.latest }, versions: versionsObject };
            },
            ok: true,
        } as Response;
    });
};

// Catalog backups live inside `<workspace>/node_modules/.cache/vis/backup/`
// so `findCacheDirSync` (which walks up looking for a package.json anchor)
// can resolve a writable cache directory. Each test root therefore needs a
// stub package.json even when the test only cares about the catalog file.
export const CACHED_BACKUP_DIR = join("node_modules", ".cache", "vis", "backup");

export const writeRoot = (root: string, body: Record<string, unknown>): void => {
    writeFileSync(join(root, "package.json"), JSON.stringify(body));
};

export const writeChild = (root: string, relativeDirectory: string, body: Record<string, unknown>): void => {
    const directory = join(root, relativeDirectory);

    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify(body));
};
