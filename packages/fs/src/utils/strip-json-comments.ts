// Copyright by https://github.com/swansontec

const stripJsonComments = (jsonString: string, { whitespace = true } = {}): string =>
    // This regular expression translates to:
    //
    //   /quoted-string|line-comment|block-comment/g
    //
    // This means that comment characters inside of strings will match
    // as strings, not comments, so we can just skip the whole string
    // in the replacer function.
    // eslint-disable-next-line unicorn/prefer-string-replace-all,@typescript-eslint/no-use-before-define
    jsonString.replace(INTERNAL_STRIP_JSON_REGEX, (match) => {
        // Skip strings & broken block comments:
        if (match.startsWith('"') || (match[1] === "*" && !match.endsWith("*/"))) {
            return match;
        }

        // Replace comments with whitespace (or not):
        return whitespace ? match.replaceAll(/\S/g, " ") : "";
    });

export const INTERNAL_STRIP_JSON_REGEX = /"(?:[^"\\]|\\.)*"?|\/\/[^\r\n]*|\/\*(?:[^*]|\*[^/])*(?:\*\/)?/g;

export default stripJsonComments;
