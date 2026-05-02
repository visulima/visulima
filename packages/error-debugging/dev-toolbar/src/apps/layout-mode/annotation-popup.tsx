/** @jsxImportSource preact */
import { clsx } from "clsx";
import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface AnnotationPopupProps {
    element: string;
    initialValue: string;
    isExiting?: boolean;
    lightMode?: boolean;
    onCancel: () => void;
    onDelete?: () => void;
    onSubmit: (value: string) => void;
    placeholder: string;
    style?: JSX.CSSProperties;
    submitLabel: string;
}

const AnnotationPopup = ({
    element,
    initialValue,
    isExiting,
    lightMode,
    onCancel,
    onDelete,
    onSubmit,
    placeholder,
    style,
    submitLabel,
}: AnnotationPopupProps): JSX.Element => {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        ref.current?.focus();
        ref.current?.select();
    }, []);

    const submit = (): void => {
        onSubmit(ref.current?.value ?? "");
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
                "fixed z-[100002] w-80 -translate-x-1/2 rounded-xl bg-popover p-3 text-popover-foreground shadow-lg border border-border",
                "transition-[opacity,transform] duration-150",
                isExiting ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100",
            )}
            data-annotation-popup
            data-feedback-toolbar
            style={{ ...style, animation: isExiting ? undefined : "vdt-lm-popup-in 0.18s cubic-bezier(0.34,1.2,0.64,1)" }}
        >
            <div class="text-[0.65rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1.5">{element}</div>
            <textarea
                class="w-full min-h-16 bg-foreground/5 text-popover-foreground border border-border rounded-md px-2 py-1.5 text-sm font-sans resize-y outline-none focus:border-primary/40"
                defaultValue={initialValue}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                ref={ref}
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
