import { describe, expect, it } from "vitest";

import { classifyMx, classifyMxRecords, isSecureEmailGateway } from "../src/index";

describe(classifyMx, () => {
    it("classifies Google Workspace MX hosts as mailbox", () => {
        expect.assertions(2);

        const info = classifyMx("aspmx.l.google.com");

        expect(info).toStrictEqual({ display: "Google Workspace", provider: "google", type: "mailbox" });
        expect(classifyMx("alt1.aspmx.l.google.com")?.provider).toBe("google");
    });

    it("classifies Microsoft 365 MX hosts as mailbox", () => {
        expect.assertions(2);

        const info = classifyMx("contoso.mail.protection.outlook.com");

        expect(info?.provider).toBe("microsoft");
        expect(info?.type).toBe("mailbox");
    });

    it("classifies Proofpoint MX hosts as a secure email gateway", () => {
        expect.assertions(2);

        const info = classifyMx("mx0a-00000000.pphosted.com");

        expect(info).toStrictEqual({ display: "Proofpoint", provider: "proofpoint", type: "seg" });
        expect(isSecureEmailGateway("mx0a-00000000.pphosted.com")).toBe(true);
    });

    it("normalizes case and a trailing dot before matching", () => {
        expect.assertions(2);

        expect(classifyMx("ASPMX.L.GOOGLE.COM")?.provider).toBe("google");
        expect(classifyMx("aspmx.l.google.com.")?.provider).toBe("google");
    });

    it("matches on a dot boundary only (no substring/suffix collisions)", () => {
        expect.assertions(2);

        // `notgoogle.com` shares the trailing `google.com` characters but is not
        // a subdomain of it, so it must not classify as Google.
        expect(classifyMx("notgoogle.com")).toBeUndefined();
        expect(classifyMx("mail.example.com")).toBeUndefined();
    });

    it("returns undefined for empty or non-string input", () => {
        expect.assertions(3);

        expect(classifyMx("")).toBeUndefined();
        // @ts-expect-error - testing runtime guard
        expect(classifyMx(undefined)).toBeUndefined();
        // @ts-expect-error - testing runtime guard
        expect(classifyMx(null)).toBeUndefined(); // eslint-disable-line unicorn/no-null -- exercising the null runtime guard
    });
});

describe(classifyMxRecords, () => {
    it("returns the provider of the primary (lowest-priority) recognized record", () => {
        expect.assertions(1);

        const info = classifyMxRecords([
            { exchange: "alt1.aspmx.l.google.com", priority: 20 },
            { exchange: "aspmx.l.google.com", priority: 10 },
        ]);

        expect(info?.provider).toBe("google");
    });

    it("surfaces a SEG fronting a mailbox host (SEG is the primary MX)", () => {
        expect.assertions(2);

        const info = classifyMxRecords([
            { exchange: "alt.aspmx.l.google.com", priority: 20 },
            { exchange: "mx0a-00000000.pphosted.com", priority: 10 },
        ]);

        expect(info?.provider).toBe("proofpoint");
        expect(info?.type).toBe("seg");
    });

    it("skips unknown records and classifies the first recognized one", () => {
        expect.assertions(1);

        const info = classifyMxRecords([
            { exchange: "mail.unknown-host.example", priority: 5 },
            { exchange: "mx00.gmx.net", priority: 10 },
        ]);

        expect(info?.provider).toBe("gmx");
    });

    it("returns undefined for an empty or fully-unknown record set", () => {
        expect.assertions(2);

        expect(classifyMxRecords([])).toBeUndefined();
        expect(classifyMxRecords([{ exchange: "mail.unknown-host.example", priority: 10 }])).toBeUndefined();
    });
});

describe(isSecureEmailGateway, () => {
    it("is true for SEG hosts and false for mailbox/unknown hosts", () => {
        expect.assertions(3);

        expect(isSecureEmailGateway("eu-smtp-inbound-1.mimecast.com")).toBe(true);
        expect(isSecureEmailGateway("aspmx.l.google.com")).toBe(false);
        expect(isSecureEmailGateway("mail.example.com")).toBe(false);
    });
});
