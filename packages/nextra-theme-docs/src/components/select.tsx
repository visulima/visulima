import { Listbox, Transition } from "@headlessui/react";
import clsx from "clsx";
import { useMounted } from "nextra/hooks";
import { CheckIcon } from "nextra/icons";
import type { FC, PropsWithChildren, ReactElement } from "react";
import { createPortal } from "react-dom";

import { cn, usePopper } from "../utils";

interface MenuOption {
    key: string;
    name: ReactElement | string;
}

interface MenuProperties {
    selected: MenuOption;
    onChange: (option: MenuOption) => void;
    options: MenuOption[];
    title?: string;
    className?: string;
}

const Portal: FC<PropsWithChildren> = ({ children }) => {
    const mounted = useMounted();

    if (!mounted) {
        return null;
    }

    return createPortal(children, document.body);
};

const Select: FC<MenuProperties> = ({
    options, selected, onChange, title, className,
}) => {
    const [trigger, container] = usePopper({
        strategy: "fixed",
        placement: "top-start",
        modifiers: [
            { name: "offset", options: { offset: [0, 10] } },
            {
                name: "sameWidth",
                enabled: true,
                fn({ state }) {
                    // eslint-disable-next-line no-param-reassign
                    state.styles.popper.minWidth = `${state.rects.reference.width}px`;
                },
                phase: "beforeWrite",
                requires: ["computeStyles"],
            },
        ],
    });

    return (
        <Listbox value={selected} onChange={onChange}>
            {({ open }) => (
                <Listbox.Button
                    ref={trigger}
                    title={title}
                    className={cn(
                        "h-7 rounded-lg px-2 text-left text-xs font-medium text-gray-600 transition-colors dark:text-gray-400",
                        open
                            ? "bg-gray-200 text-gray-900 dark:bg-primary-100/10 dark:text-gray-50"
                            : "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-primary-100/5 dark:hover:text-gray-50",
                        className,
                    )}
                >
                    {selected.name}
                    <Portal>
                        <Transition
                            // @ts-expect-error
                            ref={container}
                            show={open}
                            as={Listbox.Options}
                            // eslint-disable-next-line max-len
                            className="z-20 max-h-64 overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 dark:bg-neutral-800 dark:ring-white/20"
                            leave="transition-opacity"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            {options.map((option) => (
                                <Listbox.Option
                                    key={option.key}
                                    value={option}
                                    className={({ active }) => clsx(
                                        active ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10" : "text-gray-800 dark:text-gray-100",
                                        "relative cursor-pointer whitespace-nowrap py-1.5",
                                        "ltr:pl-3 ltr:pr-9 rtl:pr-3 rtl:pl-9",
                                    )}
                                >
                                    {option.name}
                                    {option.key === selected.key && (
                                        <span className="absolute inset-y-0 flex items-center ltr:right-3 rtl:left-3">
                                            <CheckIcon />
                                        </span>
                                    )}
                                </Listbox.Option>
                            ))}
                        </Transition>
                    </Portal>
                </Listbox.Button>
            )}
        </Listbox>
    );
};

export default Select;
