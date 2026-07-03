/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";
import { useState } from "preact/hooks";

interface SwitchProps extends Omit<JSX.ButtonHTMLAttributes, "onChange"> {
    checked?: boolean;
    class?: string;
    defaultChecked?: boolean;
    disabled?: boolean;
    id?: string;
    onCheckedChange?: (checked: boolean) => void;
}

const Switch = ({ checked, class: className, defaultChecked, disabled, id, onCheckedChange, ...rest }: SwitchProps): JSX.Element => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
    const isChecked = isControlled ? checked : internalChecked;

    const handleClick = (): void => {
        if (disabled) {
            return;
        }

        const next = !isChecked;

        if (!isControlled) {
            setInternalChecked(next);
        }

        onCheckedChange?.(next);
    };

    return (
        <button
            aria-checked={isChecked}
            class={clsx(
                "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-none border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                isChecked ? "bg-primary" : "bg-input",
                className,
            )}
            data-state={isChecked ? "checked" : "unchecked"}
            disabled={disabled}
            id={id}
            onClick={handleClick}
            role="switch"
            type="button"
            {...rest}
        >
            <span
                class={clsx(
                    "pointer-events-none block h-4 w-4 rounded-none bg-background shadow-lg ring-0 transition-transform",
                    isChecked ? "translate-x-4" : "translate-x-0",
                )}
                data-state={isChecked ? "checked" : "unchecked"}
            />
        </button>
    );
};

export default Switch;
