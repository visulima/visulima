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

const replaceWithMasks = (documentTerms: IDocumentTerm[], output: string): string => {
    const maskMaps: Record<string, Map<string, string>> = {};

    let outputResult = output;

    for (const documentTerm of documentTerms) {
        const { replacement, tag, text } = documentTerm;

        let mask: string;

        if (typeof replacement === "function") {
            mask = String(replacement(text, undefined));
        } else if (typeof replacement === "string") {
            mask = replacement;
        } else {
            mask = maskText(maskMaps, text, tag);
        }

        // `text` is a plain string needle, but `mask` sits in the REPLACEMENT position, where
        // `$&`, `` $` `` and `$'` are substitution patterns — a tag containing one would splice
        // the surrounding text back in, echoing the very value being masked. Escaping `$` keeps
        // the mask literal for both scanner-supplied tags and rule keys.
        outputResult = outputResult.replace(text, mask.replaceAll("$", "$$$$"));
    }

    return outputResult;
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
