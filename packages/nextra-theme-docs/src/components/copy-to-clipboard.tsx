import copy from "copy-to-clipboard";
import { CheckIcon, CopyIcon } from "nextra/icons";
import type { ComponentProps, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import Button from "./button";
import ErrorToast from "./toast/error";
import SuccessToast from "./toast/success";

const toastId = "copy-to-clipboard";
const toastPosition = "bottom-right";

const CopyToClipboard = ({
    getValue,
    className,
    as,
    ...properties
}: ComponentProps<"button"> & {
    getValue: () => string;
    as?: string;
}): ReactElement => {
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

        if (copy(getValue())) {
            toast.custom(<SuccessToast title="Snippet was copied">Paste it wherever you like it.</SuccessToast>, {
                id: toastId,
                position: toastPosition,
            });
        } else {
            toast.custom(<ErrorToast>Failed copy to clipboard</ErrorToast>, { id: toastId, position: toastPosition });
        }
    }, [getValue]);

    const IconToUse = isCopied ? CheckIcon : CopyIcon;
    const Component = as ?? Button;

    return (
        <Component
            onClick={handleClick}
            title="Copy code"
            tabIndex={0}
            className={["text-slate-500 hover:text-slate-400", className].join(" ")}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
        >
            <IconToUse className="nextra-copy-icon pointer-events-none h-4 w-4" />
        </Component>
    );
};

export default CopyToClipboard;
