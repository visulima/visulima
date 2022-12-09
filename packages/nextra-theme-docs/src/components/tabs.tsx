import { Tab as HeadlessTab } from "@headlessui/react";
import cn from "clsx";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import React from "react";

type TabItem = {
    label: ReactElement;
    disabled?: boolean;
};

const isTabItem = (item: unknown): item is TabItem => typeof item === "object" && "label" in (item as TabItem);

const renderTab = (item: ReactNode | TabItem) => {
    if (isTabItem(item)) {
        return item.label;
    }

    return item;
};

export const Tabs = ({
    items,
    selectedIndex,
    defaultIndex,
    onChange,
    children,
}: {
    items: ReactNode[] | ReadonlyArray<ReactNode> | TabItem[];
    selectedIndex?: number;
    defaultIndex?: number;
    onChange?: (index: number) => void;
    children: ReactNode;
}): ReactElement => (
    <HeadlessTab.Group selectedIndex={selectedIndex} defaultIndex={defaultIndex} onChange={onChange}>
        <div className="no-scrollbar -m-2 overflow-x-auto overflow-y-hidden overscroll-x-contain p-2">
            <HeadlessTab.List className="mt-4 flex w-max min-w-full border-b border-gray-400 pb-px dark:border-neutral-800">
                {items.map((item, index) => {
                    const disabled = !!(item && typeof item === "object" && "disabled" in item && item.disabled);

                    return (
                        <HeadlessTab
                            // eslint-disable-next-line react/no-array-index-key
                            key={index}
                            disabled={disabled}
                            className={({ selected }) => cn(
                                    "mr-2 rounded-t p-2 font-medium leading-5 transition-colors",
                                    "-mb-0.5 select-none border-b-2",
                                    selected
                                        ? "border-primary-500 text-primary-600"
                                         // eslint-disable-next-line max-len
                                        : "border-transparent text-gray-600 hover:border-gray-400 hover:text-black dark:text-gray-200 dark:hover:border-neutral-800 dark:hover:text-white",
                                    disabled && "pointer-events-none text-gray-400 dark:text-neutral-600",
                                )}
                        >
                            {renderTab(item)}
                        </HeadlessTab>
                    );
                })}
            </HeadlessTab.List>
        </div>
        <HeadlessTab.Panels>{children}</HeadlessTab.Panels>
    </HeadlessTab.Group>
);

export const Tab = ({ children, ...properties }: ComponentProps<"div">): ReactElement => (
    <HeadlessTab.Panel {...properties} className="rounded pt-6">
        {children}
    </HeadlessTab.Panel>
);
