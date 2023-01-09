import type { ComponentProps, ReactElement } from "react";

import { cn } from "../utils";

// eslint-disable-next-line react/jsx-props-no-spreading
const Ul = ({ className, ...properties }: ComponentProps<"ul">): ReactElement => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <ul className={cn(className === "contains-task-list" ? "" : "ltr:ml-6 rtl:mr-6 list-disc", "mt-5 first:mt-0", className)} {...properties} />
);

export default Ul;
