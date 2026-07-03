import { describe, expect, it } from "vitest";

import { parseName } from "../src/enrich/name";
import { classifyMx, classifyMxRecords } from "../src/enrich/provider";
import { sift3Distance, suggestDomain, suggestEmailTypo } from "../src/enrich/typo";

describe(suggestEmailTypo, () => {
    it.each([
        ["user@gmial.com", "user@gmail.com"],
        ["user@gmai.com", "user@gmail.com"],
        ["user@hotmial.com", "user@hotmail.com"],
        ["user@yahooo.com", "user@yahoo.com"],
    ])("suggests a correction for %s", (email, expected) => {
        expect.assertions(1);

        expect(suggestEmailTypo(email)?.full).toBe(expected);
    });

    it("returns undefined for a correct popular domain", () => {
        expect.assertions(1);

        expect(suggestEmailTypo("user@gmail.com")).toBeUndefined();
    });

    it("returns undefined for an unrelated custom domain", () => {
        expect.assertions(1);

        expect(suggestEmailTypo("user@some-unrelated-company.com")).toBeUndefined();
    });
});

describe(suggestDomain, () => {
    it("corrects a misspelled tld via second-level matching", () => {
        expect.assertions(1);

        expect(suggestDomain("gmail.con")).toBe("gmail.com");
    });
});

describe(sift3Distance, () => {
    it("is zero for identical strings", () => {
        expect.assertions(1);

        expect(sift3Distance("gmail", "gmail")).toBe(0);
    });

    it("grows with difference", () => {
        expect.assertions(1);

        expect(sift3Distance("gmail", "gmial")).toBeGreaterThan(0);
    });
});

describe(parseName, () => {
    it("parses separator-delimited names with high confidence", () => {
        expect.assertions(1);

        expect(parseName("john.doe@example.com")).toStrictEqual({
            confidence: "high",
            firstName: "John",
            fullName: "John Doe",
            lastName: "Doe",
        });
    });

    it("parses camelCase names with medium confidence", () => {
        expect.assertions(1);

        expect(parseName("johnDoe@example.com")).toStrictEqual({
            confidence: "medium",
            firstName: "John",
            fullName: "John Doe",
            lastName: "Doe",
        });
    });

    it("strips trailing digits", () => {
        expect.assertions(1);

        expect(parseName("jane.smith42@example.com").fullName).toBe("Jane Smith");
    });

    it("returns low confidence for a single opaque token", () => {
        expect.assertions(2);

        const result = parseName("john@example.com");

        expect(result.confidence).toBe("low");
        expect(result.firstName).toBe("John");
    });

    it("returns none for a digit-only local part", () => {
        expect.assertions(1);

        expect(parseName("12345@example.com").confidence).toBe("none");
    });
});

describe(classifyMx, () => {
    it("classifies Google MX hosts", () => {
        expect.assertions(1);

        expect(classifyMx("aspmx.l.google.com")?.provider).toBe("google");
    });

    it("returns undefined for unknown hosts", () => {
        expect.assertions(1);

        expect(classifyMx("mail.some-unknown-host.example")).toBeUndefined();
    });
});

describe(classifyMxRecords, () => {
    it("picks the provider from the highest-priority record", () => {
        expect.assertions(1);

        const info = classifyMxRecords([
            { exchange: "alt.aspmx.l.google.com", priority: 20 },
            { exchange: "aspmx.l.google.com", priority: 10 },
        ]);

        expect(info?.provider).toBe("google");
    });
});
