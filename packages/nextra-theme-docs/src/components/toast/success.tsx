import type { FC, PropsWithChildren } from "react";

const Success: FC<PropsWithChildren<{ title?: string }>> = ({ children = undefined, title = "Success" }) => (
    <div className="flex w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800">
        <div className="flex w-12 items-center justify-center bg-emerald-500">
            <svg className="h-6 w-6 fill-current text-white" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM16.6667 28.3333L8.33337 20L10.6834 17.65L16.6667 23.6166L29.3167 10.9666L31.6667 13.3333L16.6667 28.3333Z" />
            </svg>
        </div>

        <div className="-mx-3 px-4 py-2">
            <div className="mx-3">
                <span className="font-semibold text-emerald-500 dark:text-emerald-400">{title}</span>
                <p className="text-sm text-gray-600 dark:text-gray-200">{children}</p>
            </div>
        </div>
    </div>
);

export default Success;
