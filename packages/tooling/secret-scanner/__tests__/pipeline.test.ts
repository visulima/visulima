import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postProcess, resetPipelineWarningsForTests } from "../src/pipeline";
import type { PreparedScan, RuleMeta } from "../src/prepare-scan";
import type { Finding, ScanOptions } from "../src/types";

const sampleFinding = (overrides: Partial<Finding> = {}): Finding => {
    return {
        alternateMatches: [],
        confidence: "low",
        description: "",
        endColumn: 1,
        endLine: 1,
        entropy: 0,
        file: "src/app.ts",
        match: "secret-value",
        ruleId: "sample-rule",
        secret: "secret-value",
        startColumn: 1,
        startLine: 10,
        tags: [],
        ...overrides,
    };
};

const preparedScan = (ruleMeta: Map<string, RuleMeta> = new Map(), include?: string[], exclude?: string[]): PreparedScan => {
    return {
        excludeIds: exclude,
        includeIds: include,
        nativeOptions: {},
        ruleMeta,
    };
};

let tmp: string;

beforeEach(async () => {
    tmp = await mkdtemp(resolve(tmpdir(), "secret-scanner-pipeline-test-"));
});

afterEach(async () => {
    await rm(tmp, { force: true, recursive: true });
});

describe("postProcess — rule filter", () => {
    it("keeps only findings whose ruleId is in `includeIds`", async () => {
        expect.assertions(1);

        const findings = [sampleFinding({ ruleId: "aws-access-token" }), sampleFinding({ ruleId: "github-pat" }), sampleFinding({ ruleId: "sample-rule" })];
        const prepared = preparedScan(new Map(), ["aws-access-token", "sample-rule"]);
        const out = await postProcess(findings, prepared, undefined);

        expect(out.map((f) => f.ruleId)).toStrictEqual(["aws-access-token", "sample-rule"]);
    });

    it("drops findings whose ruleId is in `excludeIds`", async () => {
        expect.assertions(1);

        const findings = [sampleFinding({ ruleId: "noisy-rule" }), sampleFinding({ ruleId: "aws-access-token" })];
        const prepared = preparedScan(new Map(), undefined, ["noisy-rule"]);
        const out = await postProcess(findings, prepared, undefined);

        expect(out.map((f) => f.ruleId)).toStrictEqual(["aws-access-token"]);
    });

    it("passes every finding through when neither include nor exclude is set", async () => {
        expect.assertions(1);

        const findings = [sampleFinding({ ruleId: "a" }), sampleFinding({ ruleId: "b" })];

        await expect(postProcess(findings, preparedScan(), undefined)).resolves.toStrictEqual(findings);
    });
});

describe("postProcess — checksum filter", () => {
    // A real Kingfisher-style checksum spec: match is `zpka_<body>_<checksum>`,
    // expected checksum = crc32_hex(body). The ZUPLO example from the YAML.
    const ZUPLO_RULE_META: RuleMeta = {
        checksum: {
            actual: { requires_capture: "checksum", template: "{{ CHECKSUM | downcase }}" },
            expected: "{{ BODY | crc32_hex }}",
        },
        pattern: "(?xi)\n\\b\n(\n  zpka_(?P<body>[a-z0-9]{32})_(?P<checksum>[0-9a-f]{8})\n)\n",
    };

    it("keeps findings whose embedded checksum matches", async () => {
        expect.assertions(1);

        const findings = [
            sampleFinding({
                match: "zpka_3e6c4f7d39954ca29353b7ab88589b64_de26cd55",
                ruleId: "kingfisher.zuplo.1",
            }),
        ];
        const prepared = preparedScan(new Map([["kingfisher.zuplo.1", ZUPLO_RULE_META]]));
        const out = await postProcess(findings, prepared, undefined);

        expect(out).toHaveLength(1);
    });

    it("drops findings whose embedded checksum is wrong", async () => {
        expect.assertions(1);

        const findings = [
            sampleFinding({
                match: "zpka_3e6c4f7d39954ca29353b7ab88589b64_deadbeef",
                ruleId: "kingfisher.zuplo.1",
            }),
        ];
        const prepared = preparedScan(new Map([["kingfisher.zuplo.1", ZUPLO_RULE_META]]));
        const out = await postProcess(findings, prepared, undefined);

        expect(out).toHaveLength(0);
    });

    it("keeps findings when the checksum verdict is undefined (can't evaluate)", async () => {
        expect.assertions(1);

        // Pattern has no `body` / `checksum` named captures → template render
        // fails → verdict is undefined → conservative keep.
        const meta: RuleMeta = {
            ...ZUPLO_RULE_META,
            pattern: String.raw`(?xi)\b(zpka_[a-z0-9]{40})\b`,
        };
        const findings = [sampleFinding({ match: `zpka_${"a".repeat(40)}`, ruleId: "kingfisher.zuplo.1" })];
        const prepared = preparedScan(new Map([["kingfisher.zuplo.1", meta]]));
        const out = await postProcess(findings, prepared, undefined);

        expect(out).toHaveLength(1);
    });
});

describe("postProcess — validation", () => {
    const options = (config: NonNullable<ScanOptions["config"]>): ScanOptions => {
        return { config };
    };

    it("marks findings with no rule meta as validation:skipped when validate=true", async () => {
        expect.assertions(1);

        const findings = [sampleFinding({ ruleId: "no-meta" })];
        const out = await postProcess(findings, preparedScan(), options({ validate: true }));

        expect(out[0]?.validation).toBe("skipped");
    });

    it("skips validation and leaves `validation` untouched when validate=false", async () => {
        expect.assertions(1);

        const findings = [sampleFinding({ ruleId: "any" })];
        const out = await postProcess(findings, preparedScan(), undefined);

        // validate=false path — the finding passes through without a validation field.
        expect(out[0]?.validation).toBeUndefined();
    });

    it("marks dependent-rule findings as skipped when the dependency is absent in the same file", async () => {
        expect.assertions(1);

        const meta = new Map<string, RuleMeta>([
            [
                "kingfisher.aws.2",
                {
                    dependsOnRule: [{ rule_id: "kingfisher.aws.1", variable: "AKID" }],
                    validation: { content: { request: { url: "http://127.0.0.1:9/never" } }, type: "Http" },
                },
            ],
        ]);
        const findings = [sampleFinding({ ruleId: "kingfisher.aws.2" })];
        const out = await postProcess(findings, preparedScan(meta), options({ validate: true }));

        expect(out[0]?.validation).toBe("skipped");
    });
});

describe("postProcess — onlyVerified", () => {
    const options = (config: NonNullable<ScanOptions["config"]>): ScanOptions => {
        return { config };
    };

    it("filters to findings where validation === 'verified'", async () => {
        expect.assertions(1);

        // Simulate that validation already ran: we seed findings with pre-set
        // `validation` fields and turn off `validate` (so the pipeline doesn't
        // rewrite them). onlyVerified still applies.
        const findings = [
            sampleFinding({ ruleId: "a", validation: "verified" }),
            sampleFinding({ ruleId: "b", validation: "rejected" }),
            sampleFinding({ ruleId: "c", validation: "skipped" }),
        ];
        const out = await postProcess(findings, preparedScan(), options({ onlyVerified: true }));

        expect(out.map((f) => f.ruleId)).toStrictEqual(["a"]);
    });

    it("warns once and drops everything when `validate:false` and no findings have a pre-populated `validation`", async () => {
        expect.assertions(3);

        resetPipelineWarningsForTests();

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        // Simulate the footgun: user enabled onlyVerified but left validate off,
        // and the pipeline input hasn't been through any validator — so every
        // `finding.validation` is undefined.
        const findings = [sampleFinding({ ruleId: "a" }), sampleFinding({ ruleId: "b" })];

        const out1 = await postProcess(findings, preparedScan(), { config: { onlyVerified: true } });

        expect(out1).toHaveLength(0);
        expect(consoleError).toHaveBeenCalledTimes(1);

        // Subsequent calls in the same process must not duplicate the warning.
        await postProcess(findings, preparedScan(), { config: { onlyVerified: true } });

        expect(consoleError).toHaveBeenCalledTimes(1);

        consoleError.mockRestore();
    });

    it("does not filter when onlyVerified is false/undefined", async () => {
        expect.assertions(1);

        const findings = [sampleFinding({ ruleId: "a", validation: "rejected" }), sampleFinding({ ruleId: "b", validation: "verified" })];
        const out = await postProcess(findings, preparedScan(), undefined);

        expect(out).toHaveLength(2);
    });
});

describe("postProcess — heuristic filters", () => {
    it("drops findings in lock files by default", async () => {
        expect.assertions(1);

        const findings = [
            sampleFinding({ file: "packages/foo/yarn.lock", ruleId: "generic-api-key" }),
            sampleFinding({ file: "src/app.ts", ruleId: "generic-api-key" }),
        ];
        const out = await postProcess(findings, preparedScan(), undefined);

        expect(out.map((f) => f.file)).toStrictEqual(["src/app.ts"]);
    });

    it("drops findings whose secret looks like a UUID by default", async () => {
        expect.assertions(1);

        const findings = [
            sampleFinding({ ruleId: "a", secret: "123e4567-e89b-12d3-a456-426614174000" }),
            sampleFinding({ ruleId: "b", secret: "AKIAIOSFODNN7EXAMPLE" }),
        ];
        const out = await postProcess(findings, preparedScan(), undefined);

        expect(out.map((f) => f.ruleId)).toStrictEqual(["b"]);
    });

    it("drops sequential-string and non-alphanumeric secrets by default", async () => {
        expect.assertions(1);

        const findings = [
            sampleFinding({ ruleId: "seq", secret: "abcdefgh" }),
            sampleFinding({ ruleId: "mask", secret: "******" }),
            sampleFinding({ ruleId: "real", secret: "ghp_abcdef1234567890" }),
        ];
        const out = await postProcess(findings, preparedScan(), undefined);

        expect(out.map((f) => f.ruleId)).toStrictEqual(["real"]);
    });

    it("honours `heuristics.<name>: false` to disable individual heuristics", async () => {
        expect.assertions(1);

        const findings = [
            sampleFinding({ ruleId: "uuid", secret: "123e4567-e89b-12d3-a456-426614174000" }),
            sampleFinding({ ruleId: "real", secret: "ghp_abcdef1234567890" }),
        ];
        const out = await postProcess(findings, preparedScan(), {
            config: { heuristics: { potentialUuid: false } },
        });

        expect(out.map((f) => f.ruleId)).toStrictEqual(["uuid", "real"]);
    });

    it("retains lock-file findings when `heuristics.lockFile: false`", async () => {
        expect.assertions(1);

        const findings = [sampleFinding({ file: "packages/foo/yarn.lock", ruleId: "a" }), sampleFinding({ file: "pnpm-lock.yaml", ruleId: "b" })];
        const out = await postProcess(findings, preparedScan(), {
            config: { heuristics: { lockFile: false } },
        });

        expect(out.map((f) => f.ruleId)).toStrictEqual(["a", "b"]);
    });

    it("skips the heuristic stage entirely when every heuristic is disabled", async () => {
        expect.assertions(1);

        // With all four heuristics off, the early `return findings` fires and even
        // a UUID / lock-file / sequential / masked secret passes through untouched.
        const findings = [
            sampleFinding({ file: "yarn.lock", ruleId: "lock" }),
            sampleFinding({ ruleId: "uuid", secret: "123e4567-e89b-12d3-a456-426614174000" }),
            sampleFinding({ ruleId: "seq", secret: "abcdefgh" }),
            sampleFinding({ ruleId: "mask", secret: "******" }),
        ];
        const out = await postProcess(findings, preparedScan(), {
            config: {
                heuristics: { lockFile: false, notAlphanumericString: false, potentialUuid: false, sequentialString: false },
            },
        });

        expect(out.map((f) => f.ruleId)).toStrictEqual(["lock", "uuid", "seq", "mask"]);
    });

    it("drops a non-alphanumeric (masked) secret via the notAlphanumericString heuristic", async () => {
        expect.assertions(1);

        // Mixed symbols (not a single repeated char) slip past the sequential
        // heuristic but get dropped by notAlphanumericString.
        const findings = [sampleFinding({ ruleId: "mask", secret: "!@#$%^&*" }), sampleFinding({ ruleId: "real", secret: "ghp_abcdef1234567890" })];
        const out = await postProcess(findings, preparedScan(), undefined);

        expect(out.map((f) => f.ruleId)).toStrictEqual(["real"]);
    });
});

describe("postProcess — validation with resolved dependencies", () => {
    let server: Server;
    let url: string;
    let received: { akid?: string }[];

    beforeEach(async () => {
        received = [];
        server = createServer((request: IncomingMessage, response: ServerResponse) => {
            const akid = Array.isArray(request.headers["x-akid"]) ? request.headers["x-akid"][0] : request.headers["x-akid"];

            received.push({ akid });
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end('{"ok":true}');
        });

        await new Promise<void>((_resolve) => {
            server.listen(0, "127.0.0.1", _resolve);
        });

        const address = server.address() as AddressInfo;

        url = `http://127.0.0.1:${String(address.port)}`;
    });

    afterEach(async () => {
        await new Promise<void>((_resolve) => {
            server.close(() => {
                _resolve();
            });
        });
    });

    it("injects the dependency's secret as a template variable and validates", async () => {
        expect.assertions(2);

        const meta = new Map<string, RuleMeta>([
            [
                "kingfisher.aws.2",
                {
                    dependsOnRule: [{ ruleId: "kingfisher.aws.1", variable: "AKID" }],
                    validation: {
                        content: { request: { headers: { "X-Akid": "{{ AKID }}" }, response_matcher: [{ status: [200], type: "StatusMatch" }], url } },
                        type: "Http",
                    },
                },
            ],
        ]);

        // Both findings live in the same file so the dep resolver can pair them.
        const findings = [
            sampleFinding({ file: "creds.env", ruleId: "kingfisher.aws.1", secret: "AKIAIOSFODNN7EXAMPLE" }),
            sampleFinding({ file: "creds.env", ruleId: "kingfisher.aws.2", secret: "wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY" }),
        ];
        const out = await postProcess(findings, preparedScan(meta), { config: { validate: true } });

        const aws2 = out.find((f) => f.ruleId === "kingfisher.aws.2");

        expect(aws2?.validation).toBe("verified");
        // The dependency's secret landed in the outgoing request header.
        expect(received.some((r) => r.akid === "AKIAIOSFODNN7EXAMPLE")).toBe(true);
    });
});

describe("postProcess — suppressions", () => {
    it("drops findings whose content-hash or legacy fingerprint is in the baseline", async () => {
        expect.assertions(1);

        const suppressed = sampleFinding({ ruleId: "known-leak", secret: "old-value" });
        const fresh = sampleFinding({ ruleId: "fresh-leak" });
        const baselinePath = resolve(tmp, "baseline.json");

        await writeFile(baselinePath, JSON.stringify([suppressed]));

        const out = await postProcess([suppressed, fresh], preparedScan(), { baseline: baselinePath });

        expect(out.map((f) => f.ruleId)).toStrictEqual(["fresh-leak"]);
    });
});
