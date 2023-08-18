import type { FC } from "react";
import { renderString } from "../../../../utils/render";
import type { Config } from "../../../../contexts/config";

const InputDropdown: FC<{
    config: Config;
    locale: string;
    onInputChange: (newValue: string) => void;
    options: string[];
    value: string | undefined;
}> = ({ config, locale, onInputChange, options, value }) => (
    <div className="relative">
        <select
            className="w-full cursor-pointer rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800/40 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-zinc-800"
            onChange={(event) => onInputChange(event.target.value)}
            // We use || instead of ?? because the default value passed to
            // ApiPlayground is an empty string instead of undefined
            value={value ?? "Select"}
        >
            <option disabled>{renderString(config.api.select.content, { locale })}</option>
            {options.map((option) => (
                <option key={option}>{option}</option>
            ))}
        </select>
    </div>
);

export default InputDropdown;
