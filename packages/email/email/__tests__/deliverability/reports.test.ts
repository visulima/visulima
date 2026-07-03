import { describe, expect, it } from "vitest";

import { parseDmarcRecord, parseMtaStsPolicy, parseTlsReport, parseTlsRptRecord } from "../../src/deliverability";

describe("deliverability reports", () => {
    describe(parseDmarcRecord, () => {
        it("parses a full DMARC policy record", () => {
            expect.assertions(6);

            const record = parseDmarcRecord("v=DMARC1; p=reject; sp=quarantine; pct=50; rua=mailto:a@x.com,mailto:b@x.com; adkim=s");

            expect(record.valid).toBe(true);
            expect(record.policy).toBe("reject");
            expect(record.subdomainPolicy).toBe("quarantine");
            expect(record.percent).toBe(50);
            expect(record.rua).toStrictEqual(["mailto:a@x.com", "mailto:b@x.com"]);
            expect(record.adkim).toBe("s");
        });

        it("flags a non-DMARC record as invalid", () => {
            expect.assertions(1);
            expect(parseDmarcRecord("v=spf1 -all").valid).toBe(false);
        });

        it("drops unknown policy values instead of trusting them", () => {
            expect.assertions(2);

            const record = parseDmarcRecord("v=DMARC1; p=bogus; sp=alsobad");

            expect(record.policy).toBeUndefined();
            expect(record.subdomainPolicy).toBeUndefined();
        });
    });

    describe(parseMtaStsPolicy, () => {
        it("parses version, mode, repeated mx and max_age", () => {
            expect.assertions(4);

            const policy = parseMtaStsPolicy(["version: STSv1", "mode: enforce", "mx: mail.example.com", "mx: *.example.com", "max_age: 604800"].join("\n"));

            expect(policy.valid).toBe(true);
            expect(policy.mode).toBe("enforce");
            expect(policy.mx).toStrictEqual(["mail.example.com", "*.example.com"]);
            expect(policy.maxAge).toBe(604_800);
        });
    });

    describe(parseTlsRptRecord, () => {
        it("parses the rua endpoints", () => {
            expect.assertions(2);

            const record = parseTlsRptRecord("v=TLSRPTv1; rua=mailto:tlsrpt@example.com,https://example.com/tlsrpt");

            expect(record.valid).toBe(true);
            expect(record.rua).toStrictEqual(["mailto:tlsrpt@example.com", "https://example.com/tlsrpt"]);
        });
    });

    describe(parseTlsReport, () => {
        it("aggregates session counts across policies from a JSON string", () => {
            expect.assertions(3);

            const json = JSON.stringify({
                "date-range": { "end-datetime": "2026-06-02T23:59:59Z", "start-datetime": "2026-06-02T00:00:00Z" },
                "organization-name": "Example Inc",
                policies: [
                    { summary: { "total-failure-session-count": 2, "total-successful-session-count": 10 } },
                    { summary: { "total-failure-session-count": 1, "total-successful-session-count": 5 } },
                ],
                "report-id": "report-1",
            });

            const report = parseTlsReport(json);

            expect(report.totalSuccessful).toBe(15);
            expect(report.totalFailure).toBe(3);
            expect(report.organizationName).toBe("Example Inc");
        });
    });
});
