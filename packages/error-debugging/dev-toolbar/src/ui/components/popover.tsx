/** @jsxImportSource preact */
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";

interface PopoverContextValue {
    open: boolean;
    setOpen: (v: boolean) => void;
    triggerRef: { current: Element | null };
}

const PopoverContext = createContext<PopoverContextValue | undefined>(undefined);

const usePopoverContext = (): PopoverContextValue => {
    const context = useContext(PopoverContext);

    if (!context) {
        throw new Error("Popover subcomponent must be used within <Popover>");
    }

    return context;
};

interface PopoverProps {
    children: ComponentChildren;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
}

interface PopoverTriggerProps extends JSX.ButtonHTMLAttributes {
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

interface PopoverCloseProps extends JSX.ButtonHTMLAttributes {
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

    const handleRef = (element: HTMLButtonElement | null): void => {
        triggerRef.current = element;
    };

    return (
        <button
            aria-expanded={open}
            class={clsx("", className)}
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
}: PopoverContentProps): JSX.Element | undefined => {
    const { open, setOpen, triggerRef } = usePopoverContext();
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!open || !triggerRef.current || !contentRef.current) {
            return;
        }

        const placement = align === "center" ? side : (`${side}-${align}` as const);

        computePosition(triggerRef.current, contentRef.current as HTMLElement, {
            middleware: [offset(sideOffset), flip(), shift({ padding: 4 })],
            placement,
        })
            .then((result) => {
                setPosition({ x: result.x, y: result.y });

                return result;
            })
            .catch(() => {
                // ignore positioning errors in non-browser environments
            });
    }, [open, side, sideOffset, align, triggerRef]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleMouseDown = (event_: MouseEvent): void => {
            if (contentRef.current && !contentRef.current.contains(event_.target as Node)) {
                const trigger = triggerRef.current;

                if (trigger && trigger.contains(event_.target as Node)) {
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
        return undefined;
    }

    return (
        <div
            class={clsx(
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
            class={clsx("", className)}
            onClick={() => {
                setOpen(false);
            }}
            type="button"
            {...rest}
        >
            {children}
        </button>
    );
};

export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
