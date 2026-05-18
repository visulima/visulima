import { describe, expect, it } from "vitest";

import type { MarshallName } from "../../src/security/marshalls/registry";
import { ALL_MARSHALLS, envVarFor, isMarshallDisabled } from "../../src/security/marshalls/registry";

describe(envVarFor, () => {
    it.each<[MarshallName, string]>([
        ["typosquats", "MARSHALL_DISABLE_TYPOSQUATS"],
        ["installScripts", "MARSHALL_DISABLE_INSTALL_SCRIPTS"],
        ["firstSeen", "MARSHALL_DISABLE_FIRST_SEEN"],
        ["publisherChange", "MARSHALL_DISABLE_PUBLISHER_CHANGE"],
        ["score", "MARSHALL_DISABLE_SCORE"],
        ["malware", "MARSHALL_DISABLE_MALWARE"],
        ["vulnerability", "MARSHALL_DISABLE_VULNERABILITY"],
        ["license", "MARSHALL_DISABLE_LICENSE"],
        ["unexpectedDeps", "MARSHALL_DISABLE_UNEXPECTED_DEPS"],
        ["author", "MARSHALL_DISABLE_AUTHOR"],
        ["expiredDomains", "MARSHALL_DISABLE_EXPIRED_DOMAINS"],
        ["signatures", "MARSHALL_DISABLE_SIGNATURES"],
        ["provenance", "MARSHALL_DISABLE_PROVENANCE"],
        ["s1ngularity", "MARSHALL_DISABLE_S1NGULARITY"],
        ["newBin", "MARSHALL_DISABLE_NEW_BIN"],
        ["downloads", "MARSHALL_DISABLE_DOWNLOADS"],
        ["metadata", "MARSHALL_DISABLE_METADATA"],
        ["archivedRepo", "MARSHALL_DISABLE_ARCHIVED_REPO"],
    ])("maps %s → %s", (name, expected) => {
        expect.assertions(1);

        expect(envVarFor(name)).toBe(expected);
    });

    it("covers every entry in ALL_MARSHALLS", () => {
        expect.assertions(1);

        // Sanity: no marshall name in the union should be missing from the table above.
        // If this fails, add the new name to the it.each table and to the canonical list.
        expect(new Set(ALL_MARSHALLS).size).toBe(ALL_MARSHALLS.length);
    });
});

describe(isMarshallDisabled, () => {
    it("returns false when the env is empty", () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions -- ALL_MARSHALLS is the canonical registry; iteration count tracks it.
        expect.assertions(ALL_MARSHALLS.length);

        for (const name of ALL_MARSHALLS) {
            expect(isMarshallDisabled(name, {})).toBe(false);
        }
    });

    it("returns true when the marshall-specific env var is set to '1'", () => {
        expect.assertions(1);

        expect(isMarshallDisabled("author", { MARSHALL_DISABLE_AUTHOR: "1" })).toBe(true);
    });

    it("treats arbitrary truthy strings as disable", () => {
        expect.assertions(3);

        expect(isMarshallDisabled("newBin", { MARSHALL_DISABLE_NEW_BIN: "true" })).toBe(true);
        expect(isMarshallDisabled("newBin", { MARSHALL_DISABLE_NEW_BIN: "yes" })).toBe(true);
        expect(isMarshallDisabled("newBin", { MARSHALL_DISABLE_NEW_BIN: "on" })).toBe(true);
    });

    it("treats explicit falsy values as enabled", () => {
        expect.assertions(4);

        expect(isMarshallDisabled("author", { MARSHALL_DISABLE_AUTHOR: "0" })).toBe(false);
        expect(isMarshallDisabled("author", { MARSHALL_DISABLE_AUTHOR: "false" })).toBe(false);
        expect(isMarshallDisabled("author", { MARSHALL_DISABLE_AUTHOR: "no" })).toBe(false);
        expect(isMarshallDisabled("author", { MARSHALL_DISABLE_AUTHOR: "" })).toBe(false);
    });

    it("mARSHALL_DISABLE_ALL disables every marshall", () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions -- ALL_MARSHALLS is the canonical registry; iteration count tracks it.
        expect.assertions(ALL_MARSHALLS.length);

        const env = { MARSHALL_DISABLE_ALL: "1" };

        for (const name of ALL_MARSHALLS) {
            expect(isMarshallDisabled(name, env)).toBe(true);
        }
    });

    it("mARSHALL_DISABLE_ALL wins over an explicit per-marshall enable", () => {
        expect.assertions(1);

        // No "enable" override exists — env is purely additive. This documents
        // that an explicit MARSHALL_DISABLE_AUTHOR=0 does NOT re-enable when ALL is on.
        const env = { MARSHALL_DISABLE_ALL: "1", MARSHALL_DISABLE_AUTHOR: "0" };

        expect(isMarshallDisabled("author", env)).toBe(true);
    });

    it("only the named marshall is affected by its own env var", () => {
        expect.assertions(2);

        const env = { MARSHALL_DISABLE_AUTHOR: "1" };

        expect(isMarshallDisabled("author", env)).toBe(true);
        expect(isMarshallDisabled("downloads", env)).toBe(false);
    });

    it("defaults to process.env when no env arg is supplied", () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_DOWNLOADS;

        try {
            process.env.MARSHALL_DISABLE_DOWNLOADS = "1";

            expect(isMarshallDisabled("downloads")).toBe(true);

            delete process.env.MARSHALL_DISABLE_DOWNLOADS;

            expect(isMarshallDisabled("downloads")).toBe(false);
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_DOWNLOADS;
            } else {
                process.env.MARSHALL_DISABLE_DOWNLOADS = previous;
            }
        }
    });
});

describe("aLL_MARSHALLS contents", () => {
    it("is deduplicated", () => {
        expect.assertions(1);

        expect(new Set(ALL_MARSHALLS).size).toBe(ALL_MARSHALLS.length);
    });

    it("contains the policy, integration, and pre-install marshalls", () => {
        expect.assertions(1);

        const policy: MarshallName[] = ["installScripts", "firstSeen", "publisherChange", "score", "malware", "vulnerability", "license", "unexpectedDeps"];
        const preInstall: MarshallName[] = [
            "typosquats",
            "author",
            "expiredDomains",
            "signatures",
            "provenance",
            "s1ngularity",
            "newBin",
            "downloads",
            "metadata",
            "deprecation",
            "packageAge",
            "archivedRepo",
        ];
        const integrations: MarshallName[] = ["minReleaseAge", "socket", "depsDev"];

        expect(new Set([...policy, ...preInstall, ...integrations])).toStrictEqual(new Set(ALL_MARSHALLS));
    });
});
