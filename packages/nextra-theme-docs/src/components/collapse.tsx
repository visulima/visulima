import cn from "clsx";
import type { FC, PropsWithChildren } from "react";
import { useEffect, useRef } from "react";

const Collapse: FC<PropsWithChildren<{ className?: string; isOpen: boolean; horizontal?: boolean }>> = ({
    children,
    className,
    isOpen,
    horizontal = false,
    // eslint-disable-next-line radar/cognitive-complexity
}) => {
    const containerReference = useRef<HTMLDivElement>(null);
    const innerReference = useRef<HTMLDivElement>(null);
    const animationReference = useRef<number>(0);
    const initialOpen = useRef<boolean>(isOpen);
    const initialRender = useRef(true);

    useEffect(() => {
        const container = containerReference.current;
        const inner = innerReference.current;
        const animationId = animationReference.current;

        if (animationId) {
            clearTimeout(animationId);
        }

        if (initialRender.current || !container || !inner) {
            return;
        }

        container.classList.toggle("duration-500", !isOpen);
        container.classList.toggle("duration-300", isOpen);

        if (horizontal) {
            // save initial width to avoid word wrapping when container width will be changed
            inner.style.width = `${inner.clientWidth}px`;
            container.style.width = `${isOpen ? inner.clientWidth : 0}px`;
        } else {
            container.style.height = `${isOpen ? inner.clientHeight : 0}px`;
        }

        if (isOpen) {
            animationReference.current = window.setTimeout(() => {
                // should be style property in kebab-case, not css class name
                container.style.removeProperty("height");
            }, 300);

            return;
        }

        setTimeout(() => {
            if (horizontal) {
                container.style.width = ".5rem";
            } else {
                container.style.height = ".5rem";
            }
        }, 0);
    }, [horizontal, isOpen]);

    useEffect(() => {
        initialRender.current = false;
    }, []);

    return (
        <div
            ref={containerReference}
            className="transform-gpu overflow-hidden transition-all ease-in-out motion-reduce:transition-none -m-1"
            style={{
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                maxHeight: !initialOpen && !horizontal ? 0 : undefined,
            }}
        >
            <div
                ref={innerReference}
                className={cn(
                    "transform-gpu transition-opacity duration-500 ease-in-out motion-reduce:transition-none p-1",
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    initialOpen ? "opacity-100" : "opacity-0",
                    className,
                )}
            >
                {children}
            </div>
        </div>
    );
};

export default Collapse;
