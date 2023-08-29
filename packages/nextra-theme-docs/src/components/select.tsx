import { Listbox, Transition } from "@headlessui/react";
import clsx from "clsx";
import { useMounted } from "nextra/hooks";
import { CheckIcon } from "nextra/icons";
import type { FC, PropsWithChildren, ReactElement } from "react";
import { createPortal } from "react-dom";

import cn from "../utils/cn";
import usePopper from "../utils/use-popper";

interface MenuProperties {
    children?: ReactElement;
    className?: string;
    onChange: (option: MenuOption) => void;
    options: MenuOption[];
    selected: MenuOption;
    title?: string;
}

const Portal: FC<PropsWithChildren> = ({ children = undefined }) => {
    const mounted = useMounted();

    if (!mounted) {
        return null;
    }

    return createPortal(children, document.body);
};

const Select: FC<MenuProperties> = ({ children = undefined, className = undefined, onChange, options, selected, title = undefined }) => {
    // eslint-disable-next-line @arthurgeron/react-usememo/require-usememo
    const [trigger, container] = usePopper({
        modifiers: [
            { name: "offset", options: { offset: [0, 10] } },
            {
                enabled: true,
                fn({ state }) {
                    // eslint-disable-next-line no-param-reassign
                    (state.styles as { popper: { minWidth: string } }).popper.minWidth = `${state.rects.reference.width}px`;
                },
                name: "sameWidth",
                phase: "beforeWrite",
                requires: ["computeStyles"],
            },
        ],
        placement: "top-start",
        strategy: "fixed",
    });

    return (
        <Listbox onChange={onChange} value={selected}>
            {({ open }) => (
                <Listbox.Button
                    className={cn(
                        "h-7 rounded-lg px-2 text-left text-xs font-medium text-gray-600 transition-colors dark:text-gray-400",
                        open
                            ? "bg-gray-200 text-gray-900 dark:bg-primary-100/10 dark:text-gray-50"
                            : "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-primary-100/5 dark:hover:text-gray-50",
                        className,
                    )}
                    ref={trigger}
                    title={title}
                >
                    {children ?? selected.name}
                    <Portal>
                        <Transition
                            as={Listbox.Options}
                            className="z-20 max-h-64 overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 dark:bg-neutral-800 dark:ring-white/20"
                            leave="transition-opacity"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                            ref={container}
                            show={open}
                        >
                            {options.map((option) => (
                                <Listbox.Option
                                    className={({ active }) =>
                                        clsx(
                                            active ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10" : "text-gray-800 dark:text-gray-100",
                                            "relative cursor-pointer whitespace-nowrap py-1.5",
                                            "ltr:pl-3 ltr:pr-9 rtl:pl-9 rtl:pr-3",
                                        )
                                    }
                                    key={option.key}
                                    value={option}
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

export interface MenuOption {
    key: string;
    name: ReactElement | string;
}

export default Select;
