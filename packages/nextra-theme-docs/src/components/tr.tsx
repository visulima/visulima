import type { ComponentProps, ReactElement } from "react";

import { cn } from "../utils";

const Tr = (properties: ComponentProps<"tr">): ReactElement => (
    <tr
         // eslint-disable-next-line react/jsx-props-no-spreading
        {...properties}
         // eslint-disable-next-line max-len,react/destructuring-assignment
        className={cn("m-0 border-t border-gray-300 p-0 dark:border-gray-600 ", "even:bg-gray-100 even:dark:bg-gray-600/20", properties.className)}
    />
);

export default Tr;
