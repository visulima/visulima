import { appendFileSync, existsSync, mkdtempSync, promises as fsPromises, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- node:sqlite is unflagged from Node 22.13, inside the ^22.14.0 engine range
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { advisoriesPruneExecute } from "../../src/commands/advisories/prune";
import { advisoriesSyncExecute } from "../../src/commands/advisories/sync";
import { pail } from "../../src/io/logger";
import type { SyncResult } from "../../src/security/advisories";
import { AdvisoryDbRebuildError, AdvisoryDbSchemaError, advisoryDbSchemaError, syncAdvisories } from "../../src/security/advisories";
import { seedAdvisoryDb } from "./advisory-db-fixture";

const state = vi.hoisted(() => {
    return { ingestFails: undefined as string | undefined };
});

const ingest = vi.hoisted(() => vi.fn());

// Only the zip ingest is replaced. Status and query stay native, so the schema and ecosystem reads are real.
vi.mock(import("#native"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        advisoriesIngest: ingest,
    };
});

const { advisoriesStatus } = await import("#native");

const SOURCE = "https://osv-vulnerabilities.storage.googleapis.com";

/** Write an advisory DB file at `path` with the given schema version and one meta row per ecosystem. */
const writeDb = (path: string, schemaVersion: number, ecosystems: { etag?: string; name: string }[]): void => {
    seedAdvisoryDb(path, []);

    const db = new DatabaseSync(path);

    db.prepare("UPDATE meta SET value = ? WHERE ecosystem = '' AND key = 'schema_version'").run(String(schemaVersion));

    for (const eco of ecosystems) {
        db.prepare("INSERT OR REPLACE INTO meta (ecosystem, key, value) VALUES (?, 'advisory_count', '1')").run(eco.name);

        if (eco.etag) {
            db.prepare("INSERT OR REPLACE INTO meta (ecosystem, key, value) VALUES (?, 'manifest_etag', ?)").run(eco.name, eco.etag);
        }
    }

    db.close();
};

let dir: string;
let dbPath: string;
let fetchMock: ReturnType<typeof vi.fn>;

/** Stub the OSV bucket: HEAD and GET both answer with a per-ecosystem ETag. */
const stubBucket = (): void => {
    fetchMock = vi.fn(async (input: URL | string, init?: RequestInit) => {
        const eco = String(input).split("/").at(-2);

        if (init?.method === "HEAD") {
            return new Response(null, { headers: { etag: `"${eco}-etag"` }, status: 200 });
        }

        return new Response("zip-bytes", { headers: { etag: `"${eco}-etag"` }, status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
};

const getEcosystemsFetched = (): string[] => fetchMock.mock.calls
    .filter(([, init]) => init?.method !== "HEAD")
    .map(([input]) => String(input).split("/").at(-2) ?? "");

const syncOptions = (ecosystem: string) => {
    return { allowedHosts: [], dbPath, ecosystem, force: false, source: SOURCE, workspaceRoot: dir };
};

const ecosystemNames = (path: string): string[] => advisoriesStatus(path).ecosystems.map((e) => e.name);

describe("advisory database schema", () => {
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "vis-advisory-schema-"));
        dbPath = join(dir, "advisories.sqlite");
        writeDb(dbPath, 1, [{ name: "npm" }, { name: "PyPI" }]);
        state.ingestFails = undefined;
        ingest.mockReset();
        // The native ingest writes one ecosystem's rows and meta into the file it is given. Mirror that with a meta row.
        ingest.mockImplementation(async (options: { dbPath: string; ecosystem: string; manifestEtag?: string }) => {
            if (state.ingestFails === options.ecosystem) {
                throw new Error("zip is corrupt");
            }

            writeDb(options.dbPath, 2, [{ etag: options.manifestEtag, name: options.ecosystem }]);

            return { advisoriesIngested: 3, durationMs: 1 };
        });
        stubBucket();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("names 'vis advisories sync' as the fix for a v1 database, and not prune", () => {
        expect.assertions(4);

        const error = advisoryDbSchemaError(dbPath);

        expect(error).toBeInstanceOf(AdvisoryDbSchemaError);
        expect(error?.message).toContain("schema v1");
        expect(error?.message).toContain("vis advisories sync");
        expect(error?.message).not.toContain("prune");
    });

    it("accepts a database at the current schema", () => {
        expect.assertions(1);

        writeDb(dbPath, 2, []);

        expect(advisoryDbSchemaError(dbPath)).toBeUndefined();
    });

    it("rebuilds a v1 database to v2 and keeps every ecosystem the old file held", async () => {
        expect.assertions(6);

        const result: SyncResult = await syncAdvisories(syncOptions("crates.io"));

        expect(result.rebuiltFromSchema).toBe(1);
        expect(result.upToDate).toBe(false);
        // The requested ecosystem plus each ecosystem the real v1 status reported.
        expect(getEcosystemsFetched().sort()).toStrictEqual(["PyPI", "crates.io", "npm"]);
        expect(advisoriesStatus(dbPath).schemaVersion).toBe(2);
        expect(ecosystemNames(dbPath)).toStrictEqual(["PyPI", "crates.io", "npm"]);
        expect(readdirSync(dir).filter((f) => f.includes(".rebuild."))).toStrictEqual([]);
    });

    it("keeps the old file byte-for-byte and fails with the reason when a rebuild fails part-way", async () => {
        expect.assertions(5);

        const before = readFileSync(dbPath);

        state.ingestFails = "PyPI";

        const error = await syncAdvisories(syncOptions("npm")).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(AdvisoryDbRebuildError);
        expect((error as Error).message).toContain("zip is corrupt");
        expect(readFileSync(dbPath).equals(before)).toBe(true);
        expect(advisoriesStatus(dbPath).schemaVersion).toBe(1);
        expect(readdirSync(dir).filter((f) => f.includes(".rebuild."))).toStrictEqual([]);
    });

    it("prints a one-line notice when the sync command rebuilds the database", async () => {
        expect.assertions(2);

        const info = vi.spyOn(pail, "info").mockImplementation(() => undefined);

        await advisoriesSyncExecute({
            logger: console,
            options: { db: dbPath, ecosystem: "npm", force: false, format: "text", source: SOURCE },
            visConfig: undefined,
            workspaceRoot: dir,
        } as never);

        expect(info).toHaveBeenCalledWith("advisory database is schema v1; rebuilt to v2");
        expect(process.exitCode).toBeUndefined();
    });

    it("short-circuits on the ETag once the database is at v2", async () => {
        expect.assertions(3);

        writeDb(dbPath, 2, [{ etag: "\"npm-etag\"", name: "npm" }]);

        const result = await syncAdvisories(syncOptions("npm"));

        expect(result.upToDate).toBe(true);
        expect(getEcosystemsFetched()).toStrictEqual([]);
        expect(ingest).not.toHaveBeenCalled();
    });

    it("prune --force still removes the database and its sidecar files", async () => {
        expect.assertions(2);

        appendFileSync(`${dbPath}-wal`, "wal");

        await advisoriesPruneExecute({
            fs: fsPromises,
            logger: console,
            options: { db: dbPath, force: true, format: undefined },
            workspaceRoot: dir,
        } as never);

        expect(existsSync(dbPath)).toBe(false);
        expect(existsSync(`${dbPath}-wal`)).toBe(false);
    });
});
