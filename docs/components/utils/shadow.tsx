import type { FC, LegacyRef, PropsWithChildren } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const Shadow: FC<PropsWithChildren<{ mode: "open" }>> = ({ children = null, mode = "open", ...rest }) => {
    const reference = useRef<HTMLDivElement>();
    const [shadowRoot, setShadowRoot] = useState<DocumentFragment | Element | null>(null);

    useEffect(() => {
        if (reference.current) {
            setShadowRoot(reference.current.attachShadow({ mode }));
        }
    }, [mode]);

    return (
        // eslint-disable-next-line react/jsx-props-no-spreading
        <div {...rest} ref={reference as LegacyRef<HTMLDivElement> | undefined}>
            {shadowRoot && createPortal(children, shadowRoot)}
        </div>
    );
};

export default Shadow;
