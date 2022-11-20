import { CheckIcon, CopyIcon } from "nextra/icons";
import type { ComponentProps, ReactElement } from "react";
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import Button from "./button";
import ErrorToast from "./toast/error";
import SuccessToast from "./toast/success";

const CopyToClipboard = ({
    value,
    ...properties
}: {
    value: string;
} & ComponentProps<"button">): ReactElement => {
    const [isCopied, setCopied] = useState(false);

    useEffect(() => {
        if (!isCopied) {
            return;
        }

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
            toast.custom(<ErrorToast>Access to clipboard rejected!</ErrorToast>, { id: "copy-to-clipboard", position: "bottom-right" });
        }

        try {
            await navigator.clipboard.writeText(JSON.parse(value));

            toast.custom(<SuccessToast title="Page URL copied to clipboard">Paste it wherever you like it.</SuccessToast>, { id: "copy-to-clipboard", position: "bottom-right" });
        } catch {
            toast.custom(<ErrorToast>Failed to copy to clipboard</ErrorToast>, { id: "copy-to-clipboard", position: "bottom-right" });
        }
    }, [value]);

    const IconToUse = isCopied ? CheckIcon : CopyIcon;

    return (
        <Button onClick={handleClick} title="Copy code" {...properties}>
            <IconToUse className="pointer-events-none h-4 w-4" />
        </Button>
    );
};

export default CopyToClipboard;
