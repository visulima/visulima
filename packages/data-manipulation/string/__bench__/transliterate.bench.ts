import sindresorhusTransliterate from "@sindresorhus/transliterate";
import { transliterate as externalTransliterate } from "transliteration";
import { bench, describe } from "vitest";

import visulimaTransliterate from "../src/transliterate";

// Reusing testStrings from slugify.bench.ts; consider tailoring if needed for translit specifics
const testStrings = [
    "Foo Bar Baz foo bar baz",
    "       leading and trailing spaces       ",
    "[foo] [bar] {baz} (qux)",
    "Crème Brûlée and Hællæ, hva skjera? Стратегия!",
    "UNICORNS AND RAINBOWS AND MORE UNICORNS",
    "Foo & Bar | Baz = Qux < > ' \" ` ~ ! @ # $ % ^ & * ( ) _ + - = { } [ ] : ; ' < > , . ? /",
    "I ♥ Dogs and 🦄s and even 🚀s",
    "你好世界 Welcome to the Jungle Привет мир",
    // eslint-disable-next-line no-secrets/no-secrets
    "ThisIsALongStringWithoutSpacesOrSpecialCharactersToTestPerformanceOnSimpleStrings",
    String.raw`a_b-c.d~e f/g\h'i"j[k]l{m}n(o)p|q@r#s$t%u^v&w*x(y)z`,
    "long string with many words ".repeat(20).trim(),
    "重複字符重複字符重複字符重複字符 ".repeat(10).trim(),
];

// Define default options if any are commonly used or needed for fair comparison
const visulimaTranslitOptions = {};
const externalTranslitOptions = {}; // Options for the 'transliteration' package
const sindresorhusTranslitOptions = {}; // Options for '@sindresorhus/transliterate'

describe("Transliterate Function Benchmark", () => {
    bench("@visulima/string transliterate", async () => {
        for (const item of testStrings) {
            visulimaTransliterate(item, visulimaTranslitOptions);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("'transliteration' package transliterate", () => {
        for (const item of testStrings) {
            externalTransliterate(item, externalTranslitOptions);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("@sindresorhus/transliterate", () => {
        for (const item of testStrings) {
            sindresorhusTransliterate(item, sindresorhusTranslitOptions);
        }
    });
});
