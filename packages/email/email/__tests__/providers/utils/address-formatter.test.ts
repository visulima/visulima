import { describe, expect, it } from "vitest";

import {
    formatAddress,
    formatAddressEmails,
    formatAddresses,
    formatAzureAddress,
    formatAzureAddresses,
    formatMailjetAddress,
    formatMailjetAddresses,
    formatMailpaceAddresses,
    formatMandrillAddress,
    formatMandrillAddresses,
    formatPostalAddress,
    formatPostalAddresses,
    formatSendGridAddress,
    formatSendGridAddresses,
    formatZeptomailAddress,
    formatZeptomailAddresses,
} from "../../../src/providers/utils/address-formatter";

describe(formatAddress, () => {
    it("should format an address with a name", () => {
        expect.assertions(1);

        expect(formatAddress({ email: "user@example.com", name: "User" })).toBe("\"User\" <user@example.com>");
    });

    it("should format an address without a name", () => {
        expect.assertions(1);

        expect(formatAddress({ email: "user@example.com" })).toBe("user@example.com");
    });
});

describe(formatAddresses, () => {
    it("should format a single address", () => {
        expect.assertions(1);

        expect(formatAddresses({ email: "user@example.com", name: "User" })).toStrictEqual(["\"User\" <user@example.com>"]);
    });

    it("should format an array of addresses", () => {
        expect.assertions(1);

        expect(formatAddresses([{ email: "a@example.com" }, { email: "b@example.com", name: "B" }])).toStrictEqual(["a@example.com", "\"B\" <b@example.com>"]);
    });
});

describe(formatSendGridAddress, () => {
    it("should include the name when present", () => {
        expect.assertions(1);

        expect(formatSendGridAddress({ email: "user@example.com", name: "User" })).toStrictEqual({ email: "user@example.com", name: "User" });
    });

    it("should omit the name when absent", () => {
        expect.assertions(1);

        expect(formatSendGridAddress({ email: "user@example.com" })).toStrictEqual({ email: "user@example.com" });
    });
});

describe(formatSendGridAddresses, () => {
    it("should format a single address", () => {
        expect.assertions(1);

        expect(formatSendGridAddresses({ email: "user@example.com" })).toStrictEqual([{ email: "user@example.com" }]);
    });

    it("should format an array of addresses", () => {
        expect.assertions(1);

        expect(formatSendGridAddresses([{ email: "a@example.com" }, { email: "b@example.com", name: "B" }])).toStrictEqual([
            { email: "a@example.com" },
            { email: "b@example.com", name: "B" },
        ]);
    });
});

describe(formatAddressEmails, () => {
    it("should format a single address", () => {
        expect.assertions(1);

        expect(formatAddressEmails({ email: "user@example.com", name: "User" })).toStrictEqual(["user@example.com"]);
    });

    it("should format an array of addresses", () => {
        expect.assertions(1);

        expect(formatAddressEmails([{ email: "a@example.com" }, { email: "b@example.com" }])).toStrictEqual(["a@example.com", "b@example.com"]);
    });
});

describe(formatAzureAddress, () => {
    it("should include the displayName when present", () => {
        expect.assertions(1);

        expect(formatAzureAddress({ email: "user@example.com", name: "User" })).toStrictEqual({ displayName: "User", email: "user@example.com" });
    });

    it("should omit the displayName when absent", () => {
        expect.assertions(1);

        expect(formatAzureAddress({ email: "user@example.com" })).toStrictEqual({ email: "user@example.com" });
    });
});

describe(formatAzureAddresses, () => {
    it("should format a single address", () => {
        expect.assertions(1);

        expect(formatAzureAddresses({ email: "user@example.com" })).toStrictEqual([{ email: "user@example.com" }]);
    });

    it("should format an array of addresses", () => {
        expect.assertions(1);

        expect(formatAzureAddresses([{ email: "a@example.com", name: "A" }, { email: "b@example.com" }])).toStrictEqual([
            { displayName: "A", email: "a@example.com" },
            { email: "b@example.com" },
        ]);
    });
});

describe(formatMailjetAddress, () => {
    it("should include the Name when present", () => {
        expect.assertions(1);

        expect(formatMailjetAddress({ email: "user@example.com", name: "User" })).toStrictEqual({ Email: "user@example.com", Name: "User" });
    });

    it("should omit the Name when absent", () => {
        expect.assertions(1);

        expect(formatMailjetAddress({ email: "user@example.com" })).toStrictEqual({ Email: "user@example.com" });
    });
});

describe(formatMailjetAddresses, () => {
    it("should format a single address", () => {
        expect.assertions(1);

        expect(formatMailjetAddresses({ email: "user@example.com" })).toStrictEqual([{ Email: "user@example.com" }]);
    });

    it("should format an array of addresses", () => {
        expect.assertions(1);

        expect(formatMailjetAddresses([{ email: "a@example.com", name: "A" }, { email: "b@example.com" }])).toStrictEqual([
            { Email: "a@example.com", Name: "A" },
            { Email: "b@example.com" },
        ]);
    });
});

describe(formatMandrillAddress, () => {
    it("should include the name and use the default type", () => {
        expect.assertions(1);

        expect(formatMandrillAddress({ email: "user@example.com", name: "User" })).toStrictEqual({ email: "user@example.com", name: "User", type: "to" });
    });

    it("should omit the name and honor a custom type", () => {
        expect.assertions(1);

        expect(formatMandrillAddress({ email: "user@example.com" }, "cc")).toStrictEqual({ email: "user@example.com", type: "cc" });
    });
});

describe(formatMandrillAddresses, () => {
    it("should format a single address with the default type", () => {
        expect.assertions(1);

        expect(formatMandrillAddresses({ email: "user@example.com" })).toStrictEqual([{ email: "user@example.com", type: "to" }]);
    });

    it("should format an array of addresses with a custom type", () => {
        expect.assertions(1);

        expect(formatMandrillAddresses([{ email: "a@example.com", name: "A" }, { email: "b@example.com" }], "bcc")).toStrictEqual([
            { email: "a@example.com", name: "A", type: "bcc" },
            { email: "b@example.com", type: "bcc" },
        ]);
    });
});

describe(formatPostalAddress, () => {
    it("should include the name when present", () => {
        expect.assertions(1);

        expect(formatPostalAddress({ email: "user@example.com", name: "User" })).toStrictEqual({ address: "user@example.com", name: "User" });
    });

    it("should omit the name when absent", () => {
        expect.assertions(1);

        expect(formatPostalAddress({ email: "user@example.com" })).toStrictEqual({ address: "user@example.com" });
    });
});

describe(formatPostalAddresses, () => {
    it("should format a single address", () => {
        expect.assertions(1);

        expect(formatPostalAddresses({ email: "user@example.com" })).toStrictEqual([{ address: "user@example.com" }]);
    });

    it("should format an array of addresses", () => {
        expect.assertions(1);

        expect(formatPostalAddresses([{ email: "a@example.com", name: "A" }, { email: "b@example.com" }])).toStrictEqual([
            { address: "a@example.com", name: "A" },
            { address: "b@example.com" },
        ]);
    });
});

describe(formatMailpaceAddresses, () => {
    it("should delegate to the standard formatter", () => {
        expect.assertions(1);

        expect(formatMailpaceAddresses([{ email: "a@example.com" }, { email: "b@example.com", name: "B" }])).toStrictEqual([
            "a@example.com",
            "\"B\" <b@example.com>",
        ]);
    });
});

describe(formatZeptomailAddress, () => {
    it("should include the name when present", () => {
        expect.assertions(1);

        expect(formatZeptomailAddress({ email: "user@example.com", name: "User" })).toStrictEqual({ address: "user@example.com", name: "User" });
    });

    it("should omit the name when absent", () => {
        expect.assertions(1);

        expect(formatZeptomailAddress({ email: "user@example.com" })).toStrictEqual({ address: "user@example.com" });
    });
});

describe(formatZeptomailAddresses, () => {
    it("should format a single address", () => {
        expect.assertions(1);

        expect(formatZeptomailAddresses({ email: "user@example.com" })).toStrictEqual([{ email_address: { address: "user@example.com" } }]);
    });

    it("should format an array of addresses", () => {
        expect.assertions(1);

        expect(formatZeptomailAddresses([{ email: "a@example.com", name: "A" }, { email: "b@example.com" }])).toStrictEqual([
            { email_address: { address: "a@example.com", name: "A" } },
            { email_address: { address: "b@example.com" } },
        ]);
    });
});
