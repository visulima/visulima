import { CheckIcon, CopyIcon } from "nextra/icons";
import type { ComponentProps, ReactElement } from "react";
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import Button from "./button";
import ErrorToast from "./toast/error";
import SuccessToast from "./toast/success";

const toastId = "copy-to-clipboard";
const toastPosition = "bottom-right";

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

        // eslint-disable-next-line consistent-return
        return () => {
            clearTimeout(timerId);
        };
    }, [isCopied]);

    const handleClick = useCallback<NonNullable<ComponentProps<"button">["onClick"]>>(async () => {
        setCopied(true);

        // eslint-disable-next-line radar/no-duplicate-string
        if (!navigator?.clipboard) {
            toast.custom(<ErrorToast>Access to clipboard rejected!</ErrorToast>, { id: toastId, position: toastPosition });
        }

        try {
            await navigator.clipboard.writeText(JSON.parse(value));

            toast.custom(<SuccessToast title="Page URL copied to clipboard">Paste it wherever you like it.</SuccessToast>, {
                id: toastId,
                position: toastPosition,
            });
        } catch {
            toast.custom(<ErrorToast>Failed to copy to clipboard</ErrorToast>, { id: toastId, position: toastPosition });
        }
    }, [value]);

    const IconToUse = isCopied ? CheckIcon : CopyIcon;

    return (
        // eslint-disable-next-line react/jsx-props-no-spreading
        <Button onClick={handleClick} title="Copy code" tabIndex={0} {...properties}>
            <IconToUse className="pointer-events-none h-4 w-4" />
        </Button>
    );
};

export default CopyToClipboard;
