import { describe, expect, it } from "vitest";

import type { EmailAddress } from "../../src/types";
import formatEmailAddresses from "../../src/utils/format-email-addresses";

describe(formatEmailAddresses, () => {
    it("should format single address", () => {
        expect.assertions(1);

        const address: EmailAddress = { email: "user@example.com" };
        const formatted = formatEmailAddresses(address);

        expect(formatted).toBe("user@example.com");
    });

    it("should format array of addresses", () => {
        expect.assertions(1);

        const addresses: EmailAddress[] = [{ email: "user1@example.com" }, { email: "user2@example.com", name: "User 2" }];
        const formatted = formatEmailAddresses(addresses);

        expect(formatted).toBe("user1@example.com, User 2 <user2@example.com>");
    });
});
