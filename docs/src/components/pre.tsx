import cn from "clsx";
import { WordWrapIcon } from "nextra/icons";
import type { ComponentProps, ReactElement } from "react";
import React, { useCallback } from "react";

import Button from "./button";
import CopyToClipboard from "./copy-to-clipboard";

const Pre = ({
    children,
    className = "",
    value,
    filename,
    ...properties
}: ComponentProps<"pre"> & {
    filename?: string;
    value?: string;
}): ReactElement => {
    const toggleWordWrap = useCallback(() => {
        const htmlDataset = document.documentElement.dataset;
        const hasWordWrap = "nextraWordWrap" in htmlDataset;
        if (hasWordWrap) {
            delete htmlDataset.nextraWordWrap;
        } else {
            htmlDataset.nextraWordWrap = "";
        }
    }, []);

    return (
        <>
            <pre className={className} {...properties}>
                {/* <svg aria-hidden="true" viewBox="0 0 42 10" fill="none" className="h-2.5 w-auto stroke-slate-500/75 mb-3"><circle cx="5" cy="5" r="4.5"></circle><circle cx="21" cy="5" r="4.5"></circle><circle cx="37" cy="5" r="4.5"></circle></svg> */}
                {filename && (
                    <div className="mt-2 flex space-x-2 text-xs mb-4">
                        <div className="flex h-6 rounded-full bg-gradient-to-r from-sky-400/30 via-sky-400 to-sky-400/30 p-px font-medium text-sky-300">
                            <div className="flex items-center rounded-full px-2.5 bg-slate-800">{filename}</div>
                        </div>
                    </div>
                )}
                {children}
            </pre>
            <div className={cn(["opacity-0 transition-opacity [div:hover>&]:opacity-100", "flex gap-1 absolute m-2 right-0", filename ? "top-10" : "top-0"])}>
                <Button tabIndex={-1} onClick={toggleWordWrap} className="md:hidden" title="Toggle word wrap">
                    <WordWrapIcon className="pointer-events-none h-4 w-4" />
                </Button>
                {value && <CopyToClipboard tabIndex={-1} value={value} />}
            </div>
        </>
    );
};

export default Pre;
