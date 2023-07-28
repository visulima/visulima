import { Tab as HeadlessTab } from "@headlessui/react";
import cn from "clsx";
import type { ComponentProps, FC, ReactElement, ReactNode } from "react";
import { Children, isValidElement, useId } from "react";

interface TabItem {
    disabled?: boolean;
    label: ReactElement | string;
}

type TabProperties = ComponentProps<"div"> & { disabled?: boolean; title: ReactElement | string };

export const Tab: FC<TabProperties> = ({ children = undefined, title, ...properties }) => (
    // @ts-expect-error TS2322: Type 'string' is not assignable to type 'Ref<HTMLElement> | undefined'
    // eslint-disable-next-line react/jsx-props-no-spreading
    <HeadlessTab.Panel {...properties} className="pt-3">
        {children}
    </HeadlessTab.Panel>
);

export const Tabs = ({
    children,
    defaultIndex = undefined,
    onChange = undefined,
    prefix = "tabs",
    selectedIndex = undefined,
}: {
    children: ReactNode | ReactNode[];
    defaultIndex?: number;
    onChange?: (index: number) => void;
    prefix?: string;
    selectedIndex?: number;
}): ReactElement => {
    const id = useId();
    const tabs: TabItem[] = [];

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

    return (
        <HeadlessTab.Group defaultIndex={defaultIndex} onChange={onChange} selectedIndex={selectedIndex}>
            <div className="nextra-scrollbar not-prose overflow-x-auto overflow-y-hidden overscroll-x-contain">
                <HeadlessTab.List className="mt-4 flex w-max min-w-full border-b border-gray-400 pb-px pl-1 dark:border-neutral-800">
                    {tabs.map((item, index) => (
                        <HeadlessTab
                            /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                            className={({ selected }) =>
                                cn(
                                    "mr-2 rounded-t p-2 font-medium leading-5 transition-colors",
                                    "-mb-0.5 select-none border-b-2",
                                    selected
                                        ? "border-primary-500 text-primary-600"
                                        : "border-transparent text-gray-600 hover:border-gray-400 hover:text-black dark:text-gray-200 dark:hover:border-neutral-800 dark:hover:text-white",
                                    { "pointer-events-none text-gray-400 dark:text-neutral-600": item.disabled },
                                )
                            }
                            disabled={item.disabled}
                            // eslint-disable-next-line react/no-array-index-key
                            key={`${prefix}-${id}-tab-${index}`}
                        >
                            {item.label}
                        </HeadlessTab>
                    ))}
                </HeadlessTab.List>
            </div>
            <HeadlessTab.Panels>{children}</HeadlessTab.Panels>
        </HeadlessTab.Group>
    );
};
