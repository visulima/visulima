import { describe, expect, it } from "vitest";

import { classifyMx, classifyMxRecords, isSecureEmailGateway, MX_PROVIDERS } from "../src/index";

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

    it("classifies consumer Outlook.com/Hotmail (olc.protection.outlook.com) as free, not Microsoft 365", () => {
        expect.assertions(4);

        // The consumer Outlook Live tier is distinct from the business M365 host
        // and must classify as free webmail, not a business mailbox.
        expect(classifyMx("hotmail-com.olc.protection.outlook.com")).toStrictEqual({
            display: "Outlook.com",
            provider: "outlook",
            type: "free",
        });
        expect(classifyMx("outlook-com.olc.protection.outlook.com")?.type).toBe("free");

        // The business tenant host on the same infrastructure stays a mailbox.
        expect(classifyMx("tenant.mail.protection.outlook.com")?.provider).toBe("microsoft");
        expect(classifyMx("tenant.mail.protection.outlook.com")?.type).toBe("mailbox");
    });

    it("classifies Proofpoint MX hosts as a secure email gateway", () => {
        expect.assertions(2);

        const info = classifyMx("mx0a-00000000.pphosted.com");

        expect(info).toStrictEqual({ display: "Proofpoint", provider: "proofpoint", type: "seg" });
        expect(isSecureEmailGateway("mx0a-00000000.pphosted.com")).toBe(true);
    });

    it("classifies SEG product MX hosts but not bare corporate domains", () => {
        expect.assertions(10);

        // Real product MX suffixes still classify as the gateway.
        expect(classifyMx("mx1.ess.barracudanetworks.com")?.provider).toBe("barracuda");
        expect(classifyMx("a1234.cudasvc.com")?.provider).toBe("barracuda");
        expect(classifyMx("mx1.iphmx.com")?.provider).toBe("cisco");
        expect(classifyMx("in.tmes.trendmicro.com")?.provider).toBe("trendmicro");
        expect(classifyMx("in.hes.trendmicro.com")?.provider).toBe("trendmicro");
        expect(classifyMx("mx-01-eu-west.prod.hydra.sophos.com")?.provider).toBe("sophos");

        // Bare corporate domains are NOT the email-security product MX and must not
        // be mis-classified as a secure email gateway.
        expect(classifyMx("mail.barracuda.com")).toBeUndefined();
        expect(classifyMx("mail.cisco.com")).toBeUndefined();
        expect(classifyMx("mail.trendmicro.com")).toBeUndefined();
        expect(classifyMx("mail.sophos.com")).toBeUndefined();
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

describe("MX_PROVIDERS", () => {
    it("is deep-frozen so the exported dataset cannot be mutated", () => {
        expect.assertions(3);

        expect(Object.isFrozen(MX_PROVIDERS)).toBe(true);
        expect(Object.isFrozen(MX_PROVIDERS[0])).toBe(true);
        expect(Object.isFrozen(MX_PROVIDERS[0]?.patterns)).toBe(true);
    });

    it("throws in strict mode when a caller tries to push a new entry", () => {
        expect.assertions(1);

        const mutable = MX_PROVIDERS as { push: (value: unknown) => void };

        expect(() => {
            mutable.push({});
        }).toThrow(TypeError);
    });
});
