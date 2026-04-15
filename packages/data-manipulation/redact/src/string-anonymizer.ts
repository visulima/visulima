import nlp from "compromise";

import type { RedactOptions, Rules, StringAnonymize } from "./types";

interface IDocumentTerm {
    start: number;
    tag: string;
    text: string;
}

interface CompromiseOffset {
    offset: { start: number };
    terms: { tags: string[]; text: string }[];
}

const maskText = (maskMaps: Record<string, Map<string, string>>, text: string, tag: string): string => {
    const lowerCaseTag = tag.toLowerCase();

    // eslint-disable-next-line no-param-reassign
    maskMaps[lowerCaseTag] ??= new Map<string, string>();

    const { size } = maskMaps[lowerCaseTag];

    const maskedValue = `<${tag.toUpperCase()}${size > 0 ? String(size) : ""}>`;

    maskMaps[lowerCaseTag].set(text, maskedValue);

    return maskMaps[lowerCaseTag].get(text) as string;
};

const replaceWithMasks = (typesToAnonymize: string[], documentTerms: IDocumentTerm[], output: string): string => {
    const maskMaps: Record<string, Map<string, string>> = {};

    for (const element of typesToAnonymize) {
        maskMaps[element] = new Map<string, string>();
    }

    let outputResult = output;

    for (const documentTerm of documentTerms) {
        const { tag, text } = documentTerm;
        const mask = maskText(maskMaps, text, tag);

        outputResult = outputResult.replace(text, mask);
    }

    return outputResult;
};

const createDocumentTermsFromTerms = (
    typesToAnonymize: string[],
    processedTerms: IDocumentTerm[],
    documentObject: CompromiseOffset,
    term: { tags: string[]; text: string },

    logger?: { debug: (...arguments_: unknown[]) => void },
): IDocumentTerm[] => {
    const reversedTags = term.tags.toReversed();

    logger?.debug(`reversedTags: ${JSON.stringify(reversedTags)}`);

    const foundTag = reversedTags.find((tag: string) => typesToAnonymize.includes(tag.toLowerCase()));

    logger?.debug(`foundTag: ${String(foundTag)}`);

    if (foundTag) {
        processedTerms.push({ start: documentObject.offset.start, tag: foundTag, text: term.text });
    }

    return processedTerms;
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

const processWithRegex = (stringAnonymizeModifiers: StringAnonymize[], input: string, processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    for (const modifier of stringAnonymizeModifiers) {
        const { key, pattern } = modifier;

        const rx = new RegExp(pattern, "giu");

        let match;

        // eslint-disable-next-line no-cond-assign
        while ((match = rx.exec(input)) !== null) {
            processedTerms.push({
                start: match.index,
                tag: key,
                text: match[0],
            });
        }
    }

    return processedTerms;
};

const processTerms = (
    typesToAnonymize: string[],
    input: string,
    processedTerms: IDocumentTerm[],

    logger?: { debug: (...arguments_: unknown[]) => void },
): IDocumentTerm[] => {
    const nlpDocument = nlp(input);

    const processedDocument: CompromiseOffset[] = [
        ...(nlpDocument.emails().out("offset") as unknown as CompromiseOffset[]),
        ...(nlpDocument.money().out("offset") as unknown as CompromiseOffset[]),
        ...(nlpDocument.organizations().out("offset") as unknown as CompromiseOffset[]),
        ...(nlpDocument.people().out("offset") as unknown as CompromiseOffset[]),
        ...(nlpDocument.phoneNumbers().out("offset") as unknown as CompromiseOffset[]),
        ...(nlpDocument.urls().out("offset") as unknown as CompromiseOffset[]),
    ];

    for (const documentObject of processedDocument) {
        const { terms } = documentObject;

        for (const term of terms) {
            // eslint-disable-next-line no-param-reassign
            processedTerms = createDocumentTermsFromTerms(typesToAnonymize, processedTerms, documentObject, term, logger);
        }
    }

    return processedTerms;
};

const processDocument = (
    input: string,
    typesToAnonymize: string[],
    stringAnonymizeModifiers: StringAnonymize[],

    logger?: { debug: (...arguments_: unknown[]) => void },
): IDocumentTerm[] => {
    let processedTerms: IDocumentTerm[] = [];

    processedTerms = processTerms(typesToAnonymize, input, processedTerms, logger);
    processedTerms = processWithRegex(stringAnonymizeModifiers, input, processedTerms);

    return createUniqueAndSortedTerms(processedTerms);
};

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

        if (typeof modifier === "string" || typeof modifier === "number") {
            typesToAnonymize.push(modifier.toString());
        } else {
            typesToAnonymize.push(modifier.key);
        }
    }

    let output = input;

    const documentTerms = processDocument(input, typesToAnonymize, patternModifiers, options?.logger);

    output = replaceWithMasks(typesToAnonymize, documentTerms, output);

    return output;
};

export default stringAnonymize;
