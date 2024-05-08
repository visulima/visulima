import nlp from "compromise";

import type { Modifiers, StringAnonymize } from "./types";

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

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const type of typesToAnonymize) {
        // eslint-disable-next-line security/detect-object-injection
        maskMaps[type] = new Map<string, string>();
    }

    let outputResult = output;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const term of documentTerms) {
        const { tag, text } = term;
        const mask = maskText(maskMaps, text, tag);

        outputResult = outputResult.replace(text, mask);
    }

    return outputResult;
};

const createDocumentTermsFromTerms = (typesToAnonymize: string[], processedTerms: IDocumentTerm[], documentObject: any, term: any): IDocumentTerm[] => {
    const reversedTags = term.tags.reverse();
    // logger?.debug(`reversedTags: ${JSON.stringify(reversedTags)}`);
    const foundTag = reversedTags.find((tag: string) => typesToAnonymize.includes(tag.toLowerCase() as any));
    // logger?.debug(`foundTag: ${foundTag}`);

    if (foundTag) {
        processedTerms.push({ start: documentObject.offset.start, tag: foundTag, text: term.text });
    }

    return processedTerms;
};

const createUniqueAndSortedTerms = (processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    // eslint-disable-next-line unicorn/no-array-reduce
    const uniqueProcessedTerms = [...processedTerms.reduce((map, term) => map.set(term.text + term.start + term.tag, term), new Map()).values()];

    // eslint-disable-next-line etc/no-assign-mutated-array,@typescript-eslint/no-unsafe-return
    return uniqueProcessedTerms.sort((a, b) => {
        const startDiff = a.start - b.start;

        if (startDiff !== 0) {
            return startDiff;
        }

        return b.text.length - a.text.length;
    });
};

const processWithRegex = (stringAnonymizeModifiers: StringAnonymize[], input: string, processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const modifier of stringAnonymizeModifiers) {
        const { key, pattern } = modifier;

        // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
        const rx = new RegExp(pattern, "giu");

        let match;

        // eslint-disable-next-line no-loops/no-loops,no-cond-assign
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

const processTerms = (typesToAnonymize: string[], input: string, processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const document_ = nlp(input);

    const processedDocument = [
        ...document_.emails().out("offset"),
        ...document_.money().out("offset"),
        ...document_.organizations().out("offset"),
        ...document_.people().out("offset"),
        ...document_.phoneNumbers().out("offset"),
    ];

    processedDocument.forEach((documentObject) => {
        const { terms } = documentObject;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const term of terms) {
            // eslint-disable-next-line no-param-reassign
            processedTerms = createDocumentTermsFromTerms(typesToAnonymize, processedTerms, documentObject, term);
        }
    });

    return processedTerms;
};

const processDocument = (input: string, typesToAnonymize: string[], stringAnonymizeModifiers: StringAnonymize[]): IDocumentTerm[] => {
    let processedTerms: IDocumentTerm[] = [];

    processedTerms = processTerms(typesToAnonymize, input, processedTerms);
    processedTerms = processWithRegex(stringAnonymizeModifiers, input, processedTerms);

    return createUniqueAndSortedTerms(processedTerms);
};

export const stringAnonymize = (input: string, modifiers: Modifiers, logger?: { debug: (...arguments_: any[]) => void }): string => {
    const patternModifiers = modifiers.filter((modifier) => typeof modifier === "object" && modifier.pattern) as StringAnonymize[];
    const typesToAnonymize = modifiers.map((modifier) => (typeof modifier === "string" ? modifier : modifier.key));

    let output = input;

    const documentTerms = processDocument(input, typesToAnonymize, patternModifiers);

    output = replaceWithMasks(typesToAnonymize, documentTerms, output);

    return output;
};
