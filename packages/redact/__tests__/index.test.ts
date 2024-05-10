import { describe, expect, it } from "vitest";

import { redact } from "../src";
import defaultModifiers from "../src/modifiers";

describe("redact", () => {
    describe("array", () => {
        it("should redact sensitive array data with empty modifiers", () => {
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

            const result = redact(input, []);

            expect(result).toStrictEqual(input);
        });

        it("should redact sensitive array data with only specified keys", () => {
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

            const result = redact(input, [1]);

            expect(result).toStrictEqual([
                1,
                "<REDACTED>",
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ]);
        });

        it("should redact sensitive array data with deep specified key", () => {
            expect.assertions(1);

            const input = [
                1,
                ["test", "email", 2, "test"],
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

            const result = redact(input, ["1.2"]);

            expect(result).toStrictEqual([
                1,
                ["test", "email", "<1.2>", "test"],
                3,
                "user",
                {
                    password: "123456",
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
            ]);
        });
    });

    describe("object", () => {
        it("should redact sensitive object data with empty modifiers", () => {
            expect.assertions(1);

            const input = {
                admin: {
                    user: {
                        email: "test@example.com",
                        note: null,
                        password: "123456",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    note: null,
                    password: "123456",
                },
            };

            const result = redact(input, []);

            expect(result).toStrictEqual(input);
        });

        it("should redact sensitive object data only on explicitly specified key", () => {
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

            const result = redact(input, ["password"]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "123456",
                    },
                },
                password: "<PASSWORD>",
                user: {
                    email: "test@example.com",
                    password: "123456",
                },
            });
        });

        it("should redact sensitive object data only on explicitly specified keys", () => {
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

            const result = redact(input, ["password", "user.password", "admin.user.password"]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<ADMIN.USER.PASSWORD>",
                    },
                },
                password: "<PASSWORD>",
                user: {
                    email: "test@example.com",
                    password: "<USER.PASSWORD>",
                },
            });
        });

        it("should redact sensitive object data with specified key and deep option", () => {
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

            const result = redact(input, [{ deep: true, key: "password" }]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<PASSWORD>",
                    },
                },
                password: "<PASSWORD>",
                user: {
                    email: "test@example.com",
                    password: "<PASSWORD>",
                },
            });
        });

        it("should redact sensitive object data with wildcard key", () => {
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

            const result = redact(input, ["*.password"]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<*.PASSWORD>",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "<*.PASSWORD>",
                },
            });
        });

        it("should redact sensitive object data with wildcard key and replacement", () => {
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

            const result = redact(input, [{ key: "*.password", replacement: "<PASSWORD>" }]);

            expect(result).toStrictEqual({
                admin: {
                    user: {
                        email: "test@example.com",
                        password: "<PASSWORD>",
                    },
                },
                password: "123456",
                user: {
                    email: "test@example.com",
                    password: "<PASSWORD>",
                },
            });
        });
    });

    describe("string", () => {
        it("should anonymize a string", () => {
            expect.assertions(1);

            const input = "John Doe will be 30 on 2024-06-10.";
            const result = redact(input, defaultModifiers);

            expect(result).toMatch("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
        });
    });
});
