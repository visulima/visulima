import cn from "clsx";
import React, { ReactElement, useEffect, useRef } from "react";

const Collapse = ({ children, className, open }: { children: React.ReactNode; className?: string; open: boolean }): ReactElement => {
    const containerReference = useRef<HTMLDivElement>(null);
    const innerReference = useRef<HTMLDivElement>(null);
    const animationReference = useRef<any>();
    const initialRender = useRef(true);
    const initialState = useRef(open);

    useEffect(() => {
        if (initialRender.current) return;

        if (animationReference.current) {
            clearTimeout(animationReference.current);
        }

        if (open) {
            const container = containerReference.current;
            const inner = innerReference.current;
            if (container && inner) {
                const contentHeight = innerReference.current.clientHeight;
                container.style.maxHeight = `${contentHeight}px`;
                container.classList.remove("duration-500");
                container.classList.add("duration-300");

                inner.style.opacity = "1";

                animationReference.current = setTimeout(() => {
                    const container = containerReference.current;

                    if (container) {
                        // should be style property in kebab-case, not css class name
                        container.style.removeProperty("max-height");
                    }
                }, 300);
            }
        } else {
            const container = containerReference.current;
            const inner = innerReference.current;
            if (container && inner) {
                const contentHeight = innerReference.current.clientHeight;
                container.style.maxHeight = `${contentHeight}px`;
                container.classList.remove("duration-300");
                container.classList.add("duration-500");

                inner.style.opacity = "0";

                setTimeout(() => {
                    const container = containerReference.current;

                    if (container) {
                        container.style.maxHeight = "0px";
                    }
                }, 0);
            }
        }
    }, [open]);

    useEffect(() => {
        initialRender.current = false;
    }, []);

    return (
        <div
            ref={containerReference}
            className="transform-gpu overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none"
            style={{
                maxHeight: initialState.current ? undefined : 0,
            }}
        >
            <div
                ref={innerReference}
                className={cn(
                    "transform-gpu overflow-hidden p-2 transition-opacity duration-500 ease-in-out motion-reduce:transition-none",
                    className,
                )}
                style={{
                    opacity: initialState.current ? 1 : 0,
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default Collapse;
