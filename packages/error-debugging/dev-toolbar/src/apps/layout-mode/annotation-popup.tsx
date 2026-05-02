/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { autoUpdate, computePosition, flip, offset, shift, size } from "@floating-ui/dom";
import { clsx } from "clsx";
import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";

import { SUPPORTS_POPOVER } from "./feature-detect";

interface AnchorRect {
    height: number;
    width: number;
    x: number;
    y: number;
}

interface AnnotationPopupProps {
    /** Page-coordinate rect of the element being annotated. The popup
     * positions itself adjacent via Floating UI, automatically flipping
     * and shifting to stay inside the viewport. */
    anchorRect: AnchorRect;
    element: string;
    initialValue: string;
    isExiting?: boolean;
    lightMode?: boolean;
    onCancel: () => void;
    onDelete?: () => void;
    onSubmit: (value: string) => void;
    placeholder: string;
    submitLabel: string;
}

const AnnotationPopup = ({
    anchorRect,
    element,
    initialValue,
    isExiting,
    lightMode,
    onCancel,
    onDelete,
    onSubmit,
    placeholder,
    submitLabel,
}: AnnotationPopupProps): JSX.Element => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Promote the popup to the top layer when the Popover API is
        // available — bypasses z-index stacking battles and gives us native
        // ESC-to-dismiss + screen-reader semantics for free. Falls through to
        // plain z-index ordering on browsers without support.
        const popup = popupRef.current;

        if (SUPPORTS_POPOVER && popup && !popup.matches(":popover-open")) {
            try {
                (popup as HTMLElement & { showPopover?: () => void }).showPopover?.();
            } catch {
                /* element not connected yet — autoUpdate will retry next tick */
            }
        }

        textareaRef.current?.focus();
        textareaRef.current?.select();

        return () => {
            if (SUPPORTS_POPOVER && popup?.matches(":popover-open")) {
                try {
                    (popup as HTMLElement & { hidePopover?: () => void }).hidePopover?.();
                } catch {
                    /* ignore */
                }
            }
        };
    }, []);

    // Position via Floating UI. The "reference" is a virtual element built
    // from anchorRect — the popup's host shadow root has no DOM ancestor of
    // the page element, so we feed coordinates directly.
    useEffect(() => {
        const popup = popupRef.current;

        if (!popup) {
            return undefined;
        }

        const reference = {
            getBoundingClientRect: () => {
                const { scrollY } = window;

                return {
                    bottom: anchorRect.y + anchorRect.height - scrollY,
                    height: anchorRect.height,
                    left: anchorRect.x,
                    right: anchorRect.x + anchorRect.width,
                    top: anchorRect.y - scrollY,
                    width: anchorRect.width,
                    x: anchorRect.x,
                    y: anchorRect.y - scrollY,
                };
            },
        };

        const update = (): void => {
            computePosition(reference, popup, {
                middleware: [
                    offset(8),
                    flip({ fallbackPlacements: ["top", "bottom", "right", "left"] }),
                    shift({ padding: 12 }),
                    size({
                        apply({ availableHeight }) {
                            popup.style.maxHeight = `${Math.max(160, availableHeight - 16)}px`;
                        },
                        padding: 12,
                    }),
                ],
                placement: "top",
                strategy: "fixed",
            }).then(({ x, y }) => {
                popup.style.left = `${x}px`;
                popup.style.top = `${y}px`;

                return undefined;
            }).catch(() => {
                /* ignore */
            });
        };

        const cleanup = autoUpdate(reference as never, popup, update);

        return cleanup;
    }, [anchorRect]);

    const submit = (): void => {
        onSubmit(textareaRef.current?.value ?? "");
    };

    const onKeyDown = (event_: KeyboardEvent): void => {
        if (event_.key === "Escape") {
            event_.preventDefault();
            onCancel();
        } else if (event_.key === "Enter" && (event_.metaKey || event_.ctrlKey)) {
            event_.preventDefault();
            submit();
        }
    };

    return (
        <div
            class={clsx(
                lightMode ? "" : "dark",
                "fixed z-[100002] w-80 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg border border-border overflow-auto",
                "transition-[opacity,transform] duration-150",
                isExiting ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100",
            )}
            data-annotation-popup
            data-feedback-toolbar
            popover={SUPPORTS_POPOVER ? "manual" : undefined}
            ref={popupRef}
            style={{ animation: isExiting ? undefined : "vdt-lm-popup-in 0.18s cubic-bezier(0.34,1.2,0.64,1)" }}
        >
            <div class="text-[0.65rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1.5">{element}</div>
            <textarea
                class="w-full min-h-16 bg-foreground/5 text-popover-foreground border border-border rounded-md px-2 py-1.5 text-sm font-sans resize-y outline-none focus:border-primary/40"
                defaultValue={initialValue}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                ref={textareaRef}
                rows={3}
            />
            <div class="flex justify-end gap-1.5 mt-2">
                {onDelete ? (
                    <button
                        class="px-2.5 py-1 rounded text-xs cursor-pointer bg-transparent border-0 text-destructive hover:bg-destructive/10 font-sans"
                        onClick={onDelete}
                        type="button"
                    >
                        Delete
                    </button>
                ) : null}
                <button
                    class="px-2.5 py-1 rounded text-xs cursor-pointer bg-transparent border-0 text-foreground hover:bg-foreground/10 font-sans"
                    onClick={onCancel}
                    type="button"
                >
                    Cancel
                </button>
                <button
                    class="px-2.5 py-1 rounded text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 border-0 font-sans"
                    onClick={submit}
                    type="button"
                >
                    {submitLabel}
                </button>
            </div>
        </div>
    );
};

export default AnnotationPopup;
