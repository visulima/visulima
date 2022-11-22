import type { ComponentProps, ReactElement } from "react";
import React, { useCallback, useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "nextra/icons";
import Button from "./button";

export const CopyToClipboard = ({
    value,
    ...props
}: {
    value: string;
} & ComponentProps<"button">): ReactElement => {
    const [isCopied, setCopied] = useState(false);

    useEffect(() => {
        if (!isCopied) return;
        const timerId = setTimeout(() => {
            setCopied(false);
        }, 2000);

        return () => {
            clearTimeout(timerId);
        };
    }, [isCopied]);

    const handleClick = useCallback<NonNullable<ComponentProps<"button">["onClick"]>>(async () => {
        setCopied(true);
        if (!navigator?.clipboard) {
            console.error("Access to clipboard rejected!");
        }
        try {
            await navigator.clipboard.writeText(JSON.parse(value));
        } catch {
            console.error("Failed to copy!");
        }
    }, [value]);

    const IconToUse = isCopied ? CheckIcon : CopyIcon;

    return (
        <Button onClick={handleClick} title="Copy code" {...props}>
            <IconToUse className="pointer-events-none h-4 w-4" />
        </Button>
    );
};
