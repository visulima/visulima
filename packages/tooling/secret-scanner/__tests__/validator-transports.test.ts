import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupTransport, reportValidators, resetWarningsForTests, runTransport, TRANSPORTS } from "../src/transports";

describe("tRANSPORTS registry", () => {
    it("declares every non-HTTP validator type Kingfisher ships", () => {
        expect.assertions(1);

        const byName = (a: string, b: string): number => a.localeCompare(b);
        const expectedTypes = ["AWS", "AzureStorage", "Coinbase", "GCP", "Grpc", "JWT", "Jdbc", "MongoDB", "MySQL", "Postgres", "Raw"];

        expect(Object.keys(TRANSPORTS).toSorted(byName)).toStrictEqual(expectedTypes.toSorted(byName));
    });

    it("ships implementations for the seven tractable transports", () => {
        expect.assertions(7);

        for (const type of ["AWS", "GCP", "JWT", "Jdbc", "MongoDB", "MySQL", "Postgres"] as const) {
            expect(TRANSPORTS[type]?.implemented).toBe(true);
        }
    });

    it("keeps the bespoke transports marked as not-yet-implemented", () => {
        expect.assertions(4);

        for (const type of ["AzureStorage", "Coinbase", "Grpc", "Raw"] as const) {
            expect(TRANSPORTS[type]?.implemented).toBe(false);
        }
    });

    it("gives every entry a user-facing summary", () => {
        // Assertion count matches the registry size; update this literal when
        // a new transport is registered. (vitest/prefer-expect-assertions
        // requires a numeric literal, not an expression.)
        expect.assertions(11);

        for (const entry of Object.values(TRANSPORTS)) {
            expect(entry.summary.length).toBeGreaterThan(10);
        }
    });
});

describe(lookupTransport, () => {
    it("returns registry metadata for a known type", () => {
        expect.assertions(2);

        const aws = lookupTransport("AWS");

        expect(aws?.packageName).toBe("@aws-sdk/client-sts");
        expect(aws?.displayName).toBe("AWS STS");
    });

    it("returns undefined for an unknown type", () => {
        expect.assertions(1);

        expect(lookupTransport("ChatGPT")).toBeUndefined();
    });
});

const emptyContext = { extras: {}, secret: "", validation: {} };

describe("runTransport — unimplemented types", () => {
    afterEach(() => {
        resetWarningsForTests();
    });

    it("returns 'skipped' and writes one install-hint warning per type per process", async () => {
        expect.assertions(3);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const first = await runTransport("AzureStorage", emptyContext);
        const second = await runTransport("AzureStorage", emptyContext);

        expect(first).toBe("skipped");
        expect(second).toBe("skipped");
        // Warning fires once for the same type — the second `runTransport("AzureStorage")`
        // must not produce a duplicate message.
        expect(consoleError).toHaveBeenCalledTimes(1);

        consoleError.mockRestore();
    });

    it("falls back to 'skipped' without an npm-add hint for types without a package", async () => {
        expect.assertions(2);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const status = await runTransport("Raw", emptyContext);

        expect(status).toBe("skipped");

        const { calls } = consoleError.mock;
        const message = typeof calls[0]?.[0] === "string" ? calls[0][0] : "";

        expect(message).toContain("bespoke implementation");

        consoleError.mockRestore();
    });
});

describe("runTransport — implemented transports", () => {
    afterEach(() => {
        resetWarningsForTests();
    });

    // Missing-dep behaviour is covered generically by the `tryImport` test
    // above (uses a deliberately non-existent package name). Peer deps ship
    // as devDependencies of this package so transport-specific tests can
    // exercise real driver paths — the `mongodb`-is-missing assertion was
    // brittle because pnpm auto-installs optional peer deps in the workspace.

    it("returns 'error' (not 'skipped') when the MongoDB driver is available but the host is unreachable", async () => {
        expect.assertions(1);

        // `host.invalid` is a TLD reserved for testing — guaranteed DNS failure,
        // so the driver connect() rejects and the validator returns "error".
        const status = await runTransport("MongoDB", {
            ...emptyContext,
            secret: "mongodb://user:pass@host.invalid:27017/db",
        });

        expect(status).toBe("error");
    });

    it("returns 'skipped' for the JDBC Oracle variant (no driver shipped)", async () => {
        expect.assertions(1);

        const status = await runTransport("Jdbc", {
            ...emptyContext,
            secret: "jdbc:oracle:thin:@host.invalid:1521:ORCL",
        });

        expect(status).toBe("skipped");
    });

    it("returns 'skipped' for a transport type that isn't in the registry", async () => {
        expect.assertions(1);

        const status = await runTransport("NotARegisteredType", emptyContext);

        expect(status).toBe("skipped");
    });
});

describe(reportValidators, () => {
    it("counts rules per transport type and sorts by descending count", () => {
        expect.assertions(3);

        const rules = [
            { validation: { type: "AWS" } },
            { validation: { type: "AWS" } },
            { validation: { type: "AWS" } },
            { validation: { type: "MongoDB" } },
            { validation: { type: "MongoDB" } },
            { validation: { type: "MySQL" } },
            { validation: { type: "Http" } }, // excluded — not in registry
            // eslint-disable-next-line unicorn/no-null -- `reportValidators` intentionally tolerates `null` validation fields from upstream YAML.
            { validation: null },
        ];

        const report = reportValidators(rules);

        expect(report.map((r) => r.type)).toStrictEqual(["AWS", "MongoDB", "MySQL"]);
        expect(report[0]?.ruleCount).toBe(3);
        expect(report.map((r) => r.packageName)).toStrictEqual(["@aws-sdk/client-sts", "mongodb", "mysql2"]);
    });

    it("returns an empty array when no rules carry transport-typed validators", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/no-null -- same rationale as the `null` in the previous test fixture.
        expect(reportValidators([{ validation: { type: "Http" } }, { validation: null }])).toStrictEqual([]);
    });

    it("ignores validation blocks whose `type` field isn't a string", () => {
        expect.assertions(1);

        // A malformed rule with a numeric `type` is skipped, leaving only the
        // well-formed AWS rule in the report.
        const report = reportValidators([{ validation: { type: 5 } }, { validation: { type: "AWS" } }]);

        expect(report.map((r) => r.type)).toStrictEqual(["AWS"]);
    });
});
