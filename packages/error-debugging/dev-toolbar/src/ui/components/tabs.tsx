/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";
import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

interface TabsContextValue {
    onValueChange: (v: string) => void;
    value: string;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

const useTabsContext = (): TabsContextValue => {
    const context = useContext(TabsContext);

    if (!context) {
        throw new Error("Tabs subcomponent must be used within <Tabs>");
    }

    return context;
};

interface TabsProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: ComponentChildren;
    class?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    value?: string;
}

interface TabsListProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: ComponentChildren;
    class?: string;
}

interface TabsTriggerProps extends JSX.ButtonHTMLAttributes {
    children?: ComponentChildren;
    class?: string;
    disabled?: boolean;
    value: string;
}

interface TabsContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: ComponentChildren;
    class?: string;
    value: string;
}

const Tabs = ({ children, class: className, defaultValue, onValueChange, value, ...rest }: TabsProps): JSX.Element => {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const activeValue = isControlled ? value : internalValue;

    const handleValueChange = (v: string): void => {
        if (!isControlled) {
            setInternalValue(v);
        }

        onValueChange?.(v);
    };

    return (
        <TabsContext.Provider value={{ onValueChange: handleValueChange, value: activeValue }}>
            <div class={clsx("", className)} {...rest}>
                {children}
            </div>
        </TabsContext.Provider>
    );
};

const TabsList = ({ children, class: className, ...rest }: TabsListProps): JSX.Element => (
    <div class={clsx("inline-flex h-9 items-center justify-center rounded-none bg-muted p-1 text-muted-foreground", className)} role="tablist" {...rest}>
        {children}
    </div>
);

const TabsTrigger = ({ children, class: className, disabled, value, ...rest }: TabsTriggerProps): JSX.Element => {
    const { onValueChange, value: activeValue } = useTabsContext();
    const isActive = activeValue === value;

    return (
        <button
            aria-selected={isActive}
            class={clsx(
                "inline-flex items-center justify-center whitespace-nowrap rounded-none px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive ? "bg-background text-foreground shadow" : "hover:bg-background/50",
                className,
            )}
            data-state={isActive ? "active" : "inactive"}
            disabled={disabled}
            onClick={() => !disabled && onValueChange(value)}
            role="tab"
            type="button"
            {...rest}
        >
            {children}
        </button>
    );
};

const TabsContent = ({ children, class: className, value, ...rest }: TabsContentProps): JSX.Element | undefined => {
    const { value: activeValue } = useTabsContext();

    if (activeValue !== value) {
        return undefined;
    }

    return (
        <div
            class={clsx(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className,
            )}
            role="tabpanel"
            {...rest}
        >
            {children}
        </div>
    );
};

export { Tabs, TabsContent, TabsList, TabsTrigger };
