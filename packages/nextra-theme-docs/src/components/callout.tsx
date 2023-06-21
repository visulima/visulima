import cn from "clsx";
import type { ReactElement, ReactNode } from "react";

const defaultIconClassName = "flex-none w-4 h-4 mt-1 mr-1";

const icons = {
    default: (
        <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(defaultIconClassName, "text-zinc-400 dark:text-zinc-300 mt-1.5")}
            aria-label="Info"
        >
            <path d="M8 0C3.58125 0 0 3.58125 0 8C0 12.4187 3.58125 16 8 16C12.4187 16 16 12.4187 16 8C16 3.58125 12.4187 0 8 0ZM8 14.5C4.41563 14.5 1.5 11.5841 1.5 8C1.5 4.41594 4.41563 1.5 8 1.5C11.5844 1.5 14.5 4.41594 14.5 8C14.5 11.5841 11.5844 14.5 8 14.5ZM9.25 10.5H8.75V7.75C8.75 7.3375 8.41563 7 8 7H7C6.5875 7 6.25 7.3375 6.25 7.75C6.25 8.1625 6.5875 8.5 7 8.5H7.25V10.5H6.75C6.3375 10.5 6 10.8375 6 11.25C6 11.6625 6.3375 12 6.75 12H9.25C9.66406 12 10 11.6641 10 11.25C10 10.8359 9.66563 10.5 9.25 10.5ZM8 6C8.55219 6 9 5.55219 9 5C9 4.44781 8.55219 4 8 4C7.44781 4 7 4.44687 7 5C7 5.55313 7.44687 6 8 6Z" />
        </svg>
    ),
    error: (
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={cn(defaultIconClassName, "text-red-400 dark:text-red-300")}>
            <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12zm5.793-4.207a1 1 0 0 1 1.414 0L12 10.586l2.793-2.793a1 1 0 1 1 1.414 1.414L13.414 12l2.793 2.793a1 1 0 0 1-1.414 1.414L12 13.414l-2.793 2.793a1 1 0 0 1-1.414-1.414L10.586 12 7.793 9.207a1 1 0 0 1 0-1.414z" />
        </svg>
    ),
    info: (
        <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(defaultIconClassName, "text-sky-500 mt-1.5")}
            aria-label="Info"
        >
            <path d="M8 0C3.58125 0 0 3.58125 0 8C0 12.4187 3.58125 16 8 16C12.4187 16 16 12.4187 16 8C16 3.58125 12.4187 0 8 0ZM8 14.5C4.41563 14.5 1.5 11.5841 1.5 8C1.5 4.41594 4.41563 1.5 8 1.5C11.5844 1.5 14.5 4.41594 14.5 8C14.5 11.5841 11.5844 14.5 8 14.5ZM9.25 10.5H8.75V7.75C8.75 7.3375 8.41563 7 8 7H7C6.5875 7 6.25 7.3375 6.25 7.75C6.25 8.1625 6.5875 8.5 7 8.5H7.25V10.5H6.75C6.3375 10.5 6 10.8375 6 11.25C6 11.6625 6.3375 12 6.75 12H9.25C9.66406 12 10 11.6641 10 11.25C10 10.8359 9.66563 10.5 9.25 10.5ZM8 6C8.55219 6 9 5.55219 9 5C9 4.44781 8.55219 4 8 4C7.44781 4 7 4.44687 7 5C7 5.55313 7.44687 6 8 6Z" />
        </svg>
    ),
    warning: (
        <svg
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            className={cn(defaultIconClassName, "text-amber-400 dark:text-amber-300/80")}
            aria-label="Warning"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
        </svg>
    ),
    tip: (
        <svg
            width="11"
            height="14"
            viewBox="0 0 11 14"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(defaultIconClassName, "text-green-600 dark:text-green-400/80")}
            aria-label="Tip"
        >
            <path d="M3.12794 12.4232C3.12794 12.5954 3.1776 12.7634 3.27244 12.907L3.74114 13.6095C3.88471 13.8248 4.21067 14 4.46964 14H6.15606C6.41415 14 6.74017 13.825 6.88373 13.6095L7.3508 12.9073C7.43114 12.7859 7.49705 12.569 7.49705 12.4232L7.50055 11.3513H3.12521L3.12794 12.4232ZM5.31288 0C2.52414 0.00875889 0.5 2.26889 0.5 4.78826C0.5 6.00188 0.949566 7.10829 1.69119 7.95492C2.14321 8.47011 2.84901 9.54727 3.11919 10.4557C3.12005 10.4625 3.12175 10.4698 3.12261 10.4771H7.50342C7.50427 10.4698 7.50598 10.463 7.50684 10.4557C7.77688 9.54727 8.48281 8.47011 8.93484 7.95492C9.67728 7.13181 10.1258 6.02703 10.1258 4.78826C10.1258 2.15486 7.9709 0.000106649 5.31288 0ZM7.94902 7.11267C7.52078 7.60079 6.99082 8.37878 6.6077 9.18794H4.02051C3.63739 8.37878 3.10743 7.60079 2.67947 7.11294C2.11997 6.47551 1.8126 5.63599 1.8126 4.78826C1.8126 3.09829 3.12794 1.31944 5.28827 1.3126C7.2435 1.3126 8.81315 2.88226 8.81315 4.78826C8.81315 5.63599 8.50688 6.47551 7.94902 7.11267ZM4.87534 2.18767C3.66939 2.18767 2.68767 3.16939 2.68767 4.37534C2.68767 4.61719 2.88336 4.81288 3.12521 4.81288C3.36705 4.81288 3.56274 4.61599 3.56274 4.37534C3.56274 3.6515 4.1515 3.06274 4.87534 3.06274C5.11719 3.06274 5.31288 2.86727 5.31288 2.62548C5.31288 2.38369 5.11599 2.18767 4.87534 2.18767Z" />
        </svg>
    ),
    check: (
        <svg
            className={cn(defaultIconClassName, "text-green-600 dark:text-green-400/80")}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 448 512"
            aria-label="Check"
        >
            <path d="M438.6 105.4C451.1 117.9 451.1 138.1 438.6 150.6L182.6 406.6C170.1 419.1 149.9 419.1 137.4 406.6L9.372 278.6C-3.124 266.1-3.124 245.9 9.372 233.4C21.87 220.9 42.13 220.9 54.63 233.4L159.1 338.7L393.4 105.4C405.9 92.88 426.1 92.88 438.6 105.4H438.6z" />
        </svg>
    ),
};

type CalloutType = keyof typeof icons;

const classes: Record<CalloutType, string> = {
    default: "border-zinc-500/20 bg-zinc-50/50 dark:bg-zinc-900 dark:border-zinc-500/30 dark:bg-zinc-500/10",
    error: "border-red-200 bg-red-100 text-red-900 dark:border-red-200/30 dark:bg-red-900/30 dark:text-red-200",
    info: "border-sky-500/20 bg-sky-50/50 dark:border-sky-500/30 dark:bg-sky-500/10",
    warning: "border border-amber-500/20 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10",
    check: "border-emerald-500/20 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    tip: "border-emerald-500/20 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
};

type CalloutProperties = {
    type?: CalloutType;
    icon?: ReactElement | string;
    children: ReactNode;
};

const Callout = ({ children, type = "default", icon = icons[type] }: CalloutProperties): ReactElement => (
    <div
        className={cn(
            "nextra-callout overflow-x-auto my-6 flex rounded-lg border py-2 ltr:pr-4 rtl:pl-4",
            "contrast-more:border-current contrast-more:dark:border-current",
            classes[type],
        )}
    >
        <div className="mt-0.5 select-none text-xl ltr:pl-3 ltr:pr-2 rtl:pl-2 rtl:pr-3">{icon}</div>
        <div className="w-full min-w-0 leading-7">{children}</div>
    </div>
);

export default Callout;
