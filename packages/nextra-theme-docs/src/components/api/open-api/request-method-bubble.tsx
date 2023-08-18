import cn from "clsx";

import type { FC } from "react";
import { getMethodBgColor } from "../../../utils/api-playground-colors";
import type { RequestMethods } from "./types";

const RequestMethodBubble: FC<{ method: RequestMethods }> = ({ method }) => (
    <span className={cn("text-md font-semibold uppercase px-2.5 py-1 rounded-lg text-white", getMethodBgColor(method))}>{method}</span>
);

export default RequestMethodBubble;
