import { describe, expect, it } from "vitest";

import type { EmailAddress } from "../../src/types";
import formatEmailAddress from "../../src/utils/format-email-address";

describe(formatEmailAddress, () => {
    it("should format email without name", () => {
        expect.assertions(1);

        const address: EmailAddress = { email: "user@example.com" };
        const formatted = formatEmailAddress(address);

        expect(formatted).toBe("user@example.com");
    });

    it("should format email with name", () => {
        expect.assertions(1);

        const address: EmailAddress = { email: "user@example.com", name: "John Doe" };
        const formatted = formatEmailAddress(address);

        expect(formatted).toBe("John Doe <user@example.com>");
    });

    it("should throw error for invalid email", () => {
        expect.assertions(1);

        const address: EmailAddress = { email: "invalid" };

        expect(() => formatEmailAddress(address)).toThrow("Invalid email address");
    });
});
