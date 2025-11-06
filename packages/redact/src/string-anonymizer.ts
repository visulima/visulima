import nlp from "compromise";

import type { RedactOptions, Rules, StringAnonymize } from "./types";

interface IDocumentTerm {
    start: number;
    tag: string;
    text: string;
}

const maskText = (maskMaps: Record<string, Map<string, string>>, text: string, tag: string): string => {
    const lowerCaseTag = tag.toLowerCase();

    // eslint-disable-next-line security/detect-object-injection
    if (!maskMaps[lowerCaseTag]) {
        // eslint-disable-next-line no-param-reassign,security/detect-object-injection
        maskMaps[lowerCaseTag] = new Map<string, string>();
    }

    // eslint-disable-next-line security/detect-object-injection
    const { size } = maskMaps[lowerCaseTag] as Map<string, string>;

    const maskedValue = `<${tag.toUpperCase()}${size > 0 ? size : ""}>`;

    // eslint-disable-next-line security/detect-object-injection
    (maskMaps[lowerCaseTag] as Map<string, string>).set(text, maskedValue);

    // eslint-disable-next-line security/detect-object-injection
    return (maskMaps[lowerCaseTag] as Map<string, string>).get(text) as string;
};

const replaceWithMasks = (typesToAnonymize: string[], documentTerms: IDocumentTerm[], output: string): string => {
    const maskMaps: Record<string, Map<string, string>> = {};

    for (const type of typesToAnonymize) {
        // eslint-disable-next-line security/detect-object-injection
        maskMaps[type] = new Map<string, string>();
    }

    let outputResult = output;

    for (const term of documentTerms) {
        const { tag, text } = term;
        const mask = maskText(maskMaps, text, tag);

        outputResult = outputResult.replace(text, mask);
    }

    return outputResult;
};

const createDocumentTermsFromTerms = (
    typesToAnonymize: string[],
    processedTerms: IDocumentTerm[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentObject: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    term: any,

    logger?: { debug: (...arguments_: any[]) => void },
): IDocumentTerm[] => {
    const reversedTags = term.tags.reverse();

    logger?.debug(`reversedTags: ${JSON.stringify(reversedTags)}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foundTag = reversedTags.find((tag: string) => typesToAnonymize.includes(tag.toLowerCase() as any));

    logger?.debug(`foundTag: ${foundTag}`);

    if (foundTag) {
        processedTerms.push({ start: documentObject.offset.start, tag: foundTag, text: term.text });
    }

    return processedTerms;
};

const createUniqueAndSortedTerms = (processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    // eslint-disable-next-line unicorn/no-array-reduce
    const uniqueProcessedTerms = [...processedTerms.reduce((map, term) => map.set(term.text + term.start + term.tag, term), new Map()).values()];

    // eslint-disable-next-line etc/no-assign-mutated-array
    return uniqueProcessedTerms.sort((a, b) => {
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

        // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
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

    logger?: { debug: (...arguments_: any[]) => void },
): IDocumentTerm[] => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const document_ = nlp(input);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedDocument: any[] = [
        ...document_.emails().out("offset"),
        ...document_.money().out("offset"),
        ...document_.organizations().out("offset"),
        ...document_.people().out("offset"),
        ...document_.phoneNumbers().out("offset"),
        ...document_.urls().out("offset"),
    ];

    processedDocument.forEach((documentObject) => {
        const { terms } = documentObject;

        for (const term of terms) {
            // eslint-disable-next-line no-param-reassign
            processedTerms = createDocumentTermsFromTerms(typesToAnonymize, processedTerms, documentObject, term, logger);
        }
    });

    return processedTerms;
};

const processDocument = (
    input: string,
    typesToAnonymize: string[],
    stringAnonymizeModifiers: StringAnonymize[],

    logger?: { debug: (...arguments_: any[]) => void },
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
            typesToAnonymize.push(`${modifier}`);
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
