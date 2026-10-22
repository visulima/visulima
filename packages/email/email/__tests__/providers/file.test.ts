import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { fileProvider } from "../../src/providers/file/index";
import type { EmailOptions } from "../../src/types";

const EML_PATTERN = /\.eml$/;

const message: EmailOptions = {
    from: { email: "sender@example.com" },
    subject: "Hello",
    text: "Body",
    to: { email: "user@example.com" },
};

describe(fileProvider, () => {
    let directory: string;

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "visulima-email-file-"));
    });

    afterEach(async () => {
        vi.useRealTimers();
        await rm(directory, { force: true, recursive: true });
    });

    it("throws when no directory is configured", () => {
        expect.assertions(1);

        expect(() => fileProvider()).toThrow(RequiredOptionError);
    });

    it("writes a parseable .eml file with the subject and the resolved Message-ID", async () => {
        expect.assertions(4);

        const provider = fileProvider({ directory });
        const result = await provider.sendEmail(message);

        const [name] = await readdir(directory);
        const eml = await readFile(join(directory, name ?? ""), "utf8");

        expect(result.success).toBe(true);
        expect(name).toMatch(EML_PATTERN);
        expect(eml).toContain("Subject: Hello");
        expect(eml).toContain(`Message-ID: ${result.data?.messageId ?? ""}`);
    });

    it("returns the written path and the provider name", async () => {
        expect.assertions(2);

        const result = await fileProvider({ directory }).sendEmail(message);
        const [name] = await readdir(directory);

        expect(result.data?.provider).toBe("file");
        expect(result.data?.response).toStrictEqual({ path: join(directory, name ?? "") });
    });

    it("writes attachments into the .eml file", async () => {
        expect.assertions(2);

        const result = await fileProvider({ directory }).sendEmail({
            ...message,
            attachments: [{ content: "attachment-body", contentType: "text/plain", filename: "note.txt" }],
        });

        const [name] = await readdir(directory);
        const eml = await readFile(join(directory, name ?? ""), "utf8");

        expect(result.success).toBe(true);
        expect(eml).toContain(`filename="note.txt"`);
    });

    // Four segments are needed: a single `..` after a name only steps back into the directory.
    it.each([
        ["forward slashes", "<../../../../escape@example.com>"],
        ["backslashes", String.raw`<..\..\..\..\escape@example.com>`],
    ])("keeps a Message-ID with %s inside the directory", async (_label, messageId) => {
        expect.assertions(3);

        const result = await fileProvider({ directory }).sendEmail({ ...message, headers: { "Message-ID": messageId } });
        const { path } = result.data?.response as { path: string };

        expect(result.success).toBe(true);
        expect(dirname(path)).toBe(directory);
        await expect(readdir(directory)).resolves.toHaveLength(1);
    });

    it("returns an error instead of overwriting a file with the same name", async () => {
        expect.assertions(3);

        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(0);

        const provider = fileProvider({ directory });
        const options: EmailOptions = { ...message, headers: { "Message-ID": "<duplicate@example.com>" } };

        const first = await provider.sendEmail(options);
        const second = await provider.sendEmail({ ...options, subject: "Replacement" });

        const [name] = await readdir(directory);
        const eml = await readFile(join(directory, name ?? ""), "utf8");

        expect(first.success).toBe(true);
        expect(second.success).toBe(false);
        expect(eml).toContain("Subject: Hello");
    });

    it("creates the output directory on first use", async () => {
        expect.assertions(2);

        const nested = join(directory, "nested", "out");
        const result = await fileProvider({ directory: nested }).sendEmail(message);

        expect(result.success).toBe(true);
        expect(existsSync(nested)).toBe(true);
    });

    it("reports the provider as available once the directory can be created", async () => {
        expect.assertions(1);

        await expect(fileProvider({ directory: join(directory, "available") }).isAvailable()).resolves.toBe(true);
    });

    it("sends nothing to the output directory when validation fails", async () => {
        expect.assertions(2);

        const result = await fileProvider({ directory }).sendEmail({ ...message, subject: "" });

        expect(result.success).toBe(false);
        await expect(readdir(directory)).resolves.toHaveLength(0);
    });
});
