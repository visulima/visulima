import { Buffer } from "node:buffer";

import { readFile } from "@visulima/fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MailMessage from "../src/mail-message";

vi.mock(import("@visulima/fs"), () => {
    return {
        readFile: vi.fn(),
    };
});

const readFileMock = readFile as unknown as ReturnType<typeof vi.fn>;

describe("mailMessage - empty basename fallbacks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        readFileMock.mockResolvedValue(Buffer.from("data"));
    });

    it("falls back to \"attachment\" when the path has no basename", async () => {
        expect.assertions(1);

        const message = new MailMessage().from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>");

        await message.attachFromPath("/");

        const built = await message.build();

        expect(built.attachments?.[0]?.filename).toBe("attachment");
    });

    it("falls back to \"inline\" when the embedded path has no basename", async () => {
        expect.assertions(1);

        const message = new MailMessage().from("sender@example.com").to("user@example.com").subject("Test").html("<h1>Hi</h1>");

        await message.embedFromPath("/");

        const built = await message.build();

        expect(built.attachments?.[0]?.filename).toBe("inline");
    });
});
