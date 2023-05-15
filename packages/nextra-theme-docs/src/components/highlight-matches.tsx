import { Fragment, memo } from "react";

type MatchArguments = {
    value?: string;
    match: string;
};

const HighlightMatches = memo<MatchArguments>(({ value, match }: MatchArguments) => {
    const splitText = value ? [...value] : [];
    const escapedSearch = match.trim().replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
    const regexp = new RegExp(`(${escapedSearch.replaceAll(" ", "|")})`, "ig");

    let regexpResult;
    let id = 0;
    let index = 0;

    const result = [];

    if (typeof value === "string") {
        // eslint-disable-next-line no-cond-assign
        while ((regexpResult = regexp.exec(value)) !== null) {
            id += 1;

            result.push(
                <Fragment key={id}>
                    {splitText.splice(0, regexpResult.index - index).join("")}
                    <span className="text-primary-600">{splitText.splice(0, regexp.lastIndex - regexpResult.index).join("")}</span>
                </Fragment>,
            );

            index = regexp.lastIndex;
        }
    }

    return (
        <>
            {result}
            {splitText.join("")}
        </>
    );
});

export default HighlightMatches;
