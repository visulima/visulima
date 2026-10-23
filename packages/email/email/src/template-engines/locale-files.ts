import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import EmailError from "../errors/email-error";
import type { LocaleTemplates } from "./i18n";
import { renderI18n } from "./i18n";
import type { TemplateRenderer } from "./types";

const COMPONENT = "template-files";
const DEFAULT_EXTENSION = ".html";
const LOCALE_PATTERN = /^[\da-z-]+$/i;
const FORBIDDEN_PARTS = ["/", "\\", "\0", ".."];

const hasForbiddenPart = (value: string): boolean => FORBIDDEN_PARTS.some((part) => value.includes(part));

/**
 * Rejects a name or extension that could leave the directory, before anything is read.
 * @param name The template name.
 * @param extension The file extension, including the dot.
 * @throws {EmailError} When either value is unsafe.
 */
const assertSafeInput = (name: string, extension: string): void => {
    if (name === "" || hasForbiddenPart(name)) {
        throw new EmailError(COMPONENT, `Invalid template name "${name}"`);
    }

    if (!extension.startsWith(".") || extension.length < 2 || hasForbiddenPart(extension)) {
        throw new EmailError(COMPONENT, `Invalid template extension "${extension}"`);
    }
};

/**
 * Lists the directory that holds the template files.
 * @param directory The directory to list.
 * @returns The directory entries.
 * @throws {EmailError} When the directory cannot be read.
 */
const listDirectory = async (directory: string): Promise<Dirent[]> => {
    try {
        return await readdir(directory, { withFileTypes: true });
    } catch (error) {
        throw new EmailError(COMPONENT, `Cannot read template directory "${directory}"`, { cause: error });
    }
};

/**
 * Sorts the directory entries for one template name into the un-suffixed file and the locale files.
 * Directories, names that only resemble the template, and suffixes that are not a locale are skipped.
 * @param entries The directory entries to sort.
 * @param name The template name to match files against.
 * @param extension The extension a template file must have, including the dot.
 * @returns Whether the un-suffixed file exists, and each locale file keyed by its locale.
 */
const findTemplateFiles = (entries: Dirent[], name: string, extension: string): { hasBaseFile: boolean; localeFiles: Map<string, string> } => {
    const baseFile = `${name}${extension}`;
    const prefix = `${name}.`;
    const localeFiles = new Map<string, string>();
    let hasBaseFile = false;

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        if (entry.name === baseFile) {
            hasBaseFile = true;
        } else if (entry.name.startsWith(prefix) && entry.name.endsWith(extension)) {
            const locale = entry.name.slice(prefix.length, entry.name.length - extension.length);

            if (LOCALE_PATTERN.test(locale)) {
                localeFiles.set(locale, entry.name);
            }
        }
    }

    return { hasBaseFile, localeFiles };
};

/**
 * Rejects two locales that differ only by case, since a case-insensitive lookup could not choose.
 * @param locales The locales found on disk.
 * @throws {EmailError} When two locales match ignoring case.
 */
const assertDistinctLocales = (locales: string[]): void => {
    const seen = new Map<string, string>();

    for (const locale of locales) {
        const previous = seen.get(locale.toLowerCase());

        if (previous !== undefined) {
            throw new EmailError(COMPONENT, `Locales "${previous}" and "${locale}" differ only by case`);
        }

        seen.set(locale.toLowerCase(), locale);
    }
};

/**
 * Reads every locale file in parallel.
 * @param directory The directory the files are in.
 * @param localeFiles Each locale mapped to its file name, as listed in the directory.
 * @returns The file contents keyed by locale.
 */
const readLocaleFiles = async (directory: string, localeFiles: Map<string, string>): Promise<Record<string, string>> => {
    const entries = await Promise.all(
        [...localeFiles].map(async ([locale, file]) => [locale, await readFile(join(directory, file), "utf8")] as const),
    );

    return Object.fromEntries(entries);
};

/**
 * Loads a named template in every locale that has a file on disk.
 *
 * For a name such as `welcome`, the directory is searched for `welcome.{locale}.html`, and each
 * match is keyed by its locale. The un-suffixed `welcome.html` is registered under `defaultLocale`.
 * The result plugs straight into {@link renderI18n}, which then resolves `de-AT` to `de` and falls
 * back to the default locale.
 *
 * Only files are read, and only names built from the directory listing. The requested name must not
 * contain a path separator or `..`, and a locale is never turned into a path, so a locale taken from
 * user input (such as `Accept-Language`) only selects a key in the returned map.
 * @param directory The directory that holds the template files.
 * @param name The template name, without locale or extension.
 * @param options The default locale and file extension. See {@link LocaleFileOptions}.
 * @returns The file contents keyed by locale. See {@link LocaleTemplates}.
 * @throws {EmailError} When the name is unsafe, the directory cannot be read, no file matches, the
 * un-suffixed file has no `defaultLocale`, the default locale has both files, or two locales differ
 * only by case.
 * @example
 * ```ts
 * const templates = await loadLocaleTemplates("./emails", "welcome", { defaultLocale: "en" });
 * await renderI18n(templates, "de-AT", renderHandlebars, { name: "Ada" }, { defaultLocale: "en" });
 * ```
 */
export const loadLocaleTemplates = async (directory: string, name: string, options: LocaleFileOptions = {}): Promise<LocaleTemplates> => {
    const extension = options.extension ?? DEFAULT_EXTENSION;
    const { defaultLocale } = options;
    const baseFile = `${name}${extension}`;

    assertSafeInput(name, extension);

    const { hasBaseFile, localeFiles } = findTemplateFiles(await listDirectory(directory), name, extension);
    const locales = [...localeFiles.keys()];

    if (hasBaseFile && defaultLocale === undefined) {
        throw new EmailError(COMPONENT, `"${baseFile}" exists, so pass defaultLocale to register it`);
    }

    if (!hasBaseFile && locales.length === 0) {
        throw new EmailError(COMPONENT, `No "${name}" template files with extension "${extension}" in "${directory}"`);
    }

    assertDistinctLocales(locales);

    if (hasBaseFile && defaultLocale !== undefined && locales.some((locale) => locale.toLowerCase() === defaultLocale.toLowerCase())) {
        throw new EmailError(COMPONENT, `"${baseFile}" and "${name}.${defaultLocale}${extension}" both exist; keep one`);
    }

    const templates: LocaleTemplates = await readLocaleFiles(directory, localeFiles);

    if (hasBaseFile && defaultLocale !== undefined) {
        templates[defaultLocale] = await readFile(join(directory, baseFile), "utf8");
    }

    return templates;
};

/**
 * Creates a renderer that loads a named template from disk for a locale and renders it with an
 * engine, falling back to the default locale. Binding `defaultLocale` once here means the fallback
 * cannot be left out of a call.
 * @param directory The directory that holds the template files.
 * @param renderer The text template engine, such as `renderHandlebars` or `renderMjml`.
 * @param options The default locale and file extension. See {@link LocaleFileOptions}.
 * @returns A {@link LocaleFileRenderer}.
 * @example
 * ```ts
 * import { renderHandlebars } from "@visulima/email/template/handlebars";
 * import { createLocaleFileRenderer } from "@visulima/email/template/locale-files";
 *
 * const render = createLocaleFileRenderer("./emails", renderHandlebars, { defaultLocale: "en" });
 * await render("welcome", "fr", { name: "Ada" }); // reads welcome.html when there is no welcome.fr.html
 * ```
 */
export const createLocaleFileRenderer = (directory: string, renderer: TemplateRenderer, options: LocaleFileOptions = {}): LocaleFileRenderer => async (name, locale, data, rendererOptions) => {
    const templates = await loadLocaleTemplates(directory, name, options);

    return renderI18n(templates, locale, renderer, data, { defaultLocale: options.defaultLocale, rendererOptions });
};

/**
 * Options for {@link loadLocaleTemplates} and {@link createLocaleFileRenderer}.
 */
export interface LocaleFileOptions {
    /**
     * Locale the un-suffixed file (`name` plus `extension`) is registered under. It is also the
     * fallback for any locale without its own file. Required when that file exists.
     */
    defaultLocale?: string;

    /**
     * File extension, including the leading dot.
     * @default ".html"
     */
    extension?: string;
}

/**
 * Renders a named template from disk for a locale. Each call reads the directory again, so cache
 * the result yourself if the templates do not change at runtime.
 */
export type LocaleFileRenderer = (
    name: string,
    locale: string,
    data?: Record<string, unknown>,
    rendererOptions?: Record<string, unknown>,
) => Promise<string>;
