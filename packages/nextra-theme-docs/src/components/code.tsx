import type { ComponentProps, ReactElement } from "react";

import cn from "../utils/cn";

const Code = ({ children, className = "", ...properties }: ComponentProps<"code">): ReactElement => {
    const hasLineNumbers = "data-line-numbers" in properties;

    return (
        <code
            className={cn(hasLineNumbers ? "[counter-reset:line]" : "", className)}
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
