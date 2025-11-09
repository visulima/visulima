import { describe, expect, it } from "vitest";

import type { EmailAddress } from "../../src/types.js";
import { formatEmailAddress } from "../../src/utils/format-email-address.js";

describe(formatEmailAddress, () => {
    it("should format email without name", () => {
        const address: EmailAddress = { email: "user@example.com" };
        const formatted = formatEmailAddress(address);

        expect(formatted).toBe("user@example.com");
    });

    it("should format email with name", () => {
        const address: EmailAddress = { email: "user@example.com", name: "John Doe" };
        const formatted = formatEmailAddress(address);

        expect(formatted).toBe("John Doe <user@example.com>");
    });

    it("should throw error for invalid email", () => {
        const address: EmailAddress = { email: "invalid" };

        expect(() => formatEmailAddress(address)).toThrow();
    });
});
