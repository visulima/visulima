import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("../src/checks/mx"), () => {
    return {
        checkMxRecords: vi.fn<
            () => Promise<{ domainResolves: boolean; records: { exchange: string; priority: number }[]; resolvedVia: string; valid: boolean }>
        >(() =>
            Promise.resolve({
                domainResolves: true,
                records: [{ exchange: "aspmx.l.google.com", priority: 10 }],
                resolvedVia: "mx",
                valid: true,
            }),
        ),
    };
});

vi.mock(import("../src/checks/smtp"), () => {
    return {
        verifySmtp: vi.fn<() => Promise<{ acceptAll: boolean; code: number; valid: boolean }>>(() =>
            Promise.resolve({ acceptAll: false, code: 250, valid: true }),
        ),
    };
});

// eslint-disable-next-line import/first
import { checkMxRecords } from "../src/checks/mx";
// eslint-disable-next-line import/first
import { verifySmtp } from "../src/checks/smtp";
// eslint-disable-next-line import/first
import { verifyEmail } from "../src/verify-email";

describe("verifyEmail (online)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("classifies the provider and probes SMTP from a single MX resolution", async () => {
        expect.assertions(7);

        const report = await verifyEmail("john.doe@gmail.com");

        // Provider classification runs off the resolved records (real classifier).
        expect(report.provider?.provider).toBe("google");
        expect(report.secureEmailGateway).toBe(false);
        expect(report.smtp?.valid).toBe(true);
        expect(report.domain.valid).toBe(true);

        // The domain is resolved exactly once — provider classification reuses the
        // same records and the SMTP probe is handed them rather than re-resolving.
        expect(checkMxRecords).toHaveBeenCalledTimes(1);
        expect(verifySmtp).toHaveBeenCalledTimes(1);
        expect(vi.mocked(verifySmtp).mock.calls[0]?.[1]).toMatchObject({
            mxRecords: [{ exchange: "aspmx.l.google.com", priority: 10 }],
        });
    });

    it("skips the SMTP probe when checkSmtp is false but still classifies the provider", async () => {
        expect.assertions(4);

        const report = await verifyEmail("john.doe@gmail.com", { checkSmtp: false });

        expect(report.provider?.provider).toBe("google");
        expect(report.smtp).toBeUndefined();
        expect(verifySmtp).not.toHaveBeenCalled();
        expect(checkMxRecords).toHaveBeenCalledTimes(1);
    });
});

describe("verifyEmail (offline)", () => {
    it("produces an unknown state with a high score for a clean free address", async () => {
        expect.assertions(6);

        const report = await verifyEmail("john.doe@gmail.com", { offline: true });

        expect(report.syntaxValid).toBe(true);
        expect(report.free).toBe(true);
        expect(report.state).toBe("unknown");
        expect(report.reason).toBe("smtp_not_checked");
        expect(report.name.fullName).toBe("John Doe");
        expect(report.score).toBeGreaterThan(70);
    });

    it("marks a disposable address as risky", async () => {
        expect.assertions(3);

        const report = await verifyEmail("foo@mailinator.com", { offline: true });

        expect(report.disposable).toBe(true);
        expect(report.state).toBe("risky");
        expect(report.reason).toBe("disposable_mailbox");
    });

    it("marks an invalid-syntax address as undeliverable with score 0", async () => {
        expect.assertions(4);

        const report = await verifyEmail("not-an-email", { offline: true });

        expect(report.syntaxValid).toBe(false);
        expect(report.state).toBe("undeliverable");
        expect(report.reason).toBe("invalid_syntax");
        expect(report.score).toBe(0);
    });

    it("normalizes the email and surfaces tag + role flags", async () => {
        expect.assertions(3);

        // eslint-disable-next-line no-secrets/no-secrets -- a sample mixed-case tagged address, not a credential
        const report = await verifyEmail("Info+News@Example.com", { offline: true });

        expect(report.email).toBe("info+news@example.com");
        expect(report.tag.hasTag).toBe(true);
        expect(report.role).toBe(true);
    });

    it("surfaces a typo suggestion via didYouMean", async () => {
        expect.assertions(1);

        const report = await verifyEmail("user@gmial.com", { offline: true });

        expect(report.didYouMean).toBe("user@gmail.com");
    });

    it("does not run network checks in offline mode (domain unchecked)", async () => {
        expect.assertions(2);

        const report = await verifyEmail("john.doe@gmail.com", { offline: true });

        expect(report.domain.resolvedVia).toBe("unchecked");
        expect(report.smtp).toBeUndefined();
    });
});
