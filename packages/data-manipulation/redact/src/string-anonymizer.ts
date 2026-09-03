import type { Censor, NlpMatch, RedactOptions, Rules, StringAnonymize } from "./types";

// Extends NlpMatch rather than restating it: a scanner's matches are spread straight into this
// array, so the compiler — not a comment — is what keeps the two shapes compatible.
interface IDocumentTerm extends NlpMatch {
    /** Optional explicit replacement (static string or {@link Censor}) from the matching rule. */
    replacement?: Censor | string;
}

const maskText = (maskMaps: Record<string, Map<string, string>>, text: string, tag: string): string => {
    const lowerCaseTag = tag.toLowerCase();

    // eslint-disable-next-line no-param-reassign
    maskMaps[lowerCaseTag] ??= new Map<string, string>();

    // Reuse the mask already assigned to this value so repeated occurrences of the same
    // entity share one label and later distinct values do not collide with it.
    const existing = maskMaps[lowerCaseTag].get(text);

    if (existing !== undefined) {
        return existing;
    }

    const { size } = maskMaps[lowerCaseTag];

    const maskedValue = `<${tag.toUpperCase()}${size > 0 ? String(size) : ""}>`;

    maskMaps[lowerCaseTag].set(text, maskedValue);

    return maskedValue;
};

/**
 * The text to put in place of a match: an explicit user replacement if the rule carried one,
 * otherwise the numbered `&lt;TAG>` mask. Resolved lazily by the caller, because allocating a
 * numbered mask for a term that is then dropped would burn a number and shift every later one.
 */
const resolveMask = (maskMaps: Record<string, Map<string, string>>, documentTerm: IDocumentTerm): string => {
    const { replacement, tag, text } = documentTerm;

    if (typeof replacement === "function") {
        return String(replacement(text, undefined));
    }

    if (typeof replacement === "string") {
        return replacement;
    }

    return maskText(maskMaps, text, tag);
};

const replaceWithMasks = (documentTerms: IDocumentTerm[], output: string): string => {
    const maskMaps: Record<string, Map<string, string>> = {};

    let result = "";
    let cursor = 0;

    // Terms arrive sorted by start (longest first on ties). Masking is applied AT each recorded
    // offset by slicing, rather than by `String.replace(text, mask)`: a string needle rewrites
    // the FIRST occurrence of the text, which is not necessarily the one that was matched. With
    // "Doe met John Doe", the surname match would rewrite the leading "Doe" and leave the real
    // one exposed. Slicing also means a mask containing `$&` or `` $` `` is inserted literally
    // instead of being re-expanded as a replacement pattern.
    for (const documentTerm of documentTerms) {
        const { start, text } = documentTerm;

        // Nothing to mask, and an empty needle would make the rescan below loop forever.
        if (text === "") {
            continue;
        }

        // Does the reported span actually point at the text it claims? Pattern rules always
        // produce one that does; an `nlp` scanner is caller-supplied, so this is checked before
        // the span is trusted for anything — including the overlap test below, which would
        // otherwise silently drop a match carrying a negative offset.
        if (Number.isInteger(start) && start >= 0 && output.slice(start, start + text.length) === text) {
            // A span beginning inside text already masked is an overlapping match for the same
            // value (e.g. `email` and `url` both matching an address). The first one wins —
            // which is why rule order decides — and the rest are dropped rather than allowed to
            // re-match some later, unrelated occurrence.
            if (start < cursor) {
                continue;
            }

            result += output.slice(cursor, start) + resolveMask(maskMaps, documentTerm);
            cursor = start + text.length;

            continue;
        }

        // The span is unusable, so there is no way to know WHICH occurrence was meant. Masking
        // the first would leave a later one — possibly the intended one — in the clear, and
        // skipping would leave them all. Mask every remaining occurrence instead: over-masking
        // is the only safe direction for a redaction library.
        let at = output.indexOf(text, cursor);

        if (at === -1) {
            continue;
        }

        const mask = resolveMask(maskMaps, documentTerm);

        while (at !== -1) {
            result += output.slice(cursor, at) + mask;
            cursor = at + text.length;
            at = output.indexOf(text, cursor);
        }
    }

    return result + output.slice(cursor);
};

const createUniqueAndSortedTerms = (processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    const uniqueProcessedTerms: IDocumentTerm[] = [
        // eslint-disable-next-line unicorn/no-array-reduce
        ...processedTerms.reduce((map, term) => map.set(term.text + String(term.start) + term.tag, term), new Map<string, IDocumentTerm>()).values(),
    ];

    return uniqueProcessedTerms.toSorted((a, b) => {
        const startDiff = a.start - b.start;

        if (startDiff !== 0) {
            return startDiff;
        }

        return b.text.length - a.text.length;
    });
};

const processWithRegex = (stringAnonymizeModifiers: StringAnonymize[], input: string): IDocumentTerm[] => {
    const processedTerms: IDocumentTerm[] = [];

    for (const modifier of stringAnonymizeModifiers) {
        const { key, pattern } = modifier;

        const rx = (modifier as { compiledPattern?: RegExp }).compiledPattern ?? new RegExp(pattern, "giu");

        rx.lastIndex = 0;

        let match;

        // eslint-disable-next-line no-cond-assign
        while ((match = rx.exec(input)) !== null) {
            const internal = modifier as { replacement?: Censor | string; userReplacement?: boolean };

            processedTerms.push({
                // Only honour an explicit, user-supplied replacement; default (`<KEY>`-filled) rules
                // keep the numbered-mask behaviour produced by maskText. When `userReplacement`
                // was never stamped (rules passed straight to the exported `stringAnonymize`),
                // fall back to the mere presence of an explicit `replacement`.
                replacement: internal.userReplacement ?? internal.replacement !== undefined ? internal.replacement : undefined,
                start: match.index,
                tag: key,
                text: match[0],
            });

            // Guard against zero-width matches (e.g. a user pattern like `\d*`): without
            // advancing lastIndex, rx.exec would match the empty string forever and hang.
            if (match.index === rx.lastIndex) {
                rx.lastIndex += 1;
            }
        }
    }

    return processedTerms;
};

const processDocument = (input: string, typesToAnonymize: string[], stringAnonymizeModifiers: StringAnonymize[], options?: RedactOptions): IDocumentTerm[] =>
    // No scanner injected means no NLP pass — and no natural-language library in the bundle.
    // NLP matches are collected before the regex ones so that, where both find the same span,
    // the sort (stable, start-ascending) keeps the entity label.
    createUniqueAndSortedTerms([...options?.nlp?.(input, typesToAnonymize, options.logger) ?? [], ...processWithRegex(stringAnonymizeModifiers, input)]);

const stringAnonymize = (input: string, modifiers: Rules, options?: RedactOptions): string => {
    const patternModifiers: StringAnonymize[] = [];
    const typesToAnonymize: string[] = [];

    for (const modifier of modifiers) {
        if (
            options?.exclude
            && ((typeof modifier === "string" && options.exclude.includes(modifier))
                || (typeof modifier === "number" && options.exclude.includes(modifier))
                || (typeof modifier === "object" && options.exclude.includes(modifier.key)))
        ) {
            continue;
        }

        if (typeof modifier === "object" && modifier.pattern) {
            patternModifiers.push(modifier as StringAnonymize);
        }

        // Lowercased here, once, so every scanner receives the casing its contract promises and
        // none of them has to normalise defensively.
        typesToAnonymize.push((typeof modifier === "object" ? modifier.key : String(modifier)).toLowerCase());
    }

    let output = input;

    const documentTerms = processDocument(input, typesToAnonymize, patternModifiers, options);

    output = replaceWithMasks(documentTerms, output);

    return output;
};

export default stringAnonymize;
