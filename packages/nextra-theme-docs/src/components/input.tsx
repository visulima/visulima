import cn from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef } from "react";

type InputProperties = ComponentProps<"input"> & { suffix?: ReactNode };

const Input = forwardRef<HTMLInputElement, InputProperties>(({ className, suffix, ...properties }, forwardedReference) => (
    <div className="relative flex items-center text-gray-900 contrast-more:text-gray-800 dark:text-gray-300 contrast-more:dark:text-gray-300">
        <input
            ref={forwardedReference}
            spellCheck={false}
            className={cn(
                className,
                "block w-full appearance-none rounded-lg px-3 py-2 transition-colors",
                "text-base leading-tight lg:text-sm",
                "bg-black/[.05] dark:bg-gray-50/10",
                "focus:bg-white dark:focus:bg-dark",
                "placeholder:text-gray-500 dark:placeholder:text-gray-400",
                "contrast-more:border contrast-more:border-current",
            )}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
        />
        {suffix}
    </div>
));

export default Input;
