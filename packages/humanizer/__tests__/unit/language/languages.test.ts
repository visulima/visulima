import { createReadStream, readdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseCSV } from "csv-parse";
import { beforeAll, describe, expect, it } from "vitest";

import type { DurationLanguage } from "../../../src";
import duration from "../../../src/duration";
import { durationLanguage as af } from "../../../src/language/af";
import { durationLanguage as am } from "../../../src/language/am";
import { durationLanguage as ar } from "../../../src/language/ar";
import { durationLanguage as bg } from "../../../src/language/bg";
import { durationLanguage as bn } from "../../../src/language/bn";
import { durationLanguage as ca } from "../../../src/language/ca";
import { durationLanguage as ckb } from "../../../src/language/ckb";
import { durationLanguage as cs } from "../../../src/language/cs";
import { durationLanguage as cy } from "../../../src/language/cy";
import { durationLanguage as da } from "../../../src/language/da";
import { durationLanguage as de } from "../../../src/language/de";
// eslint-disable-next-line unicorn/prevent-abbreviations
import { durationLanguage as el } from "../../../src/language/el";
import { durationLanguage as en } from "../../../src/language/en";
import { durationLanguage as eo } from "../../../src/language/eo";
import { durationLanguage as es } from "../../../src/language/es";
import { durationLanguage as et } from "../../../src/language/et";
import { durationLanguage as eu } from "../../../src/language/eu";
import { durationLanguage as fa } from "../../../src/language/fa";
import { durationLanguage as fi } from "../../../src/language/fi";
import { durationLanguage as fo } from "../../../src/language/fo";
import { durationLanguage as fr } from "../../../src/language/fr";
import { durationLanguage as he } from "../../../src/language/he";
import { durationLanguage as hi } from "../../../src/language/hi";
import { durationLanguage as hr } from "../../../src/language/hr";
import { durationLanguage as hu } from "../../../src/language/hu";
import { durationLanguage as id } from "../../../src/language/id";
import { durationLanguage as is } from "../../../src/language/is";
import { durationLanguage as italian } from "../../../src/language/it";
import { durationLanguage as ja } from "../../../src/language/ja";
import { durationLanguage as km } from "../../../src/language/km";
import { durationLanguage as kn } from "../../../src/language/kn";
import { durationLanguage as ko } from "../../../src/language/ko";
import { durationLanguage as ku } from "../../../src/language/ku";
import { durationLanguage as lo } from "../../../src/language/lo";
import { durationLanguage as lt } from "../../../src/language/lt";
import { durationLanguage as lv } from "../../../src/language/lv";
import { durationLanguage as mk } from "../../../src/language/mk";
import { durationLanguage as mn } from "../../../src/language/mn";
import { durationLanguage as mr } from "../../../src/language/mr";
import { durationLanguage as ms } from "../../../src/language/ms";
import { durationLanguage as nl } from "../../../src/language/nl";
import { durationLanguage as no } from "../../../src/language/no";
import { durationLanguage as pl } from "../../../src/language/pl";
import { durationLanguage as pt } from "../../../src/language/pt";
import { durationLanguage as ro } from "../../../src/language/ro";
import { durationLanguage as ru } from "../../../src/language/ru";
import { durationLanguage as sk } from "../../../src/language/sk";
import { durationLanguage as sl } from "../../../src/language/sl";
import { durationLanguage as sq } from "../../../src/language/sq";
import { durationLanguage as sr } from "../../../src/language/sr";
import { durationLanguage as sv } from "../../../src/language/sv";
import { durationLanguage as sw } from "../../../src/language/sw";
import { durationLanguage as ta } from "../../../src/language/ta";
import { durationLanguage as te } from "../../../src/language/te";
import { durationLanguage as th } from "../../../src/language/th";
import { durationLanguage as tr } from "../../../src/language/tr";
import { durationLanguage as uk } from "../../../src/language/uk";
import { durationLanguage as ur } from "../../../src/language/ur";
import { durationLanguage as uz } from "../../../src/language/uz";
import { durationLanguage as uz_CYR } from "../../../src/language/uz_CYR";
import { durationLanguage as vi } from "../../../src/language/vi";
import { durationLanguage as zh_CN } from "../../../src/language/zh_CN";
import { durationLanguage as zh_TW } from "../../../src/language/zh_TW";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "__fixtures__", "duration");

const importedLanguages = {
    af,
    am,
    ar,
    bg,
    bn,
    ca,
    ckb,
    cs,
    cy,
    da,
    de,
    el,
    en,
    eo,
    es,
    et,
    eu,
    fa,
    fi,
    fo,
    fr,
    he,
    hi,
    hr,
    hu,
    id,
    is,
    it: italian,
    ja,
    km,
    kn,
    ko,
    ku,
    lo,
    lt,
    lv,
    mk,
    mn,
    mr,
    ms,
    nl,
    no,
    pl,
    pt,
    ro,
    ru,
    sk,
    sl,
    sq,
    sr,
    sv,
    sw,
    ta,
    te,
    th,
    tr,
    uk,
    ur,
    uz,
    uz_CYR,
    vi,
    zh_CN,
    zh_TW,
};

describe("localized duration", () => {
    const languages = new Map<string, [number, string][]>();

    beforeAll(async () => {
        const definitionNames = readdirSync(fixturePath).filter((f) => extname(f) === ".tsv");

        /**
         * @param {string} filePath
         * @returns {Promise<Array<[number, string]>>}
         */
        const readPairs = async (filePath: string): Promise<[number, string][]> => {
            /** @type {Array<[number, string]>} */
            const result: [number, string][] = [];

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const parser = createReadStream(filePath).pipe(parseCSV({ delimiter: "\t" }));

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for await (const [msString, expectedResult] of parser) {
                result.push([Number.parseFloat(msString), expectedResult]);
            }

            return result;
        };

        // eslint-disable-next-line compat/compat
        await Promise.all(
            definitionNames.map(async (fileName) => {
                const language = basename(fileName, ".tsv");
                const filePath = join(fixturePath, fileName);

                languages.set(language, await readPairs(filePath));
            }),
        );
    });

    it("should load all fixture files", () => {
        expect.assertions(2);

        expect(languages.has("en")).toBeTruthy();
        expect(languages.has("es")).toBeTruthy();
    });

    it("humanizes all languages correctly with the top-level function", () => {
        expect.assertions(3311);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [language, pairs] of languages) {
            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const [milliseconds, expectedResult] of pairs) {
                expect(
                    duration(milliseconds, {
                        delimiter: "+",
                        language: importedLanguages[language as keyof typeof importedLanguages] as DurationLanguage,
                        units: ["y", "mo", "w", "d", "h", "m", "s", "ms"],
                    }),
                    `${language} localization error for ${String(milliseconds)} milliseconds`,
                ).toStrictEqual(expectedResult);
            }
        }
    });
});
