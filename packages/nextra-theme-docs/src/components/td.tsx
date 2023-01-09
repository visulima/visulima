import type { ComponentProps, ReactElement } from "react";

import { cn } from "../utils";

const Td = (properties: ComponentProps<"td">): ReactElement => (
    // eslint-disable-next-line react/jsx-props-no-spreading,max-len
    <td {...properties} className={cn("m-0 border border-gray-300 px-4 py-2 dark:border-gray-600", properties.className)} />
);

export default Td;
