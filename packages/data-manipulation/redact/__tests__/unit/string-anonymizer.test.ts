/**
 * Tests are copied from https://github.com/nitaiaharoni1/anonymize-nlp/blob/master/src/AnonymizeNlp.spec.ts
 * The MIT License (MIT)
 *
 * Copyright (c) 2023 Nitai Aharoni
 */

import { describe, expect, it } from "vitest";

import standardModifierRules from "../../src/rules";
import stringAnonymize from "../../src/string-anonymizer";

describe(stringAnonymize, () => {
    it("should anonymize a string", () => {
        expect.assertions(1);

        const input = "John Doe will be 30 on 2024-06-10.";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
    });

    it("should anonymize multiple names", () => {
        expect.assertions(1);

        const input = "John Doe and Jane Smith will meet on 2024-06-10.";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> <LASTNAME> and <FIRSTNAME1> <LASTNAME1> will meet on <DATE>");
    });

    it("should anonymize organization names", () => {
        expect.assertions(1);

        const input = "John Doe works at Google.";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> <LASTNAME> works at <ORGANIZATION>");
    });

    it("should anonymize email addresses", () => {
        expect.assertions(1);

        const input = "John's email is john.doe@gmail.com";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> email is <EMAIL>");
    });

    it("should anonymize phone numbers", () => {
        expect.assertions(1);

        const input = "John's phone number is 123-456-7890";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> phone number is <PHONENUMBER>");
    });

    it("should anonymize money-related strings", () => {
        expect.assertions(1);

        const input = "John has $1000 in his account.";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> has <MONEY> in his account.");
    });

    it("should handle empty input string", () => {
        expect.assertions(1);

        const input = "";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe("");
    });

    it("should handle multiple matches of the same type", () => {
        expect.assertions(1);

        const input = "John Doe has phone numbers 123-456-7890 and 098-765-4321";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> <LASTNAME> has phone numbers <PHONENUMBER> and <PHONENUMBER1>");
    });

    it("should anonymize times", () => {
        expect.assertions(1);

        const input = "John's meeting is at 3pm.";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toMatch("<FIRSTNAME> meeting is at <TIME>");
    });

    it("should anonymize credit card numbers", () => {
        expect.assertions(1);

        const input = "John's credit card number is 4111-1111-1111-1111";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> credit card number is <CREDITCARD>");
    });

    it("should anonymize multiple credit card numbers", () => {
        expect.assertions(1);

        const input = "John's credit card numbers are 4111-1111-1111-1111 and 5500-0000-0000-0004";
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe("<FIRSTNAME> credit card numbers are <CREDITCARD> and <CREDITCARD1>");
    });

    it("should test long paragraph", () => {
        expect.assertions(1);

        const input = `My name is Jessica Thompson, and I was born on May 12, 1988, in a small town called Oakdale. I grew up with my parents and two siblings, an older brother named Daniel and a younger sister named Emily. We lived in a cozy two-story house with a white picket fence. In high school, I was actively involved in the drama club and played the lead role in our school's production of "Romeo and Juliet." After graduation, I pursued my passion for writing and earned a Bachelor's degree in English Literature from the University of Cambridge in 2010. Currently, I work as a freelance writer, specializing in content creation for various online platforms.
If you'd like to reach me, you can email me at johndoe1985@example.com or give me a call at +1 (555) 123-4567.
Please note that the credit card number provided, 4916 2899 5678 1234, is purely fictional and should not be used for any actual transactions or financial purposes.
In my free time, I enjoy hiking, painting, and playing the guitar. I'm also an avid traveler and have visited over 20 countries, each leaving a unique mark on my adventurous soul.
Please remember that all the information provided, including the credit card number, email address, and phone number, is entirely fictional and randomly generated. It does not represent any real individuals or their personal experiences.`;
        const result = stringAnonymize(input, standardModifierRules, {
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
        const result = stringAnonymize(input, standardModifierRules);

        expect(result).toBe(`Hi i'm <FIRSTNAME> <LASTNAME>, my email is <EMAIL> and my phone number is <PHONENUMBER>.`);
    });

    it("should exclude a rule from the rules list", () => {
        expect.assertions(1);

        const input = "John Doe will be 30 on 2024-06-10.";
        const result = stringAnonymize(input, standardModifierRules, { exclude: ["firstname"] });

        expect(result).toMatch("John <LASTNAME> will be 30 on <DATE>");
    });
});
