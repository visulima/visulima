/** @jsxImportSource preact */
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";

interface TooltipContextValue {
    open: boolean;
    setOpen: (v: boolean) => void;
    triggerRef: { current: Element | null };
}

const TooltipContext = createContext<TooltipContextValue | undefined>(undefined);

const useTooltipContext = (): TooltipContextValue => {
    const context = useContext(TooltipContext);

    if (!context) {
        throw new Error("Tooltip subcomponent must be used within <Tooltip>");
    }

    return context;
};

interface TooltipProps {
    children: ComponentChildren;
    delayDuration?: number;
}

interface TooltipTriggerProps extends JSX.HTMLAttributes<HTMLSpanElement> {
    children: ComponentChildren;
    class?: string;
}

interface TooltipContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children: ComponentChildren;
    class?: string;
    side?: "bottom" | "left" | "right" | "top";
    sideOffset?: number;
}

// fallow-ignore-next-line unused-component-prop -- delayDuration is part of the public Radix-style Tooltip API; accepted for compatibility, applied by consumers.
const Tooltip = ({ children, delayDuration: _delayDuration = 0 }: TooltipProps): JSX.Element => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<Element | null>(null);

    return (
        <TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
            <span style={{ display: "contents" }}>{children}</span>
        </TooltipContext.Provider>
    );
};

const TooltipTrigger = ({ children, class: className, ...rest }: TooltipTriggerProps): JSX.Element => {
    const { setOpen, triggerRef } = useTooltipContext();

    const handleRef = (element: HTMLSpanElement | null): void => {
        triggerRef.current = element;
    };

    return (
        <span
            class={className}
            onMouseEnter={() => {
                setOpen(true);
            }}
            onMouseLeave={() => {
                setOpen(false);
            }}
            ref={handleRef}
            {...rest}
        >
            {children}
        </span>
    );
};

const TooltipContent = ({ children, class: className, side = "top", sideOffset = 4, ...rest }: TooltipContentProps): JSX.Element | undefined => {
    const { open, triggerRef } = useTooltipContext();
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!open || !triggerRef.current || !contentRef.current) {
            return;
        }

        computePosition(triggerRef.current, contentRef.current as HTMLElement, {
            middleware: [offset(sideOffset), flip(), shift({ padding: 4 })],
            placement: side,
        })
            .then((result) => {
                setPosition({ x: result.x, y: result.y });

                return result;
            })
            .catch(() => {
                // ignore positioning errors in non-browser environments
            });
    }, [open, side, sideOffset, triggerRef]);

    if (!open) {
        return undefined;
    }

    return (
        <div
            class={clsx("z-50 rounded-none bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95", className)}
            ref={contentRef}
            role="tooltip"
            style={{ left: `${position.x}px`, position: "fixed", top: `${position.y}px` }}
            {...rest}
        >
            {children}
        </div>
    );
};

export { Tooltip, TooltipContent, TooltipTrigger };
