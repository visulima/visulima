import { clsx } from "clsx";

import { getMethodBgColor } from "../../utils/api-playground-colors";
import type { RequestMethods } from "./types";

const RequestMethodBubble = ({ method }: { method: RequestMethods }) => (
    <span className={clsx("inline-block rounded-md px-1.5 text-[0.95rem] font-bold text-white", getMethodBgColor(method))}>{method}</span>
);

export default RequestMethodBubble;
