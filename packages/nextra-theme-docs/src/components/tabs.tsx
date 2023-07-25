import { Tab as HeadlessTab } from "@headlessui/react";
import cn from "clsx";
import type { ComponentProps, ReactElement, ReactNode } from "react";

interface TabItem {
    disabled?: boolean;
    label: ReactElement;
}

const isTabItem = (item: unknown): item is TabItem => typeof item === "object" && "label" in (item as TabItem);

const renderTab = (item: ReactNode | TabItem) => {
    if (isTabItem(item)) {
        return item.label;
    }

    return item;
};

export const Tabs = ({
    children,
    defaultIndex,
    items,
    onChange,
    prefix = "tabs",
    selectedIndex,
}: {
    children: ReactNode;
    defaultIndex?: number;
    items: ReactNode[] | ReadonlyArray<ReactNode> | TabItem[];
    onChange?: (index: number) => void;
    prefix?: string;
    selectedIndex?: number;
}): ReactElement => (
    <HeadlessTab.Group defaultIndex={defaultIndex} onChange={onChange} selectedIndex={selectedIndex}>
        <div className="nextra-scrollbar overflow-x-auto overflow-y-hidden overscroll-x-contain">
            <HeadlessTab.List className="mt-4 flex w-max min-w-full border-b border-gray-400 pb-px dark:border-neutral-800">
                {items.map((item, index) => {
                    const disabled = !!(item && typeof item === "object" && "disabled" in item && item.disabled);

                    return (
                        <HeadlessTab
                            className={({ selected }) =>
                                cn(
                                    "mr-2 rounded-t p-2 font-medium leading-5 transition-colors",
                                    "-mb-0.5 select-none border-b-2",
                                    selected
                                        ? "border-primary-500 text-primary-600"
                                        : "border-transparent text-gray-600 hover:border-gray-400 hover:text-black dark:text-gray-200 dark:hover:border-neutral-800 dark:hover:text-white",
                                    disabled && "pointer-events-none text-gray-400 dark:text-neutral-600",
                                )
                            }
                            disabled={disabled}
                            // eslint-disable-next-line react/no-array-index-key
                            key={`${prefix}-tab-${index}`}
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
    // @ts-expect-error TS2322: Type 'string' is not assignable to type 'Ref<HTMLElement> | undefined'
    // eslint-disable-next-line react/jsx-props-no-spreading
    <HeadlessTab.Panel {...properties} className="rounded pt-6">
        {children}
    </HeadlessTab.Panel>
);
