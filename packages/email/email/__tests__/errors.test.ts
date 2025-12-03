import { describe, expect, it } from "vitest";

import EmailError from "../src/errors/email-error";
import RequiredOptionError from "../src/errors/required-option-error";

describe(EmailError, () => {
    it("should create an EmailError with component and message", () => {
        expect.assertions(5);

        const error = new EmailError("test", "Something went wrong");

        expect(error).toBeInstanceOf(EmailError);
        expect(error.component).toBe("test");
        expect(error.message).toBe("[@visulima/email] [test] Something went wrong");
        expect(error.name).toBe("EmailError");
        expect(error.title).toBe("Email test Error");
    });

    it("should include code when provided", () => {
        expect.assertions(2);

        const error = new EmailError("smtp", "Connection failed", { code: "ECONNREFUSED" });

        expect(error.code).toBe("ECONNREFUSED");
        expect(error.message).toBe("[@visulima/email] [smtp] Connection failed");
    });

    it("should include cause when provided", () => {
        expect.assertions(1);

        const cause = new Error("Network timeout");
        const error = new EmailError("http", "Request failed", { cause });

        expect(error.cause).toBe(cause);
    });

    it("should include hint when provided", () => {
        expect.assertions(1);

        const error = new EmailError("auth", "Invalid credentials", {
            hint: "Check your API key",
        });

        expect(error.hint).toBe("Check your API key");
    });

    it("should include multiple hints when provided as array", () => {
        expect.assertions(1);

        const error = new EmailError("config", "Invalid configuration", {
            hint: ["Check your API key", "Verify your domain settings"],
        });

        expect(error.hint).toStrictEqual(["Check your API key", "Verify your domain settings"]);
    });

    it("should inherit from VisulimaError", () => {
        expect.assertions(3);

        const error = new EmailError("test", "Message");

        // Test that it has VisulimaError properties/methods
        expect(error).toHaveProperty("message");
        expect(error).toHaveProperty("name");
        expect(error).toHaveProperty("stack");
    });

    describe(RequiredOptionError, () => {
        it("should create an error for a single missing option", () => {
            expect.assertions(6);

            const error = new RequiredOptionError("smtp", "host");

            expect(error).toBeInstanceOf(RequiredOptionError);
            expect(error).toBeInstanceOf(EmailError);
            expect(error.component).toBe("smtp");
            expect(error.message).toBe("[@visulima/email] [smtp] Missing required option: 'host'");
            expect(error.name).toBe("RequiredOptionError");
            expect(error.hint).toBe("Please provide the required option: 'host'");
        });

        it("should create an error for multiple missing options", () => {
            expect.assertions(5);

            const error = new RequiredOptionError("smtp", ["host", "port"]);

            expect(error).toBeInstanceOf(RequiredOptionError);
            expect(error.component).toBe("smtp");
            expect(error.message).toBe("[@visulima/email] [smtp] Missing required options: 'host', 'port'");
            expect(error.name).toBe("RequiredOptionError");
            expect(error.hint).toBe("Please provide the following required options: 'host', 'port'");
        });

        it("should handle empty array of missing options", () => {
            expect.assertions(2);

            const error = new RequiredOptionError("test", []);

            expect(error.message).toBe("[@visulima/email] [test] Missing required options: ");
            expect(error.hint).toBe("Please provide the following required options: ");
        });

        it("should handle single item array", () => {
            expect.assertions(2);

            const error = new RequiredOptionError("test", ["option"]);

            expect(error.message).toBe("[@visulima/email] [test] Missing required options: 'option'");
            expect(error.hint).toBe("Please provide the following required options: 'option'");
        });
    });
});
