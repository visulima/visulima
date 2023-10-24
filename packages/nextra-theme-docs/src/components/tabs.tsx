import { Tab as HeadlessTab } from "@headlessui/react";
import type { ComponentProps, FC, ReactElement, ReactNode } from "react";
import { Children, isValidElement, useCallback, useEffect, useId, useState } from "react";

import cn from "../utils/cn";

interface TabItem {
    disabled?: boolean;
    label: ReactElement | string;
}

type TabProperties = ComponentProps<"div"> & { disabled?: boolean; title: ReactElement | string };

export const Tab: FC<TabProperties> = ({ children = undefined, className = "pt-3", title, ...properties }) => (
    // @ts-expect-error TS2322: Type 'string' is not assignable to type 'Ref<HTMLElement> | undefined'
    // eslint-disable-next-line react/jsx-props-no-spreading
    <HeadlessTab.Panel {...properties} className={className}>
        {children}
    </HeadlessTab.Panel>
);

export const Tabs = ({
    children,
    classes = undefined,
    defaultIndex = 0,
    disableScrollBar = false,
    onChange = undefined,
    prefix = "tabs",
    selectedIndex: _selectedIndex = undefined,
    storageKey = undefined,
}: {
    children: ReactNode | ReactNode[];
    classes?: {
        tab?: string;
        tabs?: string;
    };
    defaultIndex?: number;
    disableScrollBar?: boolean;
    onChange?: (index: number) => void;
    prefix?: string;
    selectedIndex?: number;
    storageKey?: string;
}): ReactElement => {
    const id = useId();
    const tabs: TabItem[] = [];

    const [selectedIndex, setSelectedIndex] = useState(defaultIndex);

    useEffect(() => {
        if (_selectedIndex !== undefined) {
            setSelectedIndex(_selectedIndex);
        }
    }, [_selectedIndex]);

    useEffect(() => {
        if (!storageKey) {
            // Do not listen storage events if there is no storage key
            return;
        }

        const handleEvent = (event: StorageEvent) => {
            if (event.key === storageKey) {
                setSelectedIndex(Number(event.newValue));
            }
        };

        const index = Number(localStorage.getItem(storageKey));

        setSelectedIndex(Number.isNaN(index) ? 0 : index);

        window.addEventListener("storage", handleEvent);

        // eslint-disable-next-line consistent-return
        return () => {
            window.removeEventListener("storage", handleEvent);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

    Children.forEach(Children.toArray(children), (child) => {
        if (isValidElement(child)) {
            if ((child as ReactElement<TabProperties>).type === Tab) {
                const { disabled, title } = (child as ReactElement<TabProperties>).props;

                tabs.push({
                    disabled,
                    label: title,
                });
            } else {
                throw new Error("Children of `Tabs` must be of type `Tab`");
            }
        }
    });

    const handleChange = useCallback((index: number) => {
        if (storageKey) {
            const newValue = String(index);

            localStorage.setItem(storageKey, newValue);

            // the storage event only get picked up (by the listener) if the localStorage was changed in
            // another browser's tab/window (of the same app), but not within the context of the current tab.
            window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue }));
            return;
        }

        setSelectedIndex(index);
        onChange?.(index);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

    let content = (
        <HeadlessTab.List className={cn("mt-4 flex w-max min-w-full border-b border-gray-400 pb-px dark:border-neutral-800", classes?.tabs)}>
            {tabs.map((item, index) => (
                <HeadlessTab
                    /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                    className={({ selected }) =>
                        cn(
                            "py-3 px-4 font-medium leading-5 transition-colors text-sm",
                            "-mb-0.5 select-none border-b-2",
                            selected
                                ? "border-primary-500 text-primary-600"
                                : "border-transparent text-gray-600 hover:border-gray-400 hover:text-black dark:text-gray-200 dark:hover:border-neutral-800 dark:hover:text-white",
                            { "pointer-events-none text-gray-400 dark:text-neutral-400": item.disabled },
                            classes?.tab,
                        ) as string
                    }
                    disabled={item.disabled}
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${prefix}-${id}-tab-${index}`}
                >
                    {item.label}
                </HeadlessTab>
            ))}
        </HeadlessTab.List>
    );

    if (!disableScrollBar) {
        content = <div className="nextra-scrollbar not-prose overflow-x-auto overflow-y-hidden overscroll-x-contain p-0">{content}</div>;
    }

    return (
        <HeadlessTab.Group defaultIndex={defaultIndex} onChange={handleChange} selectedIndex={selectedIndex}>
            {content}
            <HeadlessTab.Panels>{children}</HeadlessTab.Panels>
        </HeadlessTab.Group>
    );
};
