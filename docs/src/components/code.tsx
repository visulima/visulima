import React, { ComponentProps, ReactElement } from "react";

const Code = ({ children, className = "", ...props }: ComponentProps<"code">): ReactElement => {
    const hasLineNumbers = "data-line-numbers" in props;
    return (
        <code
            className={[
                hasLineNumbers ? "[counter-reset:line]" : "",
                className,
            ].join(" ")}
            // always show code blocks in ltr
            dir="ltr"
            {...props}
        >
            {children}
        </code>
    );
};

export default Code;
