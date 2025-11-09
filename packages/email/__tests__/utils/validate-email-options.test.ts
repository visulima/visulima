import { describe, expect, it } from "vitest";

import type { EmailOptions } from "../../src/types.js";
import { validateEmailOptions } from "../../src/utils/validate-email-options.js";

describe(validateEmailOptions, () => {
    it("should validate correct email options", () => {
        const options: EmailOptions = {
            from: { email: "sender@example.com" },
            html: "<h1>Test</h1>",
            subject: "Test",
            to: { email: "user@example.com" },
        };

        const errors = validateEmailOptions(options);

        expect(errors).toHaveLength(0);
    });

    it("should return errors for missing required fields", () => {
        const options = {} as EmailOptions;

        const errors = validateEmailOptions(options);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors).toContain("Missing required field: from");
        expect(errors).toContain("Missing required field: to");
        expect(errors).toContain("Missing required field: subject");
    });

    it("should return error if neither text nor html is provided", () => {
        const options: EmailOptions = {
            from: { email: "sender@example.com" },
            subject: "Test",
            to: { email: "user@example.com" },
        };

        const errors = validateEmailOptions(options);

        expect(errors).toContain("Either text or html content is required");
    });

    it("should validate email addresses", () => {
        const options: EmailOptions = {
            from: { email: "invalid-email" },
            html: "<h1>Test</h1>",
            subject: "Test",
            to: { email: "user@example.com" },
        };

        const errors = validateEmailOptions(options);

        expect(errors).toContain("Invalid from email address: invalid-email");
    });

    it("should validate CC and BCC addresses", () => {
        const options: EmailOptions = {
            bcc: { email: "invalid-bcc" },
            cc: { email: "invalid-cc" },
            from: { email: "sender@example.com" },
            html: "<h1>Test</h1>",
            subject: "Test",
            to: { email: "user@example.com" },
        };

        const errors = validateEmailOptions(options);

        expect(errors).toContain("Invalid cc email address: invalid-cc");
        expect(errors).toContain("Invalid bcc email address: invalid-bcc");
    });
});
