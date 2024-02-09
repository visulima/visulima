import { describe, expect, it } from "vitest";

import redact from "../src";

describe("redact", () => {
    it("should redact sensitive array data with filters", () => {
        expect.assertions(1);

        const input = [
            1,
            "password",
            3,
            "user",
            {
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            },
        ];

        const options = {
            filters: [
                {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    isApplicable: (value: any) => value === "password",
                    transform: () => "REDACTED",
                },
                {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    isApplicable: (value: any) => typeof value === "object",
                    transform: (value: any) =>
                        redact(value, {
                            filters: [
                                {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    isApplicable: (_: any, key: string) => key === "password",
                                    transform: () => "REDACTED",
                                },
                                {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    isApplicable: (_: any, key: string) => key === "user.password",
                                    transform: () => "REDACTED",
                                },
                            ],
                        }),
                },
            ],
        };

        const result = redact(input, options);

        expect(result).toStrictEqual([
            1,
            "REDACTED",
            3,
            "user",
            {
                password: "REDACTED",
                user: {
                    email: "test@example.com",
                    password: "REDACTED",
                },
            },
        ]);
    });

    it("should redact sensitive object data with filters", () => {
        expect.assertions(1);

        const input = {
            admin: {
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            },
            password: "123456",
            user: {
                email: "test@example.com",
                password: "123456",
            },
        };

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
                {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    isApplicable: (value: any, key: string) => key === "admin.user.password",
                    transform: () => "REDACTED",
                },
            ],
        };

        const result = redact(input, options);

        expect(result).toStrictEqual({
            admin: {
                user: {
                    email: "test@example.com",
                    password: "REDACTED",
                },
            },
            password: "REDACTED",
            user: {
                email: "test@example.com",
                password: "REDACTED",
            },
        });
    });
});
