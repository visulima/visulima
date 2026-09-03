import nlp from "compromise";

import type { NlpMatch, NlpScanner } from "./types";

/**
 * Shape of `compromise`'s `.out("offset")` result. Note that BOTH the match and each of its
 * terms carry an offset: the match's is the start of the whole entity, so using it for a term
 * would mis-report every term after the first (in "John Doe", "Doe" would claim John's offset).
 */
interface CompromiseOffset {
    offset: { start: number };
    terms: { offset: { start: number }; tags: string[]; text: string }[];
}

// Maps an NLP type (as a rule key) to the compromise extractor that detects it.
// `people` covers both firstname and lastname tags.
const nlpExtractors: { method: "emails" | "money" | "organizations" | "people" | "phoneNumbers" | "urls"; types: string[] }[] = [
    { method: "emails", types: ["email"] },
    { method: "money", types: ["money"] },
    { method: "organizations", types: ["organization"] },
    { method: "people", types: ["firstname", "lastname"] },
    { method: "phoneNumbers", types: ["phonenumber"] },
    { method: "urls", types: ["url"] },
];

/**
 * A {@link NlpScanner} backed by {@link https://www.npmjs.com/package/compromise | compromise}.
 *
 * Detects people, organizations, money amounts, emails, phone numbers and urls in prose —
 * the entities no regular expression can describe. `compromise` is an optional peer
 * dependency of this entry point only: importing `@visulima/redact` alone pulls in none of it.
 * @example
 * ```ts
 * import { createRedactor, standardRules } from "@visulima/redact";
 * import { compromiseScanner } from "@visulima/redact/nlp";
 *
 * const scrub = createRedactor(standardRules, { nlp: compromiseScanner });
 *
 * scrub({ note: "John Doe works at Google" });
 * // => { note: "<FIRSTNAME> <LASTNAME> works at <ORGANIZATION>" }
 * ```
 * @param input The string being redacted.
 * @param types The rule keys in play; only extractors covering one of them are run.
 * @param logger Optional debug logger.
 * @returns Every entity found whose compromise tag matches one of `types`.
 */
// eslint-disable-next-line import/prefer-default-export
export const compromiseScanner: NlpScanner = (input, types, logger): NlpMatch[] => {
    const wanted = new Set(types.map((type) => type.toLowerCase()));
    const requested = nlpExtractors.filter((extractor) => extractor.types.some((type) => wanted.has(type)));

    // Skip the (expensive) compromise parse entirely when no NLP-backed rule was requested.
    if (requested.length === 0) {
        return [];
    }

    const nlpDocument = nlp(input);
    const matches: NlpMatch[] = [];

    // Only run the extractors whose tags were actually requested, instead of all six.
    for (const extractor of requested) {
        for (const documentObject of nlpDocument[extractor.method]().out("offset") as unknown as CompromiseOffset[]) {
            for (const term of documentObject.terms) {
                // compromise orders tags broad -> specific, so the last match is the most specific one.
                const reversedTags = term.tags.toReversed();

                logger?.debug(`reversedTags: ${JSON.stringify(reversedTags)}`);

                const foundTag = reversedTags.find((tag: string) => wanted.has(tag.toLowerCase()));

                logger?.debug(`foundTag: ${String(foundTag)}`);

                if (foundTag) {
                    // The TERM's own offset, not the entity's — see CompromiseOffset above.
                    matches.push({ start: term.offset.start, tag: foundTag, text: term.text });
                }
            }
        }
    }

    return matches;
};
