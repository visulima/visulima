import React, { ComponentProps, ReactElement } from "react";

const Code = ({ children, className = "", ...properties }: ComponentProps<"code">): ReactElement => {
    const hasLineNumbers = "data-line-numbers" in properties;
    return (
        <code
            className={[hasLineNumbers ? "[counter-reset:line]" : "", className].join(" ")}
            // always show code blocks in ltr
            dir="ltr"
            {...properties}
        >
            {children}
        </code>
    );
};

export default Code;
