import { mkdtempSync, promises as fsPromises, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedAdvisoryDb } from "../../security/advisory-db-fixture";

// Real lock files, real readers, real native query. Only the stdout sink is stubbed so the JSON
// report can be parsed. The bug this guards against: two versions of one package in a lock file
// were collapsed onto a single name-keyed result, so each version reported the other's findings.

const NPM_LOCK = {
    lockfileVersion: 3,
    packages: {
        "": { name: "multiversion-app", version: "1.0.0" },
        "node_modules/legacy/node_modules/lodash": { version: "4.17.10" },
        "node_modules/lodash": { version: "4.17.12" },
    },
};

// Two `serde` blocks: 1.0.99 is affected, 1.0.100 is the fixed release.
const CARGO_LOCK = `version = 3

[[package]]
name = "serde"
version = "1.0.99"
source = "registry+https://github.com/rust-lang/crates.io-index"

[[package]]
name = "serde"
version = "1.0.100"
source = "registry+https://github.com/rust-lang/crates.io-index"
`;

let workspaceRoot: string;
let dbPath: string;
let stdoutChunks: string[];

const writeOsvDb = (): void => {
    seedAdvisoryDb(dbPath, [
        { advisoryId: "GHSA-lodash-proto", ecosystem: "npm", fixed: "4.17.11", introduced: "0", package: "lodash", summary: "prototype pollution" },
        { advisoryId: "RUSTSEC-serde", ecosystem: "crates.io", fixed: "1.0.100", introduced: "0", package: "serde", summary: "serde soundness" },
    ]);
};

const runAudit = async (): Promise<{ results: { name: string; version: string; vulnerabilities: { id: string }[] }[] }> => {
    const { default: execute } = await import("../../../src/commands/audit/handler");

    await execute({
        fs: fsPromises,
        logger: console,
        options: { backend: "vis", db: dbPath, ecosystem: "npm,cargo", format: "json", offline: true },
        visConfig: undefined,
        workspaceRoot,
    } as unknown as Parameters<typeof execute>[0]);

    return JSON.parse(stdoutChunks.join(""));
};

describe("vis audit offline multi-version lock files", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-audit-multiversion-"));
        dbPath = join(workspaceRoot, "db.sqlite");
        stdoutChunks = [];
        process.exitCode = undefined;
        writeFileSync(join(workspaceRoot, "package-lock.json"), JSON.stringify(NPM_LOCK));
        writeFileSync(join(workspaceRoot, "Cargo.lock"), CARGO_LOCK);
        writeOsvDb();
        vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
            stdoutChunks.push(String(chunk));

            return true;
        });
        vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("reports only the affected version of each multi-version npm package", async () => {
        expect.assertions(2);

        const report = await runAudit();
        const lodash = report.results.filter((entry) => entry.name === "lodash");

        // The fixed 4.17.12 is clean and must not appear; only the affected 4.17.10 is reported.
        expect(lodash.map((entry) => [entry.version, entry.vulnerabilities.map((v) => v.id)])).toStrictEqual([["4.17.10", ["GHSA-lodash-proto"]]]);
        expect(process.exitCode).not.toBe(1);
    });

    it("reports only the affected version of each multi-version Cargo crate", async () => {
        expect.assertions(2);

        const report = await runAudit();
        const serde = report.results.filter((entry) => entry.name === "serde");

        expect(serde.find((entry) => entry.version === "1.0.99")?.vulnerabilities.map((v) => v.id)).toStrictEqual(["RUSTSEC-serde"]);
        expect(serde.find((entry) => entry.version === "1.0.100")).toBeUndefined();
    });
});
