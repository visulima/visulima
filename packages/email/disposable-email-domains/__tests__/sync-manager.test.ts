import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import repositories from "../scripts/config/repositories.json";
// @ts-expect-error -- plain-JS sync script; no type declarations are shipped for it.
import DisposableEmailSyncManager from "../scripts/disposable-email-sync-manager.js";

/**
 * The slice of the sync manager these tests drive.
 */
interface SyncManager {
    extractDomain: (line: string) => string | undefined;
    generateDomainsList: (finalDomains?: string[]) => Promise<void>;
    isValidDomain: (domain: string) => boolean;
    parseDomainList: (text: string) => string[];
}

const SyncManager = DisposableEmailSyncManager as new (options: { outputPath: string }) => SyncManager;

// eslint-disable-next-line no-secrets/no-secrets -- test suite name, not a secret
describe("disposableEmailSyncManager list parsing", () => {
    let manager: SyncManager;

    beforeEach(() => {
        manager = new SyncManager({ outputPath: "dist" });
    });

    describe("extractDomain", () => {
        it("returns a plain domain unchanged", () => {
            expect.assertions(1);

            expect(manager.extractDomain("example.com")).toBe("example.com");
        });

        it("strips host-file prefixes (0.0.0.0 / 127.0.0.1 / localhost)", () => {
            expect.assertions(3);

            expect(manager.extractDomain("0.0.0.0 hostfile.com")).toBe("hostfile.com");
            expect(manager.extractDomain("127.0.0.1 loopback.com")).toBe("loopback.com");
            expect(manager.extractDomain("localhost local.com")).toBe("local.com");
        });

        it("strips a wildcard prefix", () => {
            expect.assertions(1);

            expect(manager.extractDomain("*.wildcard.com")).toBe("wildcard.com");
        });

        it("extracts the domain from an email address", () => {
            expect.assertions(1);

            expect(manager.extractDomain("abuse@email.com")).toBe("email.com");
        });

        it("drops a trailing comma/semicolon separator segment", () => {
            expect.assertions(2);

            expect(manager.extractDomain("separator.com,extra")).toBe("separator.com");
            expect(manager.extractDomain("separator.com;extra")).toBe("separator.com");
        });

        it("drops single trailing whitespace-delimited content", () => {
            expect.assertions(1);

            expect(manager.extractDomain("trailing.com junk")).toBe("trailing.com");
        });
    });

    describe("isValidDomain", () => {
        it("accepts well-formed domains and subdomains", () => {
            expect.assertions(2);

            expect(manager.isValidDomain("example.com")).toBe(true);
            expect(manager.isValidDomain("sub.example.co.uk")).toBe(true);
        });

        it("rejects domains without a dot, with underscores, or with consecutive dots", () => {
            expect.assertions(3);

            expect(manager.isValidDomain("nodot")).toBe(false);
            expect(manager.isValidDomain("invalid_domain.com")).toBe(false);
            expect(manager.isValidDomain("double..dot.com")).toBe(false);
        });

        it("rejects empty and over-length domains", () => {
            expect.assertions(2);

            expect(manager.isValidDomain("")).toBe(false);
            expect(manager.isValidDomain(`${"a".repeat(250)}.com`)).toBe(false);
        });
    });

    describe("parseDomainList", () => {
        it("parses every supported line format and rejects invalid domains", () => {
            expect.assertions(1);

            const text = [
                "# hash comment",
                "// slash comment",
                "; semicolon comment",
                "",
                "   ",
                "plain.com",
                "0.0.0.0 hostfile.com",
                "127.0.0.1 loopback.com",
                "localhost local.com",
                "*.wildcard.com",
                "abuse@email.com",
                "separator.com,extra",
                "trailing.com junk",
                "UPPER.COM",
                "invalid_domain",
                "nodot",
            ].join("\n");

            expect(manager.parseDomainList(text)).toStrictEqual([
                "plain.com",
                "hostfile.com",
                "loopback.com",
                "local.com",
                "wildcard.com",
                "email.com",
                "separator.com",
                "trailing.com",
                "upper.com",
            ]);
        });
    });
});

// eslint-disable-next-line no-secrets/no-secrets -- test suite name, not a secret
describe("disposableEmailSyncManager generated ./domains declaration", () => {
    let outputPath: string;
    let manager: SyncManager;

    beforeEach(async () => {
        outputPath = await mkdtemp(join(tmpdir(), "disposable-domains-dts-"));
        manager = new SyncManager({ outputPath });
    });

    afterEach(async () => {
        await rm(outputPath, { force: true, recursive: true });
    });

    it("emits an ESM default export, not a CJS `export =`", async () => {
        expect.assertions(2);

        await manager.generateDomainsList([]);

        const declaration = await readFile(join(outputPath, "domains.d.ts"), "utf8");

        expect(declaration).toContain("export default domains;");
        expect(declaration).not.toContain("export =");
    });
});

describe("repositories.json config", () => {
    it("does not pull willwhite/freemail's free-provider list (data/free.txt)", () => {
        expect.assertions(1);

        const freemailFreeSources = (repositories as { blocklist_files?: string[]; url: string }[]).filter(
            (repo) => repo.url.includes("willwhite/freemail") && (repo.blocklist_files ?? []).some((file) => file.includes("free.txt")),
        );

        expect(freemailFreeSources).toStrictEqual([]);
    });
});
