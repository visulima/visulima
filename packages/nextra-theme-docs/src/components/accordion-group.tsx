import type { FC, ReactNode } from "react";

import cn from "../utils/cn";

const AccordionGroup: FC<{ children: ReactNode; styleType?: "flushed" | "rounded" }> = ({ children, styleType = "rounded" }) => (
    <div
        className={cn(
            "[&>div>button]:border-0 [&>div>div]:border-0 [&>div>div]:border-t [&>div>button]:rounded-none [&>div>button]:rounded-none [&>div]:mb-0",
            "overflow-hidden mt-0 mb-3 divide-y dark:divide-gray-800/50 divide-inherit",
            {
                "border dark:border-gray-800/50 rounded-md": styleType === "rounded",
                "border-0": styleType === "flushed",
            },
        )}
        role="list"
    >
        {children}
    </div>
);

export default AccordionGroup;
