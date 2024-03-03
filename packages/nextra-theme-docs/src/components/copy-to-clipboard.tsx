import copy from "copy-to-clipboard";
import { CheckIcon, CopyIcon } from "nextra/icons";
import type { ComponentProps, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
// eslint-disable-next-line import/no-named-as-default
import toast from "react-hot-toast";

import Button from "./button";
import ErrorToast from "./toast/error";
import SuccessToast from "./toast/success";

const toastId = "copy-to-clipboard";
const toastPosition = "bottom-right";

const CopyToClipboard = ({
    as = undefined,
    className,
    getValue,
    ...properties
}: ComponentProps<"button"> & {
    as?: string;
    getValue: () => string;
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

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
            className={["text-slate-500 hover:text-slate-400", className].join(" ")}
            onClick={handleClick}
            tabIndex={0}
            title="Copy code"
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
        >
            <IconToUse className="nextra-copy-icon pointer-events-none size-4" />
        </Component>
    );
};

export default CopyToClipboard;
