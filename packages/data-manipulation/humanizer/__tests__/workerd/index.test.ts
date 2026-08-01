import { describe, expect, it } from "vitest";

import { formatBytes, parseBytes } from "../../src/bytes";
import duration from "../../src/duration";
import humanizer from "../../src/humanizer";
import { durationLanguage as de } from "../../src/language/de";
import { durationLanguage as es } from "../../src/language/es";
import { durationLanguage as fr } from "../../src/language/fr";
import { durationLanguage as ru } from "../../src/language/ru";
import loadDurationLanguage from "../../src/load-duration-language";
import parseDuration from "../../src/parse-duration";

/**
 * The behavioural assertions live in `__tests__/unit/**`, which
 * `vitest.workerd.config.ts` also runs inside the isolate — so the byte tables,
 * the locale formatting and the duration grammar are all verified against
 * workerd by their single definition.
 *
 * What is left here is what only workerd can answer: whether the runtime ships
 * the ICU data every locale-aware assertion silently depends on, and whether the
 * language packs (the one part of the graph the Node-only, fixture-driven
 * `unit/language/languages.test.ts` covers) resolve in an isolate.
 */
describe("@visulima/humanizer on workerd", () => {
    describe("intl surface", () => {
        it("should expose the Intl constructors the package relies on", () => {
            expect.assertions(2);

            expect(Intl.NumberFormat).toBeTypeOf("function");
            expect(Intl.PluralRules).toBeTypeOf("function");
        });

        it("should resolve non-English locales instead of collapsing to en", () => {
            expect.assertions(4);

            // A runtime shipped without full ICU resolves every request to "en".
            // The unit suite's locale assertions would then pass vacuously against
            // English output, so this is the guard that makes them meaningful here.
            expect(new Intl.NumberFormat("de-DE").resolvedOptions().locale).toBe("de-DE");
            expect(new Intl.NumberFormat("fr-FR").resolvedOptions().locale).toBe("fr-FR");
            expect(new Intl.NumberFormat("ja-JP").resolvedOptions().locale).toBe("ja-JP");
            expect(new Intl.NumberFormat("ar-EG").resolvedOptions().locale).toBe("ar-EG");
        });
    });

    describe("language packs", () => {
        it("should render statically imported language packs, including a plural-rule function", () => {
            expect.assertions(5);

            // `unit/language/languages.test.ts` owns the exhaustive per-locale table
            // but is driven by `node:fs` fixtures and cannot run in this pool, so
            // this pins that the `./language/*` sub-modules load and evaluate here.
            expect(duration(3_600_000, { language: de })).toBe("1 Stunde");
            expect(duration(3_600_000, { language: fr })).toBe("1 heure");
            expect(duration(3_600_000, { language: es })).toBe("1 hora");
            expect(duration(1000, { language: ru })).toBe("1 секунда");
            expect(duration(5000, { language: ru })).toBe("5 секунд");
        });

        it("should resolve a language pack through the dynamic import loader", async () => {
            expect.assertions(2);

            // `loadDurationLanguage` picks the pack with a dynamic `import()`, which
            // the workers pool resolves against the bundled module graph rather than
            // the filesystem — a code path Node cannot exercise on this package's behalf.
            const pack = await loadDurationLanguage("de");

            expect(pack.future).toBeDefined();
            expect(duration(3_600_000, { language: pack })).toBe("1 Stunde");
        });
    });

    describe("module graph", () => {
        it("should expose the whole public surface after loading in the isolate", () => {
            expect.assertions(4);

            expect(formatBytes(1024)).toBe("1 KB");
            expect(parseBytes("1KB")).toBe(1024);
            expect(parseDuration("1h")).toBe(3_600_000);
            expect(humanizer({ language: es }).duration(3_600_000)).toBe("1 hora");
        });
    });
});
