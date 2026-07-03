import { beforeEach, describe, expect, it, vi } from "vitest";

import MailMessage from "../src/mail-message";
import htmlToText from "../src/template-engines/html-to-text";

vi.mock(import("../src/template-engines/html-to-text"), () => {
    return {
        default: vi.fn(() => "converted text"),
    };
});

describe("mailMessage - auto-text generation", () => {
    const makeConsole = () => ({ error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() }) as unknown as Console;
    const htmlToTextMock = htmlToText as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        htmlToTextMock.mockReturnValue("converted text");
    });

    describe("build", () => {
        it("auto-generates text from html and logs when a logger is set", async () => {
            expect.assertions(2);

            const mockConsole = makeConsole();

            const built = await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .html("<h1>Hi</h1>")
                .build();

            expect(built.text).toBe("converted text");
            // eslint-disable-next-line vitest/prefer-called-with
            expect(mockConsole.log).toHaveBeenCalled();
        });

        it("auto-generates text from html without a logger", async () => {
            expect.assertions(1);

            const built = await new MailMessage().from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>").build();

            expect(built.text).toBe("converted text");
        });
    });

    describe("view", () => {
        const renderer = (): Promise<string> => Promise.resolve("<h1>Hello</h1>");

        it("auto-generates text from a rendered template and logs when a logger is set", async () => {
            expect.assertions(2);

            const mockConsole = makeConsole();

            const message = await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .view(renderer, "template");

            const built = await message.build();

            expect(built.text).toBe("converted text");
            // eslint-disable-next-line vitest/prefer-called-with
            expect(mockConsole.log).toHaveBeenCalled();
        });

        it("auto-generates text from a rendered template without a logger", async () => {
            expect.assertions(1);

            const message = await new MailMessage().from("sender@example.com").to("user@example.com").subject("Test").view(renderer, "template");

            const built = await message.build();

            expect(built.text).toBe("converted text");
        });

        it("keeps existing text content when one is already set", async () => {
            expect.assertions(1);

            const mockConsole = makeConsole();

            const message = await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .text("existing text")
                .view(renderer, "template");

            const built = await message.build();

            expect(built.text).toBe("existing text");
        });

        it("skips text content when the conversion returns empty", async () => {
            expect.assertions(1);

            htmlToTextMock.mockReturnValue("");

            const mockConsole = makeConsole();

            const message = await new MailMessage()
                .setLogger(mockConsole)
                .from("sender@example.com")
                .to("user@example.com")
                .subject("Test")
                .view(renderer, "template");

            const built = await message.build();

            expect(built.html).toBe("<h1>Hello</h1>");
        });
    });
});
