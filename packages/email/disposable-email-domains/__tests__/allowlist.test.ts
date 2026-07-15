import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import allowlist from "../scripts/config/allowlist.json";
// @ts-expect-error -- plain-JS sync script; no type declarations are shipped for it.
import DisposableEmailSyncManager from "../scripts/disposable-email-sync-manager.js";

/**
 * The slice of the sync manager these tests drive.
 */
interface SyncManager {
    addDomain: (domain: string, source: string) => void;
    generateDomainsList: () => Promise<void>;
    isValidDomain: (domain: string) => boolean;
    loadAllowlist: (allowlistPath: string) => Promise<number>;
}

const SyncManager = DisposableEmailSyncManager as new (options: { outputPath: string }) => SyncManager;

describe("allowlist.json", () => {
    let outputPath: string;
    let allowlistPath: string;
    let manager: SyncManager;

    /**
     * `generateDomainsList` writes `domains.json` into `outputPath`, so each case runs
     * against a throwaway directory and reads the emitted list back.
     * @returns The generated domain list.
     */
    const generate = async (): Promise<string[]> => {
        await manager.generateDomainsList();

        return JSON.parse(await readFile(join(outputPath, "domains.json"), "utf8")) as string[];
    };

    beforeEach(async () => {
        outputPath = await mkdtemp(join(tmpdir(), "disposable-allowlist-"));
        allowlistPath = join(outputPath, "allowlist.json");
        manager = new SyncManager({ outputPath });
    });

    afterEach(async () => {
        await rm(outputPath, { force: true, recursive: true });
    });

    // https://github.com/visulima/visulima/issues/722
    it("excludes Yahoo's regional domains that upstream sources report as disposable", async () => {
        expect.assertions(2);

        manager.addDomain("yahoo.co.in", "upstream-list");
        manager.addDomain("yahoo.in", "upstream-list");

        await writeFile(allowlistPath, JSON.stringify(["yahoo.co.in", "yahoo.in"]));
        await manager.loadAllowlist(allowlistPath);

        const domains = await generate();

        expect(domains).not.toContain("yahoo.co.in");
        expect(domains).not.toContain("yahoo.in");
    });

    it("keeps genuinely disposable domains from the same source", async () => {
        expect.assertions(1);

        manager.addDomain("yahoo.co.in", "upstream-list");
        manager.addDomain("yahoo.cu.uk", "upstream-list");

        await writeFile(allowlistPath, JSON.stringify(["yahoo.co.in"]));
        await manager.loadAllowlist(allowlistPath);

        const domains = await generate();

        // A typosquat of yahoo.co.uk — allowlisting the real domain must not rescue it.
        expect(domains).toContain("yahoo.cu.uk");
    });

    it("wins over blacklist.json when a domain is listed in both", async () => {
        expect.assertions(1);

        manager.addDomain("yahoo.co.in", "blacklist.json");

        await writeFile(allowlistPath, JSON.stringify(["yahoo.co.in"]));
        await manager.loadAllowlist(allowlistPath);

        const domains = await generate();

        expect(domains).not.toContain("yahoo.co.in");
    });

    it("ships the domains reported in issue #722", () => {
        expect.assertions(2);

        expect(allowlist).toContain("yahoo.co.in");
        expect(allowlist).toContain("yahoo.in");
    });

    it("only lists domains in a valid format", () => {
        expect.assertions(1);

        const invalid = allowlist.filter((domain) => !manager.isValidDomain(domain));

        expect(invalid).toStrictEqual([]);
    });
});
