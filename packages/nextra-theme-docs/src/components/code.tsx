import type { ComponentProps, FC } from "react";

import { cn } from "../utils";

const Code: FC<ComponentProps<"code">> = ({ children, className = "", ...properties }) => {
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
