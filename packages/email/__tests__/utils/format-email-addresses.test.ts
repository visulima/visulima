import { describe, expect, it } from "vitest";

import type { EmailAddress } from "../../src/types.js";
import { formatEmailAddresses } from "../../src/utils/format-email-addresses.js";

describe(formatEmailAddresses, () => {
    it("should format single address", () => {
        const address: EmailAddress = { email: "user@example.com" };
        const formatted = formatEmailAddresses(address);

        expect(formatted).toBe("user@example.com");
    });

    it("should format array of addresses", () => {
        const addresses: EmailAddress[] = [{ email: "user1@example.com" }, { email: "user2@example.com", name: "User 2" }];
        const formatted = formatEmailAddresses(addresses);

        expect(formatted).toBe("user1@example.com, User 2 <user2@example.com>");
    });
});
