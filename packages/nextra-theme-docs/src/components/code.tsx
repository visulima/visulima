import React, { ComponentProps, FC } from "react";

const Code: FC<ComponentProps<"code">> = ({ children, className = "", ...properties }) => {
    const hasLineNumbers = "data-line-numbers" in properties;

    return (
        <code
            className={[hasLineNumbers ? "[counter-reset:line]" : "", className].join(" ")}
            // always show code blocks in ltr
            dir="ltr"
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
        >
            {children}
        </code>
    );
};

export default Code;
