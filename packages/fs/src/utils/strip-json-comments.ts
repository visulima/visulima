// Copyright by https://github.com/swansontec

import { INTERNAL_STRIP_JSON_REGEX } from "../constants";

const stripJsonComments = (jsonString: string, { whitespace = true } = {}): string =>
    // This regular expression translates to:
    //
    //   /quoted-string|line-comment|block-comment/g
    //
    // This means that comment characters inside of strings will match
    // as strings, not comments, so we can just skip the whole string
    // in the replacer function.
    jsonString.replace(INTERNAL_STRIP_JSON_REGEX, (match) => {
        // Skip strings & broken block comments:
        if (match.startsWith('"') || (match[1] === "*" && !match.endsWith("*/"))) {
            return match;
        }

        // Replace comments with whitespace (or not):
        return whitespace ? match.replaceAll(/\S/g, " ") : "";
    });

export default stripJsonComments;
