import type { FC } from "react";

const DownArrowSvg = () => (
    <svg
        className="pointer-events-none absolute right-2 top-[7px] h-3 fill-slate-500 dark:fill-slate-400"
        viewBox="0 0 384 512"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M192 384c-8.188 0-16.38-3.125-22.62-9.375l-160-160c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0L192 306.8l137.4-137.4c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25l-160 160C208.4 380.9 200.2 384 192 384z" />
    </svg>
);

const InputDropdown: FC<{
    onInputChange: (newValue: string) => void;
    options: string[];
    value: string | undefined;
}> = ({ onInputChange, options, value }) => (
    <div className="relative">
        <select
            className="dark:bg-dark-input w-full cursor-pointer rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-zinc-800"
            onChange={(event) => onInputChange(event.target.value)}
            // We use || instead of ?? because the default value passed to
            // ApiPlayground is an empty string instead of undefined
            value={value ?? "Select"}
        >
            <option disabled>Select</option>
            {options.map((option) => (
                <option key={option}>{option}</option>
            ))}
        </select>
        <DownArrowSvg />
    </div>
);

export default InputDropdown;
