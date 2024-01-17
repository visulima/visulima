import cn from "clsx";
import { WordWrapIcon } from "nextra/icons";
import type { ComponentProps, LegacyRef, ReactElement } from "react";
import { useCallback, useRef } from "react";

import Button from "./button";
import CopyToClipboard from "./copy-to-clipboard";

const Pre = ({
    children,
    classNames = {},
    filename = undefined,
    hasCopyCode = undefined,
    header = undefined,
    ...properties
}: Exclude<
    ComponentProps<"pre"> & {
        classNames?: {
            pre?: string;
            root?: string;
        };
        filename?: string;
        hasCopyCode?: boolean;
        header?: ReactElement;
    },
    "className"
>): ReactElement => {
    const reference = useRef<HTMLPreElement | undefined>();

    const toggleWordWrap = useCallback(() => {
        const htmlDataset = document.documentElement.dataset;
        const hasWordWrap = "nextraWordWrap" in htmlDataset;

        if (hasWordWrap) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete htmlDataset["nextraWordWrap"];
        } else {
            htmlDataset["nextraWordWrap"] = "";
        }
    }, []);

    return (
        <div
            className={cn(
                "nextra-code-block",
                "not-prose overflow-hidden",
                "mt-5 mb-8 first:mt-0 last:mb-0 py-2",
                "bg-gray-800 dark:bg-gray-800/40",
                "shadow-lg dark:shadow-none",
                "dark:ring-1 dark:ring-gray-300/10",
                "rounded-lg overflow-hidden relative",
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                classNames?.root,
            )}
        >
            {filename ? (
                <div className="flex text-xs leading-6 text-slate-400">
                    <div className="flex flex-none items-center border-y border-b-blue-300 border-t-transparent px-4 py-1 text-blue-300">{filename}</div>
                    <div className="flex h-8 flex-auto items-center justify-items-end rounded-tl border border-slate-500/30 bg-slate-700/50 pr-4">
                        <div className="grow" />
                        <Button
                            className="text-slate-500 hover:text-slate-400 lg:hidden"
                            onClick={toggleWordWrap}
                            tabIndex={-1}
                            title="Toggle word wrap"
                            type="button"
                        >
                            <WordWrapIcon className="pointer-events-none size-4" />
                        </Button>
                        {hasCopyCode && (
                            /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                            <CopyToClipboard as="button" getValue={() => reference.current?.querySelector("code")?.textContent ?? ""} tabIndex={-1} />
                        )}
                    </div>
                </div>
            ) : (
                <div
                    className={cn(["opacity-0 transition-opacity [div:hover>&]:opacity-100 focus-within:opacity-100", "flex gap-1 absolute m-2 right-0 z-10"])}
                >
                    <Button className="lg:hidden" onClick={toggleWordWrap} tabIndex={-1} title="Toggle word wrap">
                        <WordWrapIcon className="pointer-events-none size-4" />
                    </Button>
                    {/* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */}
                    {hasCopyCode && <CopyToClipboard getValue={() => reference.current?.querySelector("code")?.textContent ?? ""} tabIndex={-1} />}
                </div>
            )}
            {header}
            <pre
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                className={[classNames?.pre ?? "code-block", "bg-transparent shadow-none my-0 p-4 relative"].join(" ")}
                ref={reference as LegacyRef<HTMLPreElement> | undefined}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
            >
                {children}
            </pre>
        </div>
    );
};

export default Pre;
