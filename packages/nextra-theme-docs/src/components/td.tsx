import type { ComponentProps, FC } from "react";

import { cn } from "../utils";

const Td: FC<ComponentProps<"td">> = ({ className, ...properties }) => (
    // eslint-disable-next-line react/jsx-props-no-spreading,max-len
    <td {...properties} className={cn("m-0 border border-gray-300 px-4 py-2 dark:border-gray-600", className)} />
);

export default Td;
