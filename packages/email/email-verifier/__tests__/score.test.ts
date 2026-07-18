import { describe, expect, it } from "vitest";

import type { ScoreInput } from "../src/score";
import { DEFAULT_WEIGHTS, scoreReport } from "../src/score";

const baseInput = (overrides: Partial<ScoreInput> = {}): ScoreInput => {
    return {
        acceptAll: false,
        character: { digitRatio: 0, irregular: false, length: 4, reasons: [] },
        deferred: false,
        disposable: false,
        domain: { records: [{ exchange: "mx.example.com", priority: 10 }], resolvedVia: "mx", valid: true },
        email: "user@example.com",
        free: false,
        mailboxFull: false,
        name: { confidence: "none" },
        noReply: false,
        role: false,
        secureEmailGateway: false,
        smtp: { valid: true },
        symbol: { hasMixedScripts: false, hasNonAscii: false, hasSymbols: false, scripts: ["Latin"] },
        syntaxValid: true,
        tag: { baseLocalPart: "user", hasTag: false },
        ...overrides,
    };
};

describe("scoreReport state derivation", () => {
    it("returns undeliverable + 0 for invalid syntax", () => {
        expect.assertions(3);

        const result = scoreReport(baseInput({ syntaxValid: false }));

        expect(result.state).toBe("undeliverable");
        expect(result.score).toBe(0);
        expect(result.reason).toBe("invalid_syntax");
    });

    it("returns undeliverable for no MX", () => {
        expect.assertions(2);

        const result = scoreReport(baseInput({ domain: { records: [], resolvedVia: "none", valid: false }, smtp: undefined }));

        expect(result.state).toBe("undeliverable");
        expect(result.reason).toBe("no_mx_records");
    });

    it("treats a transient DNS failure as unknown, not undeliverable", () => {
        expect.assertions(3);

        const result = scoreReport(baseInput({ domain: { deferred: true, records: [], resolvedVia: "none", valid: false }, smtp: undefined }));

        expect(result.state).toBe("unknown");
        expect(result.reason).toBe("dns_error");
        expect(result.score).toBeGreaterThan(0);
    });

    it("returns deliverable for an accepted mailbox", () => {
        expect.assertions(3);

        const result = scoreReport(baseInput());

        expect(result.state).toBe("deliverable");
        expect(result.reason).toBe("accepted_email");
        expect(result.score).toBe(100);
    });

    it("downgrades an accepted catch-all to risky", () => {
        expect.assertions(3);

        const result = scoreReport(baseInput({ acceptAll: true }));

        expect(result.state).toBe("risky");
        expect(result.reason).toBe("accept_all");
        expect(result.score).toBe(100 - DEFAULT_WEIGHTS.acceptAll);
    });

    it("treats a permanent 5xx rejection as undeliverable", () => {
        expect.assertions(2);

        const result = scoreReport(baseInput({ smtp: { code: 550, valid: false } }));

        expect(result.state).toBe("undeliverable");
        expect(result.reason).toBe("rejected_email");
    });

    it("treats a greylisted (4xx) response as unknown", () => {
        expect.assertions(2);

        const result = scoreReport(baseInput({ smtp: { code: 451, deferred: true, valid: false } }));

        expect(result.state).toBe("unknown");
        expect(result.reason).toBe("greylisted");
    });

    it("reports smtp_not_checked when SMTP was skipped", () => {
        expect.assertions(2);

        const result = scoreReport(baseInput({ domain: { records: [], resolvedVia: "unchecked", valid: false }, smtp: undefined }));

        expect(result.state).toBe("unknown");
        expect(result.reason).toBe("smtp_not_checked");
    });
});

describe("scoreReport weighting", () => {
    it("applies the disposable penalty", () => {
        expect.assertions(1);

        const result = scoreReport(baseInput({ disposable: true }));

        expect(result.score).toBe(100 - DEFAULT_WEIGHTS.disposable);
    });

    it("respects weight overrides", () => {
        expect.assertions(1);

        const result = scoreReport(baseInput({ free: true }), { free: 0 });

        expect(result.score).toBe(100);
    });

    it("never drops below zero", () => {
        expect.assertions(1);

        const result = scoreReport(
            baseInput({
                acceptAll: true,
                character: { digitRatio: 1, irregular: true, length: 30, reasons: ["x"] },
                disposable: true,
                mailboxFull: true,
                role: true,
            }),
        );

        expect(result.score).toBeGreaterThanOrEqual(0);
    });
});
