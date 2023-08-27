import type { Dispatch, FC, SetStateAction } from "react";
import cn from "clsx";
import { useRouter } from "next/router";
import type { HttpMethods } from "oas/dist/rmoas.types";

import type { Server } from "./types";
import { getMethodBgColor, getMethodRingColor, getMethodTextColor } from "./utils/api-playground-colors";
import { useConfig } from "../../../config";
import { renderString } from "../../../utils/render";
import { DEFAULT_LOCALE } from "../../../constants/base";

const RequestHeader: FC<{
    /** What value of url the dropdown should show as selected before the user has changed the selection. */
    defaultValue?: Server | undefined;

    /** Request method. */
    method: HttpMethods;

    /** Callback when the user changes the url in the dropdown. */
    onValueChange: Dispatch<SetStateAction<Server | undefined>>;

    /** Path text to show beside the request method bubble. */
    path: string;

    /** Array of urls to select from. Dropdown is hidden when there are zero or one options. */
    servers?: Server[];
}> = ({ defaultValue = undefined, method, onValueChange, path, servers = undefined }) => {
    const { api } = useConfig();
    const { locale } = useRouter();

    return (
        <div className="mb-2 flex items-center space-x-2 text-sm md:text-base">
            <span
                className={cn(
                    "text-sm font-semibold font-mono leading-6 uppercase px-2.5 py-1 rounded-lg",
                    getMethodBgColor(method),
                    getMethodTextColor(method),
                    getMethodRingColor(method),
                )}
            >
                {method}
            </span>
            {Array.isArray(servers) && servers.length > 0 && (
                <div className="relative -top-px mx-1 inline-flex h-[1.125rem] w-5 cursor-pointer select-none rounded-md border border-slate-400 bg-white align-middle hover:border-slate-400 hover:bg-slate-100 focus:outline-none dark:border-slate-400 dark:bg-slate-700 dark:hover:border-slate-400 dark:hover:bg-slate-600">
                    <select
                        aria-expanded="false"
                        aria-label="Select API base"
                        className="relative inset-0 z-10 w-4 cursor-pointer opacity-0"
                        defaultValue={defaultValue?.url}
                        onChange={(event) => onValueChange(servers.find(({ url }) => url === event.target.value) as Server)}
                    >
                        <option disabled>{renderString(api.request_header.server.content, { locale: locale ?? DEFAULT_LOCALE })}</option>
                        {servers.map(({ description, url }) => (
                            <option key={url}>{url}</option>
                        ))}
                    </select>
                    <svg className="absolute -left-px -top-0.5 rotate-90" fill="none" height="20" width="20">
                        <path
                            className="stroke-slate-700 dark:stroke-slate-100"
                            d="M9 7l3 3-3 3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                        />
                    </svg>
                </div>
            )}
            <div className="w-8/12 font-mono text-[0.95rem] md:w-10/12">
                <p className="block truncate font-semibold text-slate-700 dark:text-slate-100" title={path}>
                    {path}
                </p>
            </div>
        </div>
    );
};

export default RequestHeader;
