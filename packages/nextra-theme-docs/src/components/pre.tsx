import cn from "clsx";
import { WordWrapIcon } from "nextra/icons";
import type { ComponentProps, FC, LegacyRef } from "react";
import React, {
    useCallback, useEffect, useRef, useState,
} from "react";

import Button from "./button";
import CopyToClipboard from "./copy-to-clipboard";

const Pre: FC<
ComponentProps<"pre"> & {
    filename?: string;
    value?: string;
}
> = ({
    children, className = "code-block", filename, value, ...properties
}) => {
    const reference = useRef<HTMLPreElement | undefined>();
    const [codeString, setCodeString] = useState<string | undefined>(value);

    const toggleWordWrap = useCallback(() => {
        const htmlDataset = document.documentElement.dataset;
        const hasWordWrap = "nextraWordWrap" in htmlDataset;

        if (hasWordWrap) {
            delete htmlDataset.nextraWordWrap;
        } else {
            htmlDataset.nextraWordWrap = "";
        }
    }, []);

    useEffect(() => {
        if (reference.current !== undefined) {
            const code = reference.current.querySelector("code");

            if (typeof code?.textContent === "string") {
                setCodeString(code.textContent);
            }
        }
    }, [reference]);

    return (
        <>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <pre className={className} ref={reference as LegacyRef<HTMLPreElement> | undefined} {...properties}>
                {filename && (
                    <div className="mt-2 flex space-x-2 text-xs mb-4">
                        <div className="flex h-6 rounded-full bg-gradient-to-r from-sky-400/30 via-sky-400 to-sky-400/30 p-px font-medium text-sky-300">
                            <div className="flex items-center rounded-full px-2.5 bg-slate-800">{filename}</div>
                        </div>
                    </div>
                )}
                {children}
            </pre>
            {/* eslint-disable-next-line max-len */}
            <div
                className={cn([
                    "opacity-0 transition-opacity [div:hover>&]:opacity-100 focus-within:opacity-100",
                    "flex gap-1 absolute m-2 right-0",
                    filename ? "top-10" : "top-0",
                ])}
            >
                <Button tabIndex={-1} onClick={toggleWordWrap} className="md:hidden" title="Toggle word wrap">
                    <WordWrapIcon className="pointer-events-none h-4 w-4" />
                </Button>
                {codeString && <CopyToClipboard tabIndex={-1} value={codeString} />}
            </div>
        </>
    );
};

export default Pre;
