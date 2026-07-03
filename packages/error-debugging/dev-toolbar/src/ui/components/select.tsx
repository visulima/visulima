/** @jsxImportSource preact */
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

// ─── Context ────────────────────────────────────────────────────────────────────

interface SelectContextValue {
    highlightedValue: string | null;
    instanceId: string;
    onSelect: (value: string) => void;
    open: boolean;
    search: string;
    setHighlightedValue: (v: string | null) => void;
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

interface SelectTriggerProps extends Omit<JSX.ButtonHTMLAttributes, "children"> {
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

// ─── Unique ID counter ──────────────────────────────────────────────────────────

let idCounter = 0;

// ─── Root ───────────────────────────────────────────────────────────────────────

const Select = ({ children, onValueChange, value = "" }: SelectProps): JSX.Element => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightedValue, setHighlightedValue] = useState<string | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [instanceId] = useState(() => {
        idCounter += 1;

        return `select-${idCounter}`;
    });

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
            setHighlightedValue(null);
        }
    }, [open]);

    const contextValue = useMemo(() => {
        return { highlightedValue, instanceId, onSelect, open, search, setHighlightedValue, setOpen, setSearch, triggerRef, value };
    }, [highlightedValue, instanceId, onSelect, open, search, value]);

    return (
        <SelectContext.Provider value={contextValue}>
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
            onClick={() => {
                setOpen(!open);
            }}
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

// ─── Helpers ────────────────────────────────────────────────────────────────────

const getOptionElements = (list: HTMLElement): HTMLElement[] => [...list.querySelectorAll<HTMLElement>("[role='option']:not([aria-disabled='true'])")];

const getOptionValue = (element: HTMLElement): string | null => element.dataset.value ?? null;

// ─── Content (dropdown) ─────────────────────────────────────────────────────────

const SelectContent = ({
    align = "start",
    children,
    class: className,
    searchable = false,
    side = "bottom",
    sideOffset = 4,
}: SelectContentProps): JSX.Element | undefined => {
    const { highlightedValue, instanceId, open, search, setHighlightedValue, setOpen, setSearch, triggerRef } = useSelectContext();
    const contentRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [ready, setReady] = useState(false);

    // Keep a ref to the latest highlightedValue to avoid stale closures in keydown
    const highlightedRef = useRef(highlightedValue);

    highlightedRef.current = highlightedValue;

    // Position the dropdown using floating-ui
    useEffect(() => {
        if (!open || !triggerRef.current || !contentRef.current) {
            setReady(false);

            return;
        }

        let cancelled = false;

        const placement = align === "center" ? side : (`${side}-${align}` as const);

        computePosition(triggerRef.current, contentRef.current, {
            middleware: [offset(sideOffset), flip(), shift({ padding: 4 })],
            placement,
        })
            .then((result) => {
                if (cancelled) {
                    return result;
                }

                setPosition({ x: result.x, y: result.y });
                setReady(true);

                return result;
            })
            .catch(() => {
                // ignore positioning errors in non-browser environments
            });

        return () => {
            cancelled = true;
        };
    }, [open, side, sideOffset, align, triggerRef]);

    // Focus search input or listbox when dropdown opens
    useEffect(() => {
        if (!open) {
            return;
        }

        if (searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        } else if (listRef.current) {
            listRef.current.focus();
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

            const items = getOptionElements(list);
            const count = items.length;

            if (count === 0) {
                if (event_.key === "Escape") {
                    event_.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus();
                }

                return;
            }

            const currentHighlighted = highlightedRef.current;
            const currentIndex = currentHighlighted === null ? -1 : items.findIndex((element) => getOptionValue(element) === currentHighlighted);

            const highlightByIndex = (index: number): void => {
                const element = items[index];

                if (element) {
                    const v = getOptionValue(element);

                    if (v !== null) {
                        setHighlightedValue(v);
                    }

                    element.scrollIntoView?.({ block: "nearest" });
                }
            };

            switch (event_.key) {
                case "ArrowDown": {
                    event_.preventDefault();
                    highlightByIndex(currentIndex < count - 1 ? currentIndex + 1 : 0);
                    break;
                }

                case "ArrowUp": {
                    event_.preventDefault();
                    highlightByIndex(currentIndex > 0 ? currentIndex - 1 : count - 1);
                    break;
                }

                case "End": {
                    event_.preventDefault();
                    highlightByIndex(count - 1);
                    break;
                }

                case "Enter": {
                    event_.preventDefault();

                    if (currentIndex >= 0) {
                        items[currentIndex]?.click();
                    }

                    break;
                }
                case "Escape":

                case "Tab": {
                    event_.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus();
                    break;
                }

                case "Home": {
                    event_.preventDefault();
                    highlightByIndex(0);
                    break;
                }
                // No default
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
        // Using ref for highlightedValue, so we only depend on open
    }, [open, setHighlightedValue, setOpen, triggerRef]);

    if (!open) {
        return undefined;
    }

    const activeDescendantId = highlightedValue === null ? undefined : `${instanceId}-option-${highlightedValue}`;

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
                        aria-activedescendant={activeDescendantId}
                        aria-controls={`${instanceId}-listbox`}
                        aria-label="Search options"
                        class={clsx(
                            "w-full bg-transparent text-[0.75rem] text-foreground placeholder:text-muted-foreground",
                            "px-1.5 py-1 border-0 outline-none",
                        )}
                        onInput={(event_) => {
                            setSearch(event_.currentTarget.value);
                            setHighlightedValue(null);
                        }}
                        placeholder="Search…"
                        ref={searchInputRef}
                        role="combobox"
                        type="text"
                        value={search}
                    />
                </div>
            )}
            <div
                {...(!searchable && { "aria-activedescendant": activeDescendantId, tabIndex: 0 })}
                class="max-h-[min(300px,var(--available-height,300px))] overflow-y-auto scrollbar-thin-border p-1"
                id={`${instanceId}-listbox`}
                ref={listRef}
                role="listbox"
            >
                {children}
            </div>
        </div>
    );
};

// ─── Item ───────────────────────────────────────────────────────────────────────

const SelectItem = ({ children, class: className, value: itemValue }: SelectItemProps): JSX.Element => {
    const { highlightedValue, instanceId, onSelect, setHighlightedValue, value } = useSelectContext();
    const isSelected = value === itemValue;
    const isHighlighted = highlightedValue === itemValue;
    const itemId = `${instanceId}-option-${itemValue}`;

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
            data-value={itemValue}
            id={itemId}
            onClick={() => {
                onSelect(itemValue);
            }}
            onMouseEnter={() => {
                setHighlightedValue(itemValue);
            }}
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
