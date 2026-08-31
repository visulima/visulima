/**
 * Tests are copied from https://github.com/nitaiaharoni1/anonymize-nlp/blob/master/src/AnonymizeNlp.spec.ts
 * The MIT License (MIT)
 *
 * Copyright (c) 2023 Nitai Aharoni
 */

import { describe, expect, it } from "vitest";

import { compromiseScanner } from "../../src/nlp";
import standardModifierRules, { piiRules } from "../../src/rules";
import stringAnonymize from "../../src/string-anonymizer";
import type { RedactOptions, Rules } from "../../src/types";

// Natural-language detection is opt-in, so every test below that asserts on a
// name/organization/money mask injects the compromise scanner explicitly. Tests that assert on
// the DEFAULT (no-scanner) behaviour call `stringAnonymize` directly instead.
const anonymizeWithNlp = (input: string, rules: Rules, options?: RedactOptions): string =>
    stringAnonymize(input, rules, { nlp: compromiseScanner, ...options });

describe(stringAnonymize, () => {
    it("should anonymize a string", () => {
        expect.assertions(1);

        const input = "John Doe will be 30 on 2024-06-10.";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
    });

    it("should anonymize multiple names", () => {
        expect.assertions(1);

        const input = "John Doe and Jane Smith will meet on 2024-06-10.";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> <LASTNAME> and <FIRSTNAME1> <LASTNAME1> will meet on <DATE>");
    });

    it("should anonymize organization names", () => {
        expect.assertions(1);

        const input = "John Doe works at Google.";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> <LASTNAME> works at <ORGANIZATION>");
    });

    it("should anonymize email addresses", () => {
        expect.assertions(1);

        const input = "John's email is john.doe@gmail.com";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> email is <EMAIL>");
    });

    it("should anonymize phone numbers", () => {
        expect.assertions(1);

        const input = "John's phone number is 123-456-7890";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> phone number is <PHONENUMBER>");
    });

    it("should anonymize money-related strings", () => {
        expect.assertions(1);

        const input = "John has $1000 in his account.";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> has <MONEY> in his account.");
    });

    describe("without a scanner", () => {
        it("should still apply every pattern rule", () => {
            expect.assertions(1);

            // The positive half of the v5 default: dropping the NLP import must not weaken
            // regex-backed redaction. Cards, SSNs, emails and dates all still go.
            const input = "card 4111-1111-1111-1111, ssn 123-45-6789, mail bob@example.com on 2024-06-10";
            const result = stringAnonymize(input, standardModifierRules);

            expect(result).toBe("card <CREDITCARD>, ssn <SSN>, mail <EMAIL> on <DATE>");
        });

        it("should leave the four pattern-less entity keys unmatched in prose", () => {
            expect.assertions(2);

            // The negative half: these four have no regex shape, so without a scanner they find
            // nothing inside prose. They still match object keys — covered in index.test.ts.
            const input = "John Doe works at Google earning $50,000";
            const entityKeys = ["firstname", "lastname", "organization", "money"];

            expect(stringAnonymize(input, entityKeys)).toBe(input);
            expect(anonymizeWithNlp(input, entityKeys)).toBe("<FIRSTNAME> <LASTNAME> works at <ORGANIZATION> earning <MONEY>");
        });

        it("should mask an email as <EMAIL> rather than under a neighbouring pattern's tag", () => {
            expect.assertions(2);

            // Regression: `email` was a key-only rule, so with no scanner an address in prose
            // escaped a narrowed rule set entirely, and under standardRules was caught only
            // incidentally by the `url` pattern and mislabelled <URL>. The `email` rule is
            // declared ahead of `domain`/`url` precisely so it wins that tie.
            expect(stringAnonymize("write to alice@example.com today", piiRules)).toBe("write to <EMAIL> today");

            // ...and still wins with the patterns that used to shadow it explicitly dropped,
            // which is the rule set a caller following the piiRules warnings would build.
            expect(stringAnonymize("write to alice@example.com today", piiRules, { exclude: ["url", "domain"] })).toBe("write to <EMAIL> today");
        });
    });

    it("should handle empty input string", () => {
        expect.assertions(1);

        const input = "";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe("");
    });

    it("should handle multiple matches of the same type", () => {
        expect.assertions(1);

        const input = "John Doe has phone numbers 123-456-7890 and 098-765-4321";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> <LASTNAME> has phone numbers <PHONENUMBER> and <PHONENUMBER1>");
    });

    it("should anonymize times", () => {
        expect.assertions(1);

        const input = "John's meeting is at 3pm.";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> meeting is at <TIME>");
    });

    it("should anonymize credit card numbers", () => {
        expect.assertions(1);

        const input = "John's credit card number is 4111-1111-1111-1111";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> credit card number is <CREDITCARD>");
    });

    it("should anonymize multiple credit card numbers", () => {
        expect.assertions(1);

        const input = "John's credit card numbers are 4111-1111-1111-1111 and 5500-0000-0000-0004";
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> credit card numbers are <CREDITCARD> and <CREDITCARD1>");
    });

    it("should test long paragraph", () => {
        expect.assertions(1);

        const input = `My name is Jessica Thompson, and I was born on May 12, 1988, in a small town called Oakdale. I grew up with my parents and two siblings, an older brother named Daniel and a younger sister named Emily. We lived in a cozy two-story house with a white picket fence. In high school, I was actively involved in the drama club and played the lead role in our school's production of "Romeo and Juliet." After graduation, I pursued my passion for writing and earned a Bachelor's degree in English Literature from the University of Cambridge in 2010. Currently, I work as a freelance writer, specializing in content creation for various online platforms.
If you'd like to reach me, you can email me at johndoe1985@example.com or give me a call at +1 (555) 123-4567.
Please note that the credit card number provided, 4916 2899 5678 1234, is purely fictional and should not be used for any actual transactions or financial purposes.
In my free time, I enjoy hiking, painting, and playing the guitar. I'm also an avid traveler and have visited over 20 countries, each leaving a unique mark on my adventurous soul.
Please remember that all the information provided, including the credit card number, email address, and phone number, is entirely fictional and randomly generated. It does not represent any real individuals or their personal experiences.`;
        const result = anonymizeWithNlp(input, standardModifierRules, {
            exclude: ["organization"],
        });

        expect(result).toBe(
            `My name is <FIRSTNAME> <LASTNAME>, and I was born on <DATE>, in a small town called Oakdale. I grew up with my parents and two siblings, an older brother named <FIRSTNAME1> and a younger sister named <FIRSTNAME2>. We lived in a cozy two-story house with a white picket fence. In high school, I was actively involved in the drama club and played the lead role in our school's production of "<FIRSTNAME3> and <FIRSTNAME4>." <LASTNAME1> graduation, I pursued my passion for writing and earned a Bachelor's degree in English Literature from the University of Cambridge in <DATE3>. Currently, I work as a freelance writer, specializing in content creation for various online platforms.
If you'd like to reach me, you can email me at <EMAIL> or give me a call at +1 (<PHONENUMBER2>) <DATE1>3-4567.
Please note that the credit card number provided, <CREDITCARD>, is purely fictional and should not be used for any actual transactions or financial purposes.
In my free time, I enjoy hiking, painting, and playing the guitar. I'm also an avid traveler and have visited over 20 countries, each leaving a unique <FIRSTNAME5> on my adventurous soul.
Please remember that all the information provided, including the credit card number, email address, and phone number, is entirely fictional and randomly generated. It does not represent any real individuals or their personal experiences.`,
        );
    });

    it("should anonymize email and phone number", () => {
        expect.assertions(1);

        const input = `Hi i'm John Doe, my email is john@example.com and my phone number is +1-234-567-8900.`;
        const result = anonymizeWithNlp(input, standardModifierRules);

        expect(result).toBe(`Hi i'm <FIRSTNAME> <LASTNAME>, my email is <EMAIL> and my phone number is <PHONENUMBER>.`);
    });

    it("should exclude a rule from the rules list", () => {
        expect.assertions(1);

        const input = "John Doe will be 30 on 2024-06-10.";
        const result = anonymizeWithNlp(input, standardModifierRules, { exclude: ["firstname"] });

        expect(result).toMatch("John <LASTNAME> will be 30 on <DATE>");
    });

    it("should accept numeric modifiers without altering unmatched text", () => {
        expect.assertions(1);

        const input = "hello 30 world";
        const result = stringAnonymize(input, [30]);

        expect(result).toBe("hello 30 world");
    });

    it("should skip numeric modifiers that are excluded", () => {
        expect.assertions(1);

        const input = "hello 30 world";
        const result = stringAnonymize(input, [30], { exclude: [30] });

        expect(result).toBe("hello 30 world");
    });

    it("should keep applying string modifiers that are not in the exclude list", () => {
        expect.assertions(1);

        const input = "John Doe will be 30 on 2024-06-10.";
        const result = anonymizeWithNlp(input, ["firstname"], { exclude: ["password"] });

        expect(result).toMatch("<FIRSTNAME> Doe will be 30 on 2024-06-10.");
    });

    it("should reuse the same mask for a repeated value and only advance the number for a distinct one", () => {
        expect.assertions(1);

        const input = "call 111-11-1111 then 111-11-1111 then 222-22-2222";
        const result = stringAnonymize(input, [{ key: "ssn", pattern: String.raw`\d{3}-\d{2}-\d{4}` }]);

        expect(result).toBe("call <SSN> then <SSN> then <SSN1>");
    });

    it("should honour a static replacement supplied directly to the exported stringAnonymize", () => {
        expect.assertions(1);

        const result = stringAnonymize("id 123", [{ key: "num", pattern: String.raw`\d+`, replacement: "XXX" }]);

        expect(result).toBe("id XXX");
    });

    it("should honour a censor replacement supplied directly to the exported stringAnonymize", () => {
        expect.assertions(1);

        const result = stringAnonymize("id 123", [{ key: "num", pattern: String.raw`\d+`, replacement: (value) => `[${String(value)}]` }]);

        expect(result).toBe("id [123]");
    });
});
