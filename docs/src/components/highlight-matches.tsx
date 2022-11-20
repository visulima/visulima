import React, { Fragment, memo } from "react";

type MatchArguments = {
    value?: string;
    match: string;
};

const HighlightMatches = memo<MatchArguments>(({ value, match }: MatchArguments) => {
    const splitText = value ? value.split("") : [];
    const escapedSearch = match.trim().replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
    const regexp = new RegExp(`(${escapedSearch.replaceAll(" ", "|")})`, "ig");

    let result;
    let id = 0;
    let index = 0;

    const result_ = [];

    if (value) {
        while ((result = regexp.exec(value)) !== null) {
            id += 1;

            result_.push(
                <Fragment key={id}>
                    {splitText.splice(0, result.index - index).join("")}
                    <span className="text-primary-500">{splitText.splice(0, regexp.lastIndex - result.index).join("")}</span>
                </Fragment>,
            );

            index = regexp.lastIndex;
        }
    }

    return (
        <>
            {result_}
            {splitText.join("")}
        </>
    );
});

export default HighlightMatches;
