import type { ComponentProps, ReactElement } from "react";

import { cn } from "../utils";

const Th = (properties: ComponentProps<"th">): ReactElement => (
    // eslint-disable-next-line react/jsx-props-no-spreading,max-len,react/destructuring-assignment
    <th {...properties} className={cn("m-0 border border-gray-300 px-4 py-2 font-semibold dark:border-gray-600", properties.className)} />
);

export default Th;
