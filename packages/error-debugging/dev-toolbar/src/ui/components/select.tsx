/** @jsxImportSource preact */
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useRef, useState } from "preact/hooks";

// ─── Context ────────────────────────────────────────────────────────────────────

interface SelectContextValue {
    highlightedIndex: number;
    onSelect: (value: string) => void;
    open: boolean;
    search: string;
    setHighlightedIndex: (i: number) => void;
    setOpen: (v: boolean) => void;
    setSearch: (v: string) => void;
    triggerRef: { current: HTMLButtonElement | null };
    value: string;
}

const SelectContext = createContext<SelectContextValue | undefined>(undefined);

const useSelectContext = (): SelectContextValue => {
    const context = useContext(SelectContext);

    if (!context) {
        throw new Error("Select subcomponent must be used within <Select>");
    }

    return context;
};

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SelectOption {
    label: string;
    value: string;
}

interface SelectProps {
    children: ComponentChildren;
    onValueChange?: (value: string) => void;
    value?: string;
}

interface SelectTriggerProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    children: ComponentChildren;
    class?: string;
}

interface SelectContentProps {
    align?: "center" | "end" | "start";
    children: ComponentChildren;
    class?: string;
    searchable?: boolean;
    side?: "bottom" | "top";
    sideOffset?: number;
}

interface SelectItemProps {
    children: ComponentChildren;
    class?: string;
    value: string;
}

interface SelectValueProps {
    class?: string;
    options: SelectOption[];
    placeholder?: string;
}

// ─── Root ───────────────────────────────────────────────────────────────────────

const Select = ({ children, onValueChange, value = "" }: SelectProps): JSX.Element => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    const onSelect = useCallback(
        (v: string): void => {
            onValueChange?.(v);
            setOpen(false);
            setSearch("");
        },
        [onValueChange],
    );

    // Reset search and highlight when closing
    useEffect(() => {
        if (!open) {
            setSearch("");
            setHighlightedIndex(-1);
        }
    }, [open]);

    return (
        <SelectContext.Provider value={{ highlightedIndex, onSelect, open, search, setHighlightedIndex, setOpen, setSearch, triggerRef, value }}>
            <span style={{ display: "contents" }}>{children}</span>
        </SelectContext.Provider>
    );
};

// ─── Trigger ────────────────────────────────────────────────────────────────────

const SelectTrigger = ({ children, class: className, ...rest }: SelectTriggerProps): JSX.Element => {
    const { open, setOpen, triggerRef } = useSelectContext();

    return (
        <button
            aria-expanded={open}
            aria-haspopup="listbox"
            class={clsx(
                "inline-flex items-center justify-between gap-2",
                "bg-foreground/6 border border-border",
                "text-[0.775rem] font-medium text-foreground",
                "px-2.5 py-1.5 cursor-pointer",
                "focus:outline-none focus:ring-1 focus:ring-ring",
                "transition-colors duration-150",
                className,
            )}
            onClick={() => setOpen(!open)}
            ref={(element) => {
                triggerRef.current = element;
            }}
            type="button"
            {...rest}
        >
            {children}
            <svg
                aria-hidden="true"
                class={clsx("h-3 w-3 shrink-0 opacity-60 transition-transform duration-150", open && "rotate-180")}
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </button>
    );
};

// ─── Value display ──────────────────────────────────────────────────────────────

const SelectValue = ({ class: className, options, placeholder = "Select…" }: SelectValueProps): JSX.Element => {
    const { value } = useSelectContext();
    const selected = options.find((o) => o.value === value);

    return <span class={clsx("truncate", !selected && "text-muted-foreground", className)}>{selected ? selected.label : placeholder}</span>;
};

// ─── Content (dropdown) ─────────────────────────────────────────────────────────

const SelectContent = ({ align = "start", children, class: className, searchable = false, side = "bottom", sideOffset = 4 }: SelectContentProps): JSX.Element | undefined => {
    const { highlightedIndex, open, search, setHighlightedIndex, setOpen, setSearch, triggerRef } = useSelectContext();
    const contentRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [ready, setReady] = useState(false);

    // Position the dropdown using floating-ui
    useEffect(() => {
        if (!open || !triggerRef.current || !contentRef.current) {
            setReady(false);

            return;
        }

        const placement = align === "center" ? side : (`${side}-${align}` as const);

        computePosition(triggerRef.current, contentRef.current, {
            middleware: [offset(sideOffset), flip(), shift({ padding: 4 })],
            placement,
        })
            .then((result) => {
                setPosition({ x: result.x, y: result.y });
                setReady(true);

                return result;
            })
            .catch(() => {
                // ignore positioning errors in non-browser environments
            });
    }, [open, side, sideOffset, align, triggerRef]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (open && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [open, searchable]);

    // Click outside to close
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

    // Keyboard navigation
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (event_: KeyboardEvent): void => {
            const list = listRef.current;

            if (!list) {
                return;
            }

            const items = list.querySelectorAll("[role='option']:not([aria-disabled='true'])");
            const count = items.length;

            if (count === 0) {
                return;
            }

            switch (event_.key) {
                case "ArrowDown": {
                    event_.preventDefault();
                    const next = highlightedIndex < count - 1 ? highlightedIndex + 1 : 0;

                    setHighlightedIndex(next);
                    (items[next] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
                    break;
                }

                case "ArrowUp": {
                    event_.preventDefault();
                    const previous = highlightedIndex > 0 ? highlightedIndex - 1 : count - 1;

                    setHighlightedIndex(previous);
                    (items[previous] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
                    break;
                }

                case "Enter": {
                    event_.preventDefault();

                    if (highlightedIndex >= 0 && highlightedIndex < count) {
                        (items[highlightedIndex] as HTMLElement | undefined)?.click();
                    }

                    break;
                }

                case "Escape": {
                    event_.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus();
                    break;
                }

                case "Home": {
                    event_.preventDefault();
                    setHighlightedIndex(0);
                    (items[0] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
                    break;
                }

                case "End": {
                    event_.preventDefault();
                    setHighlightedIndex(count - 1);
                    (items[count - 1] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
                    break;
                }
                // No default
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, highlightedIndex, setHighlightedIndex, setOpen, triggerRef]);

    if (!open) {
        return undefined;
    }

    return (
        <div
            class={clsx(
                "z-50 min-w-[8rem] overflow-hidden border border-border bg-popover text-popover-foreground shadow-md",
                "animate-in fade-in-0 zoom-in-95",
                !ready && "invisible",
                className,
            )}
            ref={contentRef}
            style={{
                left: `${position.x}px`,
                position: "fixed",
                top: `${position.y}px`,
                width: triggerRef.current ? `${Math.max(triggerRef.current.offsetWidth, 128)}px` : undefined,
            }}
        >
            {searchable && (
                <div class="border-b border-border p-1.5">
                    <input
                        aria-label="Search options"
                        class={clsx(
                            "w-full bg-transparent text-[0.75rem] text-foreground placeholder:text-muted-foreground",
                            "px-1.5 py-1 border-0 outline-none",
                        )}
                        onInput={(event_) => {
                            setSearch((event_.currentTarget as HTMLInputElement).value);
                            setHighlightedIndex(0);
                        }}
                        placeholder="Search…"
                        ref={searchInputRef}
                        type="text"
                        value={search}
                    />
                </div>
            )}
            <div class="max-h-[min(300px,var(--available-height,300px))] overflow-y-auto scrollbar-thin-border p-1" ref={listRef} role="listbox">
                {children}
            </div>
        </div>
    );
};

// ─── Item ───────────────────────────────────────────────────────────────────────

const SelectItem = ({ children, class: className, value: itemValue }: SelectItemProps): JSX.Element => {
    const { highlightedIndex, onSelect, setHighlightedIndex, value } = useSelectContext();
    const isSelected = value === itemValue;
    const itemRef = useRef<HTMLDivElement>(null);

    // Determine this item's index among visible siblings
    const getIndex = useCallback((): number => {
        if (!itemRef.current) {
            return -1;
        }

        const list = itemRef.current.closest("[role='listbox']");

        if (!list) {
            return -1;
        }

        const items = list.querySelectorAll("[role='option']:not([aria-disabled='true'])");
        let index = -1;

        items.forEach((element, index_) => {
            if (element === itemRef.current) {
                index = index_;
            }
        });

        return index;
    }, []);

    const index = getIndex();
    const isHighlighted = index >= 0 && index === highlightedIndex;

    return (
        <div
            aria-selected={isSelected}
            class={clsx(
                "relative flex cursor-pointer select-none items-center gap-2",
                "text-[0.775rem] py-1.5 px-2",
                "transition-colors duration-75",
                isHighlighted && "bg-accent text-accent-foreground",
                isSelected && "font-medium",
                !isHighlighted && !isSelected && "text-foreground",
                !isHighlighted && "hover:bg-accent/50",
                className,
            )}
            onClick={() => onSelect(itemValue)}
            onMouseEnter={() => {
                const i = getIndex();

                if (i >= 0) {
                    setHighlightedIndex(i);
                }
            }}
            ref={itemRef}
            role="option"
        >
            <span class="flex-1 truncate">{children}</span>
            {isSelected && (
                <svg aria-hidden="true" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            )}
        </div>
    );
};

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useSelectContext };
export type { SelectOption };
