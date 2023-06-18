import cn from "clsx";
import type { FC, PropsWithChildren } from "react";
import { useEffect, useRef } from "react";

const Collapse: FC<PropsWithChildren<{ className?: string; isOpen: boolean; horizontal?: boolean }>> = ({
    children,
    className,
    isOpen,
    horizontal = false,
}) => {
    const containerReference = useRef<HTMLDivElement>(null);
    const innerReference = useRef<HTMLDivElement>(null);
    const animationReference = useRef(0);
    const initialOpen = useRef(isOpen);
    const initialRender = useRef(true);

    useEffect(() => {
        const container = containerReference.current;
        const inner = innerReference.current;
        const animation = animationReference.current;
        if (animation) {
            clearTimeout(animation);
        }
        if (initialRender.current || !container || !inner) {
            return;
        }

        container.classList.toggle("duration-500", !isOpen);
        container.classList.toggle("duration-300", isOpen);

        if (horizontal) {
            // save initial width to avoid word wrapping when container width will be changed
            inner.style.width = `${inner.clientWidth}px`;
            container.style.width = `${inner.clientWidth}px`;
        } else {
            container.style.height = `${inner.clientHeight}px`;
        }

        if (isOpen) {
            animationReference.current = window.setTimeout(() => {
                // should be style property in kebab-case, not css class name
                container.style.removeProperty("height");
            }, 300);
        } else {
            setTimeout(() => {
                if (horizontal) {
                    container.style.width = "0px";
                } else {
                    container.style.height = "0px";
                }
            }, 0);
        }
    }, [horizontal, isOpen]);

    useEffect(() => {
        initialRender.current = false;
    }, []);

    return (
        <div
            ref={containerReference}
            className="transform-gpu overflow-hidden transition-all ease-in-out motion-reduce:transition-none"
            style={initialOpen.current || horizontal ? undefined : { height: 0 }}
        >
            <div
                ref={innerReference}
                className={cn("transition-opacity duration-500 ease-in-out motion-reduce:transition-none", isOpen ? "opacity-100" : "opacity-0", className)}
            >
                {children}
            </div>
        </div>
    );
};

export default Collapse;
