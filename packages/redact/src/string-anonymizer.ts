import nlp from "compromise";

import type { AnonymizeType } from "./patterns";
import { regexPatterns } from "./patterns";

interface IDocumentTerm {
    start: number;
    tag: string;
    text: string;
}
const maskText = (maskMaps: Record<string, Map<string, string>>, text: string, tag: string): string => {
    const lowerCaseTag = tag.toLowerCase();

    if (!maskMaps[lowerCaseTag]) {
        maskMaps[lowerCaseTag] = new Map<string, string>();
    }

    const { size } = maskMaps[lowerCaseTag] as Map<string, string>;

    const maskedValue = `<${tag.toUpperCase()}${size > 0 ? size : ""}>`;

    (maskMaps[lowerCaseTag] as Map<string, string>).set(text, maskedValue);

    return (maskMaps[lowerCaseTag] as Map<string, string>).get(text) as string;
};

const replaceWithMasks = (typesToAnonymize: AnonymizeType[], documentTerms: IDocumentTerm[], output: string): string => {
    const maskMaps: Record<string, Map<string, string>> = {};

    typesToAnonymize.forEach((type) => {
        maskMaps[type] = new Map<string, string>();
    });

    let outputRes = output;

    documentTerms.forEach((term) => {
        const { tag, text } = term;
        const mask = maskText(maskMaps, text, tag);

        outputRes = outputRes.replace(text, mask);
    });

    return outputRes;
};

const createDocumentTermsFromTerms = (typesToAnonymize: AnonymizeType[], processedTerms: IDocumentTerm[], documentObject: any, term: any): IDocumentTerm[] => {
    const reversedTags = term.tags.reverse();
    const foundTag = reversedTags.find((tag: string) => typesToAnonymize.includes(tag.toLowerCase() as any));

    if (foundTag) {
        processedTerms.push({ start: documentObject.offset.start, tag: foundTag, text: term.text });
    }

    return processedTerms;
};

const createUniqueAndSortedTerms = (processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    const uniqueProcessedTerms = [...processedTerms.reduce((map, term) => map.set(term.text + term.start + term.tag, term), new Map()).values()];

    return uniqueProcessedTerms.sort((a, b) => {
        const startDiff = a.start - b.start;

        if (startDiff !== 0) {
            return startDiff;
        }

        return b.text.length - a.text.length;
    });
};

const processWithRegex = (typesToAnonymize: AnonymizeType[], input: string, processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
    const filteredRegexPatterns = regexPatterns.filter((ptrn) => typesToAnonymize.includes(ptrn.key as any));

    filteredRegexPatterns.forEach((ptrn) => {
        const { key, regex } = ptrn;
        const rx = new RegExp(regex, "giu");

        let match;

        while ((match = rx.exec(input)) !== null) {
            processedTerms.push({
                start: match.index,
                tag: key,
                text: match[0],
            });
        }
    });

    return processedTerms;
};

const processTerms = (typesToAnonymize: AnonymizeType[], input: string, processedTerms: IDocumentTerm[]): IDocumentTerm[] => {
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

        terms.forEach((term: any) => {
            processedTerms = createDocumentTermsFromTerms(typesToAnonymize, processedTerms, documentObject, term);
        });
    });

    return processedTerms;
};

const processDocument = (input: string, typesToAnonymize: AnonymizeType[]): IDocumentTerm[] => {
    let processedTerms: IDocumentTerm[] = [];

    processedTerms = processTerms(typesToAnonymize, input, processedTerms);
    processedTerms = processWithRegex(typesToAnonymize, input, processedTerms);

    return createUniqueAndSortedTerms(processedTerms);
};

export const stringAnonymize = (input: string, typesToExclude: AnonymizeType[] = []): string => {
    const typesToAnonymize: AnonymizeType[] = (
        [
            "apikey",
            "awsid",
            "awskey",
            "bankcc",
            "basic_auth",
            "creditcard",
            "crypto",
            "date",
            "domain",
            "email",
            "firstname",
            "id",
            "ip",
            "isbn",
            "lastname",
            "mac_address",
            "money",
            "organization",
            "passport",
            "phonenumber",
            "routing",
            "ssn",
            "time",
            "token",
            "uk_nin",
            "url",
            "us_social_security",
            "zip_code",
        ] as AnonymizeType[]
    ).filter((type) => !typesToExclude.includes(type as AnonymizeType));

    let output = input;

    const documentTerms = processDocument(input, typesToAnonymize);

    output = replaceWithMasks(typesToAnonymize, documentTerms, output);

    return output;
};
