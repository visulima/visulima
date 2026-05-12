/**
 * Shared setup for the offline-audit perf gate. Builds a synthetic OSV zip
 * with N advisory entries, ingests it into a temp DB via the native binding,
 * and returns the DB path plus a matching query batch.
 *
 * Used by both `audit-offline.bench.ts` (vitest bench reporter) and
 * `audit-offline.test.ts` (hard budget assertion).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";

import { advisoriesIngest } from "#native";
import type { AdvisoryQuery } from "#native";

type ZipEntry = { name: string; data: Buffer };

/**
 * Pure-JS STORED-mode zip writer. The native ingester accepts STORED, so
 * we skip deflate to keep the helper dep-free. Layout per PKWARE APPNOTE:
 * local-file headers + raw data, then central-directory headers, then the
 * end-of-central-directory record. Mod time is zeroed for reproducibility.
 */
const buildStoredZip = (entries: ZipEntry[]): Buffer => {
    const localChunks: Buffer[] = [];
    const centralChunks: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, "utf8");
        const crc = crc32(entry.data);
        const size = entry.data.length;

        const local = Buffer.alloc(30);

        // Local file header signature `PK\x03\x04`.
        local.writeUInt32LE(0x04_03_4b_50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(size, 18);
        local.writeUInt32LE(size, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        localChunks.push(local, nameBuf, entry.data);

        const central = Buffer.alloc(46);

        // Central directory file header signature `PK\x01\x02`.
        central.writeUInt32LE(0x02_01_4b_50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(size, 20);
        central.writeUInt32LE(size, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralChunks.push(central, nameBuf);

        offset += local.length + nameBuf.length + entry.data.length;
    }

    const centralBytes = Buffer.concat(centralChunks);
    const localBytes = Buffer.concat(localChunks);

    const eocd = Buffer.alloc(22);

    // End of central directory record signature `PK\x05\x06`.
    eocd.writeUInt32LE(0x06_05_4b_50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralBytes.length, 12);
    eocd.writeUInt32LE(localBytes.length, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([localBytes, centralBytes, eocd]);
};

const advisoryJson = (index: number): string => JSON.stringify({
    affected: [
        {
            package: { ecosystem: "npm", name: `bench-pkg-${index}` },
            ranges: [
                {
                    events: [{ introduced: "0" }, { fixed: "2.0.0" }],
                    type: "SEMVER",
                },
            ],
        },
    ],
    aliases: [],
    database_specific: { cvss_score: 7.5, severity: "HIGH" },
    id: `GHSA-bench-${index}`,
    modified: "2026-05-11T00:00:00Z",
    published: "2026-05-11T00:00:00Z",
    severity: [],
    summary: `Synthetic advisory ${index}`,
});

export interface AuditOfflineFixture {
    dbPath: string;
    queries: AdvisoryQuery[];
    cleanup: () => void;
}

export const createAuditOfflineFixture = async (pkgCount: number): Promise<AuditOfflineFixture> => {
    const tmpDir = mkdtempSync(join(tmpdir(), "vis-audit-perf-"));
    const dbPath = join(tmpDir, "advisories.db");
    const zipPath = join(tmpDir, "fixture.zip");

    const entries: ZipEntry[] = Array.from({ length: pkgCount }, (_, index) => ({
        data: Buffer.from(advisoryJson(index), "utf8"),
        name: `GHSA-bench-${index}.json`,
    }));

    writeFileSync(zipPath, buildStoredZip(entries));

    await advisoriesIngest({ dbPath, ecosystem: "npm", zipPath }, () => undefined);

    const queries: AdvisoryQuery[] = Array.from({ length: pkgCount }, (_, index) => ({
        ecosystem: "npm",
        name: `bench-pkg-${index}`,
        version: "1.0.0",
    }));

    return {
        cleanup: () => rmSync(tmpDir, { force: true, recursive: true }),
        dbPath,
        queries,
    };
};
