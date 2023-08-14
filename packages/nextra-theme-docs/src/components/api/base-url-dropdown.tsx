import type { FC } from "react";

const BaseUrlDropdown: FC<{
    /** Array of base URLs to select from. Component is hidden when the array is empty or only has one value. */
    baseUrls: string[];

    /** Initially selected base URL. */
    defaultValue: string | undefined;

    /** Function called when the user selects a different base URL. */
    onChange: (baseUrl: string) => void;
}> = ({ baseUrls, defaultValue, onChange }) => {
    if (!Array.isArray(baseUrls) || baseUrls.length <= 1) {
        return null;
    }

    return (
        <div className="relative -top-px mx-1 inline-flex h-[1.125rem] w-5 cursor-pointer select-none rounded-md border border-slate-400 bg-white align-middle hover:border-slate-400 hover:bg-slate-100 focus:outline-none dark:border-slate-400 dark:bg-slate-700 dark:hover:border-slate-400 dark:hover:bg-slate-600">
            <select
                aria-expanded="false"
                aria-label="Select API base"
                className="absolute inset-0 z-10 cursor-pointer opacity-0"
                defaultValue={defaultValue}
                onChange={(e) => onChange(e.target.value)}
            >
                <option disabled>Select API base</option>
                {baseUrls.map((baseUrl) => (
                    <option key={baseUrl}>{baseUrl}</option>
                ))}
            </select>
            <svg className="absolute -left-px -top-0.5 rotate-90" fill="none" height="20" width="20">
                <path className="stroke-slate-700 dark:stroke-slate-100" d="M9 7l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            </svg>
        </div>
    );
};

export default BaseUrlDropdown;
