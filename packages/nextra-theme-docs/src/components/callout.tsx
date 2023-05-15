import cn from "clsx";
import { InformationCircleIcon } from "nextra/icons";
import type { ReactElement, ReactNode } from "react";

const TypeToEmoji = {
    default: "💡",
    error: "🚫",
    info: <InformationCircleIcon className="mt-1" />,
    warning: "⚠️",
};

type CalloutType = keyof typeof TypeToEmoji;

const classes: Record<CalloutType, string> = {
    default: cn("border-orange-100 bg-orange-50 text-orange-800 dark:border-orange-400/30 dark:bg-orange-400/20 dark:text-orange-300"),
    error: cn("border-red-200 bg-red-100 text-red-900 dark:border-red-200/30 dark:bg-red-900/30 dark:text-red-200"),
    info: cn("border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-200/30 dark:bg-blue-900/30 dark:text-blue-200"),
    warning: cn("border-yellow-100 bg-yellow-50 text-yellow-900 dark:border-yellow-200/30 dark:bg-yellow-700/30 dark:text-yellow-200"),
};

type CalloutProperties = {
    type?: CalloutType;
    emoji?: ReactElement | string;
    children: ReactNode;
};

const Callout = ({ children, type = "default", emoji = TypeToEmoji[type] }: CalloutProperties): ReactElement => (
    <div
        className={cn(
            "nextra-callout mt-6 flex rounded-lg border py-2 ltr:pr-4 rtl:pl-4",
            "contrast-more:border-current contrast-more:dark:border-current",
            classes[type],
        )}
    >
        <div
            className="select-none text-xl ltr:pl-3 ltr:pr-2 rtl:pl-2 rtl:pr-3"
            style={{
                fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            }}
        >
            {emoji}
        </div>
        <div className="min-w-0">{children}</div>
    </div>
);

export default Callout;
