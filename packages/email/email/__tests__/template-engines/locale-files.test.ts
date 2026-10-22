import type { Dirent } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import { renderHandlebars } from "../../src/template-engines/handlebars";
import { createLocaleFileRenderer, loadLocaleTemplates } from "../../src/template-engines/locale-files";

// Only readdir is wrapped, so one test can supply a listing the disk cannot hold (see the case test).
vi.mock(import("node:fs/promises"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, readdir: vi.fn(actual.readdir) };
});

describe("locale files", () => {
    let directory: string;

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "visulima-email-locale-"));
        await writeFile(join(directory, "welcome.html"), "Hello {{name}}");
        await writeFile(join(directory, "welcome.de.html"), "Hallo {{name}}");
    });

    afterEach(async () => {
        await rm(directory, { force: true, recursive: true });
    });

    describe(createLocaleFileRenderer, () => {
        it("renders the locale file, then the language root, then the default file", async () => {
            expect.assertions(3);

            const render = createLocaleFileRenderer(directory, renderHandlebars, { defaultLocale: "en" });

            await expect(render("welcome", "de", { name: "Ada" })).resolves.toBe("Hallo Ada");
            await expect(render("welcome", "de-AT", { name: "Ada" })).resolves.toBe("Hallo Ada");
            await expect(render("welcome", "fr", { name: "Ada" })).resolves.toBe("Hello Ada");
        });

        it("does not turn a requested locale into a path", async () => {
            expect.assertions(1);

            const render = createLocaleFileRenderer(directory, renderHandlebars, { defaultLocale: "en" });

            await expect(render("welcome", "../secret", { name: "Ada" })).resolves.toBe("Hello Ada");
        });
    });

    describe(loadLocaleTemplates, () => {
        it("keys each file by its locale and registers the base file under defaultLocale", async () => {
            expect.assertions(1);

            await expect(loadLocaleTemplates(directory, "welcome", { defaultLocale: "en" })).resolves.toStrictEqual({
                de: "Hallo {{name}}",
                en: "Hello {{name}}",
            });
        });

        it("loads only locale files when there is no base file", async () => {
            expect.assertions(1);

            await writeFile(join(directory, "invite.de.html"), "Einladung");

            await expect(loadLocaleTemplates(directory, "invite")).resolves.toStrictEqual({ de: "Einladung" });
        });

        it("uses the requested extension", async () => {
            expect.assertions(1);

            await writeFile(join(directory, "notice.de.txt"), "Hinweis");

            await expect(loadLocaleTemplates(directory, "notice", { extension: ".txt" })).resolves.toStrictEqual({ de: "Hinweis" });
        });

        it("ignores files that only resemble the name, and directories", async () => {
            expect.assertions(1);

            await writeFile(join(directory, "welcome-back.de.html"), "x");
            await writeFile(join(directory, "welcome.v2.de.html"), "x");
            await writeFile(join(directory, "welcome.de.html.bak"), "x");
            await mkdir(join(directory, "welcome.fr.html"));

            await expect(loadLocaleTemplates(directory, "welcome", { defaultLocale: "en" })).resolves.toStrictEqual({
                de: "Hallo {{name}}",
                en: "Hello {{name}}",
            });
        });

        it("throws when the base file exists and no defaultLocale is given", async () => {
            expect.assertions(2);

            const result = loadLocaleTemplates(directory, "welcome");

            await expect(result).rejects.toThrow(EmailError);
            await expect(result).rejects.toThrow("pass defaultLocale");
        });

        it("throws when the default locale has both a base file and its own file", async () => {
            expect.assertions(1);

            await writeFile(join(directory, "welcome.en.html"), "Hi");

            await expect(loadLocaleTemplates(directory, "welcome", { defaultLocale: "en" })).rejects.toThrow("both exist");
        });

        it("throws when two locales differ only by case", async () => {
            expect.assertions(1);

            // A case-insensitive disk cannot hold welcome.de.html and welcome.DE.html together, so the listing is supplied.
            const fileEntry = (fileName: string): Dirent => ({ isFile: () => true, name: fileName }) as unknown as Dirent;

            vi.mocked(readdir).mockResolvedValueOnce([fileEntry("welcome.de.html"), fileEntry("welcome.DE.html")] as never);

            await expect(loadLocaleTemplates(directory, "welcome", { defaultLocale: "en" })).rejects.toThrow("differ only by case");
        });

        it.each([
            ["an empty name", ""],
            ["a parent reference", "../welcome"],
            ["a forward slash", "sub/welcome"],
            ["a backslash", String.raw`sub\welcome`],
        ])("rejects a name with %s", async (_label, name) => {
            expect.assertions(1);

            await expect(loadLocaleTemplates(directory, name, { defaultLocale: "en" })).rejects.toThrow(EmailError);
        });

        it("rejects an extension without a leading dot", async () => {
            expect.assertions(1);

            await expect(loadLocaleTemplates(directory, "welcome", { extension: "html" })).rejects.toThrow("Invalid template extension");
        });

        it("throws when no file matches the name", async () => {
            expect.assertions(1);

            await expect(loadLocaleTemplates(directory, "missing", { defaultLocale: "en" })).rejects.toThrow("No \"missing\" template files");
        });

        it("wraps a missing directory in an EmailError that keeps the cause", async () => {
            expect.assertions(2);

            const result = loadLocaleTemplates(join(directory, "does-not-exist"), "welcome", { defaultLocale: "en" });

            await expect(result).rejects.toThrow(EmailError);
            await expect(result).rejects.toThrow("Cannot read template directory");
        });
    });
});
