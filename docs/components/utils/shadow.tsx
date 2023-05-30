import type { FC, LegacyRef, PropsWithChildren } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const Shadow: FC<PropsWithChildren<{ mode: "open" }>> = ({ children, mode = "open", ...rest }) => {
    const reference = useRef<HTMLDivElement>();
    const [shadowRoot, setShadowRoot] = useState<DocumentFragment | Element | null>(null);

    useEffect(() => {
        if (reference.current) {
            setShadowRoot(reference.current.attachShadow({ mode }));
        }
    }, [mode]);

    return (
        <div {...rest} ref={reference as LegacyRef<HTMLDivElement> | undefined}>
            {shadowRoot && createPortal(children, shadowRoot)}
        </div>
    );
};

export default Shadow;
