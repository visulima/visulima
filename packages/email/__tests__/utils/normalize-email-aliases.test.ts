import { describe, expect, it } from "vitest";

import normalizeEmailAliases from "../../src/utils/normalize-email-aliases";

describe(normalizeEmailAliases, () => {
    it("should normalize Gmail aliases by removing dots and plus aliases", () => {
        expect.assertions(4);
        expect(normalizeEmailAliases("example+test@gmail.com")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("ex.ample@gmail.com")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("ex.ample+test@gmail.com")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("example@gmail.com")).toBe("example@gmail.com");
    });

    it("should normalize Yahoo aliases by removing plus aliases only", () => {
        expect.assertions(3);
        expect(normalizeEmailAliases("user+tag@yahoo.com")).toBe("user@yahoo.com");
        expect(normalizeEmailAliases("user.name@yahoo.com")).toBe("user.name@yahoo.com");
        expect(normalizeEmailAliases("user@yahoo.com")).toBe("user@yahoo.com");
    });

    it("should normalize Microsoft email aliases (Outlook, Hotmail, Live, MSN)", () => {
        expect.assertions(8);
        expect(normalizeEmailAliases("user+tag@outlook.com")).toBe("user@outlook.com");
        expect(normalizeEmailAliases("user.name@outlook.com")).toBe("user.name@outlook.com");
        expect(normalizeEmailAliases("user+tag@hotmail.com")).toBe("user@hotmail.com");
        expect(normalizeEmailAliases("user+tag@live.com")).toBe("user@live.com");
        expect(normalizeEmailAliases("user+tag@msn.com")).toBe("user@msn.com");
        expect(normalizeEmailAliases("user.name@hotmail.com")).toBe("user.name@hotmail.com");
        expect(normalizeEmailAliases("user.name@live.com")).toBe("user.name@live.com");
        expect(normalizeEmailAliases("user.name@msn.com")).toBe("user.name@msn.com");
    });

    it("should normalize iCloud, ProtonMail, and Zoho aliases", () => {
        expect.assertions(6);
        expect(normalizeEmailAliases("user+tag@icloud.com")).toBe("user@icloud.com");
        expect(normalizeEmailAliases("user.name@icloud.com")).toBe("user.name@icloud.com");
        expect(normalizeEmailAliases("user+tag@protonmail.com")).toBe("user@protonmail.com");
        expect(normalizeEmailAliases("user.name@protonmail.com")).toBe("user.name@protonmail.com");
        expect(normalizeEmailAliases("user+tag@zoho.com")).toBe("user@zoho.com");
        expect(normalizeEmailAliases("user.name@zoho.com")).toBe("user.name@zoho.com");
    });

    it("should normalize FastMail, Mail.com, and GMX aliases", () => {
        expect.assertions(9);
        expect(normalizeEmailAliases("user+tag@fastmail.com")).toBe("user@fastmail.com");
        expect(normalizeEmailAliases("user.name@fastmail.com")).toBe("user.name@fastmail.com");
        expect(normalizeEmailAliases("user+tag@mail.com")).toBe("user@mail.com");
        expect(normalizeEmailAliases("user.name@mail.com")).toBe("user.name@mail.com");
        expect(normalizeEmailAliases("user+tag@gmx.com")).toBe("user@gmx.com");
        expect(normalizeEmailAliases("user+tag@gmx.de")).toBe("user@gmx.de");
        expect(normalizeEmailAliases("user+tag@gmx.net")).toBe("user@gmx.net");
        expect(normalizeEmailAliases("user.name@gmx.com")).toBe("user.name@gmx.com");
        expect(normalizeEmailAliases("user.name@gmx.de")).toBe("user.name@gmx.de");
    });

    it("should return unchanged email for unsupported domains", () => {
        expect.assertions(3);
        expect(normalizeEmailAliases("user@example.com")).toBe("user@example.com");
        expect(normalizeEmailAliases("user+tag@example.com")).toBe("user+tag@example.com");
        expect(normalizeEmailAliases("user.name@example.com")).toBe("user.name@example.com");
    });

    it("should handle case-insensitive domains", () => {
        expect.assertions(3);
        expect(normalizeEmailAliases("EXAMPLE+TEST@GMAIL.COM")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("User+Tag@Yahoo.COM")).toBe("user@yahoo.com");
        expect(normalizeEmailAliases("USER@OUTLOOK.COM")).toBe("user@outlook.com");
    });

    it("should handle invalid email formats", () => {
        expect.assertions(5);
        expect(normalizeEmailAliases("")).toBe("");
        expect(normalizeEmailAliases("invalid")).toBe("invalid");
        expect(normalizeEmailAliases("@gmail.com")).toBe("@gmail.com");
        expect(normalizeEmailAliases("user@")).toBe("user@");
        expect(normalizeEmailAliases("user@gmail")).toBe("user@gmail");
    });

    it("should handle whitespace", () => {
        expect.assertions(2);
        expect(normalizeEmailAliases("  example+test@gmail.com  ")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("\texample+test@gmail.com\n")).toBe("example@gmail.com");
    });

    it("should handle multiple plus signs in Gmail", () => {
        expect.assertions(2);
        expect(normalizeEmailAliases("example+test+more@gmail.com")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("example++test@gmail.com")).toBe("example@gmail.com");
    });

    it("should handle multiple dots in Gmail", () => {
        expect.assertions(2);
        expect(normalizeEmailAliases("ex.am.ple@gmail.com")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("e.x.a.m.p.l.e@gmail.com")).toBe("example@gmail.com");
    });

    it("should handle complex Gmail aliases", () => {
        expect.assertions(2);
        expect(normalizeEmailAliases("ex.am.ple+test.tag@gmail.com")).toBe("example@gmail.com");
        expect(normalizeEmailAliases("first.last+middle@gmail.com")).toBe("firstlast@gmail.com");
    });
});

