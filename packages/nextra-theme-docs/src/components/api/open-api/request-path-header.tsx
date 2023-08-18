import type { FC } from "react";
import BaseUrlDropdown from "./base-url-dropdown";
import RequestMethodBubble from "./request-method-bubble";
import type { RequestMethods } from "./types";

const RequestPathHeader: FC<{
    /** Array of baseUrls to select from. Dropdown is hidden when there are zero or one options. */
    baseUrls?: string[];

    /** What value of baseUrl the dropdown should show as selected before the user has changed the selection. */
    defaultBaseUrl?: string;

    /** Request method. */
    method: RequestMethods;

    /** Callback when the user changes the baseUrl in the dropdown. */
    onBaseUrlChange: (baseUrl: string) => void;

    /** Path text to show beside the request method bubble. */
    path: string;
}> = ({ baseUrls = undefined, defaultBaseUrl = undefined, method, onBaseUrlChange, path }) => (
    <div className="mb-2 flex items-center space-x-2 text-sm md:text-base">
        <RequestMethodBubble method={method} />
        {baseUrls && <BaseUrlDropdown baseUrls={baseUrls} defaultValue={defaultBaseUrl} onChange={onBaseUrlChange} />}
        <div className="overflow-auto font-mono text-[0.95rem]">
            <p className="inline-block font-semibold text-slate-700 dark:text-slate-100">{path}</p>
        </div>
    </div>
);

export default RequestPathHeader;
