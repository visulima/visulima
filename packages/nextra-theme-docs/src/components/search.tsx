import { Transition } from "@headlessui/react";
import cn from "clsx";
import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import { InformationCircleIcon, SpinnerIcon } from "nextra/icons";
import type { FC, KeyboardEvent } from "react";
import {
 Fragment, useCallback, useEffect, useRef, useState,
} from "react";

import { DEFAULT_LOCALE } from "../constants";
import { useConfig, useMenu } from "../contexts";
import type { SearchResult } from "../types";
import { renderComponent, renderString } from "../utils";
import Anchor from "./anchor";
import Input from "./input";

type SearchProperties = {
    className?: string;
    overlayClassName?: string;
    value: string;
    onChange: (newValue: string) => Promise<void>;
    onActive?: (active: boolean) => Promise<void>;
    loading?: boolean;

    error?: boolean;
    results: SearchResult[];
};

const INPUTS = new Set(["input", "select", "button", "textarea"]);

const Search: FC<SearchProperties> = ({
    className,
    overlayClassName,
    value,
    onChange,
    onActive,
    loading,
    error,
    results,
    // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
    const [show, setShow] = useState(false);
    const config = useConfig();
    const [active, setActive] = useState(0);
    const router = useRouter();
    const { setMenu } = useMenu();
    const input = useRef<HTMLInputElement>(null);
    const ulReference = useRef<HTMLUListElement>(null);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        setActive(0);
    }, [value]);

    useEffect(() => {
        const down = (keyboardEvent: globalThis.KeyboardEvent): void => {
            const tagName = document.activeElement?.tagName.toLowerCase();

            if (!input.current || !tagName || INPUTS.has(tagName)) {
                return;
            }

            if (keyboardEvent.key === "/" || (keyboardEvent.key === "k" && (keyboardEvent.metaKey /* for Mac */ || /* for non-Mac */ keyboardEvent.ctrlKey))) {
                keyboardEvent.preventDefault();
                input.current.focus();
            } else if (keyboardEvent.key === "Escape") {
                setShow(false);

                input.current.blur();
            }
        };

        window.addEventListener("keydown", down);

        return () => {
            window.removeEventListener("keydown", down);
        };
    }, []);

    const handleActive = useCallback((event: { currentTarget: { dataset: DOMStringMap } }) => {
        const { index } = event.currentTarget.dataset;

        setActive(Number(index));
    }, []);

    const finishSearch = () => {
        input.current?.blur();
        onChange("");
        setShow(false);
        setMenu(false);
    };

    const handleKeyDown = useCallback(
        (kEvent: KeyboardEvent<any>) => {
            // eslint-disable-next-line default-case
            switch (kEvent.key) {
                case "ArrowDown": {
                    if (active + 1 < results.length) {
                        const element = ulReference.current?.querySelector<HTMLAnchorElement>(`li:nth-of-type(${active + 2}) > a`);

                        if (element) {
                            kEvent.preventDefault();

                            handleActive({ currentTarget: element });
                            element.focus();
                        }
                    }

                    break;
                }
                case "ArrowUp": {
                    if (active - 1 >= 0) {
                        const element = ulReference.current?.querySelector<HTMLAnchorElement>(`li:nth-of-type(${active}) > a`);

                        if (element) {
                            kEvent.preventDefault();

                            handleActive({ currentTarget: element });
                            element.focus();
                        }
                    }

                    break;
                }
                case "Enter": {
                    const result = results[active];

                    if (result) {
                        router.push(result.route);

                        finishSearch();
                    }

                    break;
                }
                case "Escape": {
                    setShow(false);

                    input.current?.blur();

                    break;
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [active, results, router, handleActive],
    );

    const mounted = useMounted();
    const renderList = show && Boolean(value);

    const icon = (
        <Transition
            show={mounted && (!show || Boolean(value))}
            as={Fragment}
            enter="transition-opacity"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
        >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <kbd
                className={cn(
                    "absolute my-1.5 select-none ltr:right-1.5 rtl:left-1.5",
                    "h-5 rounded bg-white px-1.5 font-mono text-[10px] font-medium text-gray-500",
                    "border dark:border-gray-100/20 dark:bg-darker-800",
                    "contrast-more:border-current contrast-more:text-current contrast-more:dark:border-current",
                    "items-center gap-1 transition-opacity",
                    value ? "z-20 flex cursor-pointer hover:opacity-70" : "pointer-events-none hidden sm:flex",
                )}
                title={value ? "Clear" : undefined}
                onClick={() => {
                    onChange("");
                }}
            >
                {value && focused
                    ? "ESC"
                    : mounted
                      && (navigator.userAgent.includes("Macintosh") ? (
                          <>
                              <span className="text-xs">⌘</span>K
                          </>
                      ) : (
                          "CTRL K"
                      ))}
            </kbd>
        </Transition>
    );

    const locale = router.locale ?? DEFAULT_LOCALE;

    return (
        <div className={cn("nextra-search relative lg:w-64", className)}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            {renderList && <div className="fixed inset-0 z-10" onClick={() => setShow(false)} />}

            <Input
                ref={input}
                value={value}
                onChange={(event) => {
                    const { value: eventValue } = event.target;

                    onChange(eventValue);
                    setShow(Boolean(eventValue));
                }}
                onFocus={() => {
                    onActive?.(true);
                    setFocused(true);
                }}
                onBlur={() => {
                    setFocused(false);
                }}
                type="search"
                placeholder={renderString(config.search.placeholder, { locale })}
                onKeyDown={handleKeyDown}
                suffix={icon}
            />

            <Transition
                show={renderList}
                // Transition.Child is required here, otherwise popup will be still present in DOM after focus out
                as={Transition.Child}
                leave="transition-opacity duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
            >
                <ul
                    className={cn(
                        "nextra-scrollbar",
                        // Using bg-white as background-color when the browser didn't support backdrop-filter
                        "border border-gray-200 bg-white text-gray-100 dark:border-neutral-800 dark:bg-neutral-900",
                        "absolute top-full z-20 mt-2 overflow-auto overscroll-contain rounded-lg py-2.5 shadow-lg",
                        "max-h-[min(calc(50vh-11rem-env(safe-area-inset-bottom)),400px)]",
                        "lg:max-h-[min(calc(100vh-5rem-env(safe-area-inset-bottom)),400px)]",
                        "inset-x-0 ltr:lg:left-auto rtl:lg:right-auto",
                        "contrast-more:border contrast-more:border-gray-900 contrast-more:dark:border-gray-50",
                        overlayClassName,
                    )}
                    ref={ulReference}
                    style={{
                        transition: "max-height .2s ease", // don't work with tailwindcss
                    }}
                >
                    {error ? (
                        <span className="flex select-none justify-center gap-2 p-8 text-center text-sm text-red-500">
                            <InformationCircleIcon className="h-5 w-5" />
                            {renderString(config.search.error, { locale })}
                        </span>
                    ) : (loading ? (
                        <span className="flex select-none justify-center gap-2 p-8 text-center text-sm text-gray-400">
                            <SpinnerIcon className="h-5 w-5 animate-spin" />
                            {renderString(config.search.loading, { locale })}
                        </span>
                    ) // eslint-disable-next-line unicorn/no-nested-ternary
                    : results.length > 0 ? (
                        results.map(({
 route, prefix, children, id,
}, index) => (
                            <Fragment key={id}>
                                {prefix}
                                <li
                                    className={cn(
                                        "mx-2.5 break-words rounded-lg",
                                        "contrast-more:border",
                                        index === active
                                            ? "bg-primary-500/10 text-primary-600 contrast-more:border-primary-500"
                                            : "text-gray-800 contrast-more:border-transparent dark:text-gray-300",
                                    )}
                                >
                                    <Anchor
                                        className="block scroll-m-12 px-2.5 py-2"
                                        href={route}
                                        data-index={index}
                                        onFocus={handleActive}
                                        onMouseMove={handleActive}
                                        onClick={finishSearch}
                                        onKeyDown={handleKeyDown}
                                    >
                                        {children}
                                    </Anchor>
                                </li>
                            </Fragment>
                        ))
                    ) : (
                        renderComponent(config.search.emptyResult)
                    ))}
                </ul>
            </Transition>
        </div>
    );
};

export default Search;
