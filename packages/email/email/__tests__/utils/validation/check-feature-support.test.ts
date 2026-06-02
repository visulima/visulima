import { describe, expect, it } from "vitest";

import type { EmailOptions, FeatureFlags } from "../../../src/types";
import checkFeatureSupport from "../../../src/utils/validation/check-feature-support";

const baseMessage: EmailOptions = {
    from: { email: "sender@example.com" },
    subject: "Hello",
    text: "Body",
    to: { email: "user@example.com" },
};

describe(checkFeatureSupport, () => {
    it("returns supported when no features map is provided", () => {
        expect.assertions(2);

        const result = checkFeatureSupport({ ...baseMessage, tags: ["promo"] });

        expect(result.supported).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    it("returns supported when a used capability is undefined (not explicitly disabled)", () => {
        expect.assertions(1);

        const features: FeatureFlags = { html: true };
        const result = checkFeatureSupport({ ...baseMessage, tags: ["promo"] }, features);

        expect(result.supported).toBe(true);
    });

    it("flags a capability the message uses but the provider explicitly disabled", () => {
        expect.assertions(3);

        const features: FeatureFlags = { tagging: false };
        const result = checkFeatureSupport({ ...baseMessage, tags: ["promo"] }, features);

        expect(result.supported).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({ feature: "tagging", field: "tags" });
    });

    it("does not flag a disabled capability the message does not use", () => {
        expect.assertions(1);

        const features: FeatureFlags = { attachments: false, tagging: false };
        const result = checkFeatureSupport(baseMessage, features);

        expect(result.supported).toBe(true);
    });

    it("detects attachments, replyTo, html, and custom headers", () => {
        expect.assertions(4);

        const message: EmailOptions = {
            ...baseMessage,
            attachments: [{ content: "x", filename: "a.txt" }],
            headers: { "X-Custom": "1" },
            html: "<p>hi</p>",
            replyTo: { email: "reply@example.com" },
        };

        expect(checkFeatureSupport(message, { attachments: false }).violations[0]?.feature).toBe("attachments");
        expect(checkFeatureSupport(message, { replyTo: false }).violations[0]?.feature).toBe("replyTo");
        expect(checkFeatureSupport(message, { html: false }).violations[0]?.feature).toBe("html");
        expect(checkFeatureSupport(message, { customHeaders: false }).violations[0]?.feature).toBe("customHeaders");
    });

    it("ignores empty headers and empty arrays", () => {
        expect.assertions(2);

        expect(checkFeatureSupport({ ...baseMessage, headers: {} }, { customHeaders: false }).supported).toBe(true);
        expect(checkFeatureSupport({ ...baseMessage, attachments: [] }, { attachments: false }).supported).toBe(true);
    });

    it("detects provider-specific scheduling and template extension fields", () => {
        expect.assertions(2);

        const scheduled = { ...baseMessage, scheduledAt: new Date(0) } as EmailOptions;
        const templated = { ...baseMessage, templateId: "tmpl_1" } as EmailOptions;

        expect(checkFeatureSupport(scheduled, { scheduling: false }).violations[0]?.feature).toBe("scheduling");
        expect(checkFeatureSupport(templated, { templates: false }).violations[0]?.feature).toBe("templates");
    });

    it("reports the alias field actually set rather than a fixed name", () => {
        expect.assertions(2);

        const scheduled = { ...baseMessage, sendAt: new Date(0) } as EmailOptions;
        const templated = { ...baseMessage, template: "welcome" } as EmailOptions;

        expect(checkFeatureSupport(scheduled, { scheduling: false }).violations[0]?.field).toBe("sendAt");
        expect(checkFeatureSupport(templated, { templates: false }).violations[0]?.field).toBe("template");
    });
});
