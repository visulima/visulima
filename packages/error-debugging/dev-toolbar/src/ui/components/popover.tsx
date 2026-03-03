/** @jsxImportSource preact */
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { ComponentChildren, JSX } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";

import cn from "../../utils/cn";

interface PopoverContextValue {
    open: boolean;
    setOpen: (v: boolean) => void;
    triggerRef: { current: Element | null };
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

const usePopoverContext = (): PopoverContextValue => {
    const ctx = useContext(PopoverContext);

    if (!ctx) {
        throw new Error("Popover subcomponent must be used within <Popover>");
    }

    return ctx;
};

interface PopoverProps {
    children: ComponentChildren;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
}

interface PopoverTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    children: ComponentChildren;
    class?: string;
}

interface PopoverContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
    align?: "center" | "end" | "start";
    children: ComponentChildren;
    class?: string;
    side?: "bottom" | "left" | "right" | "top";
    sideOffset?: number;
}

interface PopoverCloseProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: ComponentChildren;
    class?: string;
}

const Popover = ({ children, defaultOpen, onOpenChange, open }: PopoverProps): JSX.Element => {
    const isControlled = open !== undefined;
    const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
    const isOpen = isControlled ? open : internalOpen;
    const triggerRef = useRef<Element | null>(null);

    const setOpen = (v: boolean): void => {
        if (!isControlled) {
            setInternalOpen(v);
        }

        onOpenChange?.(v);
    };

    return (
        <PopoverContext.Provider value={{ open: isOpen, setOpen, triggerRef }}>
            <span style={{ display: "contents" }}>{children}</span>
        </PopoverContext.Provider>
    );
};

const PopoverTrigger = ({ children, class: className, ...rest }: PopoverTriggerProps): JSX.Element => {
    const { open, setOpen, triggerRef } = usePopoverContext();

    const handleRef = (el: HTMLButtonElement | null): void => {
        triggerRef.current = el;
    };

    return (
        <button
            aria-expanded={open}
            class={cn("", className)}
            onClick={() => {
                if (!rest.disabled) {
                    setOpen(!open);
                }
            }}
            ref={handleRef}
            type="button"
            {...rest}
        >
            {children}
        </button>
    );
};

const PopoverContent = ({
    align = "center",
    children,
    class: className,
    side = "bottom",
    sideOffset = 4,
    ...rest
}: PopoverContentProps): JSX.Element | null => {
    const { open, setOpen, triggerRef } = usePopoverContext();
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!open || !triggerRef.current || !contentRef.current) {
            return;
        }

        const placement = align === "center" ? side : (`${side}-${align}` as const);

        computePosition(triggerRef.current as Element, contentRef.current as HTMLElement, {
            middleware: [offset(sideOffset), flip(), shift({ padding: 4 })],
            placement,
        })
            .then((result) => {
                setPosition({ x: result.x, y: result.y });
            })
            .catch(() => {
                // ignore positioning errors in non-browser environments
            });
    }, [open, side, sideOffset, align, triggerRef]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleMouseDown = (e: MouseEvent): void => {
            if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
                const trigger = triggerRef.current;

                if (trigger && trigger.contains(e.target as Node)) {
                    return;
                }

                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [open, setOpen, triggerRef]);

    if (!open) {
        return null;
    }

    return (
        <div
            class={cn(
                "z-50 w-72 rounded-none border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95",
                className,
            )}
            ref={contentRef}
            role="dialog"
            style={{ left: `${position.x}px`, position: "fixed", top: `${position.y}px` }}
            {...rest}
        >
            {children}
        </div>
    );
};

const PopoverClose = ({ children, class: className, ...rest }: PopoverCloseProps): JSX.Element => {
    const { setOpen } = usePopoverContext();

    return (
        <button
            class={cn("", className)}
            onClick={() => setOpen(false)}
            type="button"
            {...rest}
        >
            {children}
        </button>
    );
};

export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
