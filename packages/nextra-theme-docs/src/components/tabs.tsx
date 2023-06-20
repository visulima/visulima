import { Tab as HeadlessTab } from "@headlessui/react";
import cn from "clsx";
import type { ComponentProps, FC, ReactElement, ReactNode } from "react";
import {Children, isValidElement, useId} from "react";

type TabItem = {
    label: ReactElement | string;
    disabled?: boolean;
};

type TabProps = ComponentProps<"div"> & { title: ReactElement | string; disabled?: boolean };

export const Tabs = ({
    selectedIndex,
    defaultIndex,
    onChange,
    children,
    prefix = "tabs",
}: {
    selectedIndex?: number;
    defaultIndex?: number;
    onChange?: (index: number) => void;
    children: ReactNode | ReactNode[];
    prefix?: string;
}): ReactElement => {
    const id = useId();
    let tabs: TabItem[] = [];

    Children.forEach(Children.toArray(children), (child) => {
        if (isValidElement(child)) {
            if ((child as ReactElement<TabProps>).type === Tab) {
                const { title, disabled } = (child as ReactElement<TabProps>).props;
                tabs.push({
                    label: title,
                    disabled: disabled,
                });
            } else {
                throw new Error("Children of `Tabs` must be of type `Tab`");
            }
        }
    });

    return (
        <HeadlessTab.Group selectedIndex={selectedIndex} defaultIndex={defaultIndex} onChange={onChange}>
            <div className="nextra-scrollbar not-prose overflow-x-auto overflow-y-hidden overscroll-x-contain pl-2">
                <HeadlessTab.List className="mt-4 flex w-max min-w-full border-b border-gray-400 pb-px dark:border-neutral-800">
                    {tabs.map((item, index) => {
                        return (
                            <HeadlessTab
                                // eslint-disable-next-line react/no-array-index-key
                                key={`${prefix}-${id}-tab-${index}`}
                                disabled={item.disabled}
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
                            >
                                {item.label}
                            </HeadlessTab>
                        );
                    })}
                </HeadlessTab.List>
            </div>
            <HeadlessTab.Panels>{children}</HeadlessTab.Panels>
        </HeadlessTab.Group>
    );
};

export const Tab: FC<TabProps> = ({ title, children, ...properties }) => (
    // @ts-expect-error TS2322: Type 'string' is not assignable to type 'Ref<HTMLElement> | undefined'
    // eslint-disable-next-line react/jsx-props-no-spreading
    <HeadlessTab.Panel {...properties} className="pt-6 pl-2 pr-2.5">
        {children}
    </HeadlessTab.Panel>
);
