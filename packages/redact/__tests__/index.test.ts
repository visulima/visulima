import { describe, expect, it } from "vitest";

import redact from "../src";

describe("redact", () => {
    it("should redact sensitive data with a filters", () => {
        expect.assertions(1);

        const input = {
            password: "123456",
            user: {
                email: "test@example.com",
                password: "123456",
            },
        }

        const options = {
            filters: [
                {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    isApplicable: (value: any, key: string) => key === "password",
                    transform: () => "REDACTED",
                },
                {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    isApplicable: (value: any, key: string) => key === "user.password",
                    transform: () => "REDACTED",
                },
            ],
        }

        const result = redact(input, options);

        expect(result).toStrictEqual({
            password: "REDACTED",
            user: {
                email: "test@example.com",
                password: "REDACTED",
            }
        });
    });
});
