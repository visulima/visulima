import escapeStringRegexp from "escape-string-regexp";
import type { ReactElement, ReactNode } from "react";
import { memo } from "react";

interface MatchArguments {
    match: string;
    // eslint-disable-next-line react/require-default-props
    value?: string;
}

const HighlightMatches = memo<MatchArguments>(({ match, value }: MatchArguments): ReactElement | null => {
    if (!value) {
        return null;
    }
    const splitText = [...value];
    const escapedSearch: string = escapeStringRegexp(match.trim()) as string;
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    const regexp = new RegExp(escapedSearch.replaceAll(" ", "|"), "gi");
    let result;
    let index = 0;
    const content: (ReactNode | string)[] = [];

    while (
        (result = regexp.exec(value)) &&
        // case `>  ` replaced previously to `>||` + some character provoke memory leak because
        // `RegExp#exec` will always return a match
        regexp.lastIndex !== 0
    ) {
        const before = splitText.splice(0, result.index - index).join("");
        const after = splitText.splice(0, regexp.lastIndex - result.index).join("");
        content.push(
            before,
            <span className="text-primary-600" key={result.index}>
                {after}
            </span>,
        );
        index = regexp.lastIndex;
    }

    return (
        <>
            {content}
            {splitText.join("")}
        </>
    );
});

export default HighlightMatches;
