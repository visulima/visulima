import type { Dispatch, FC, SetStateAction } from "react";
import type { SupportedTargets } from "@readme/oas-to-snippet";
import { oasToSnippet, supportedLanguages } from "@readme/oas-to-snippet";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import type { Operation } from "oas";
import type { ClientId } from "@readme/httpsnippet/dist/targets/targets";
import type { Language } from "prism-react-renderer";
import { Highlight, Prism, themes } from "prism-react-renderer";
import cn from "clsx";
import { twMerge } from "tailwind-merge";
import { useMounted } from "nextra/hooks";
import type Oas from "oas";

import { useConfig } from "../../../config";
import Pre from "../../pre";
import Code from "../../code";
import { renderString } from "../../../utils/render";
import { DEFAULT_LOCALE } from "../../../constants/base";
import type { Server } from "./types";
import EllipsisVerticalIcon from "../../../icons/ellipsis-vertical";
import Select from "../../select";
import QuestionMarkCircleIcon from "../../../icons/question-mark-circle";
import { getMethodTextColor } from "./utils/api-playground-colors";
import { iconMap, installGuide, snippedLanguageToPrismLanguage } from "./utils/snippet/helper";
import type { Config } from "../../../contexts/config";

(typeof global === "undefined" ? window : global).Prism = Prism;

import("prismjs/components/prism-markup-templating");
import("prismjs/components/prism-c");
import("prismjs/components/prism-clojure");
import("prismjs/components/prism-csharp");
import("prismjs/components/prism-http");
import("prismjs/components/prism-java");
import("prismjs/components/prism-javascript");
import("prismjs/components/prism-json");
import("prismjs/components/prism-ocaml");
import("prismjs/components/prism-php");
import("prismjs/components/prism-powershell");
import("prismjs/components/prism-python");
import("prismjs/components/prism-ruby");
import("prismjs/components/prism-r");
import("prismjs/components/prism-shell-session");

const buttonClasses = cn(
    "bg-white dark:bg-primary-100/10 p-2 rounded-lg border",
    "flex flex-col items-center grow min-w-[77px]",
    "contrast-more:text-gray-700 contrast-more:dark:text-gray-100 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm capitalize",
    "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-primary-100/5 dark:hover:text-gray-50",
);

const LocalStorageLanguageKey = "visulima-nextra-snippet-language";
const LocalStorageSwitchedLanguageKey = "visulima-nextra-snippet-switched-language";

const saveToLocalStorage = (key: string, newValue: string) => {
    localStorage.setItem(key, newValue);

    // the storage event only get picked up (by the listener) if the localStorage was changed in
    // another browser's tab/window (of the same app), but not within the context of the current tab.
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
};

type SnippetLanguage = [SupportedTargets, ClientId];

const LanguageNav: FC<{
    config: Config;
    filteredLanguages: string[];
    language: SnippetLanguage;
    locale: string;
    setLanguage: Dispatch<SetStateAction<SnippetLanguage>>;
    setSwitchedLanguage: Dispatch<SetStateAction<SupportedTargets>>;
    switchedLanguage: SupportedTargets;
    visibleLanguages: string[];
}> = ({ config, filteredLanguages, language, locale, setLanguage, setSwitchedLanguage, switchedLanguage, visibleLanguages }) => {
    // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-unnecessary-condition
    const SwitchLanguageIcon = iconMap[switchedLanguage] ?? QuestionMarkCircleIcon;

    return (
        <div className="mt-4 inline-flex w-full gap-2 xl:!mt-0">
            {visibleLanguages.map((lang) => {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                const Icon = iconMap[lang as keyof typeof supportedLanguages | "curl" | "node-simple"] ?? QuestionMarkCircleIcon;

                return (
                    <button
                        className={cn(buttonClasses, {
                            "border-white": lang !== language[0],
                        })}
                        onClick={() => {
                            const value: [SupportedTargets, string] = [
                                lang as SupportedTargets,
                                supportedLanguages[lang as SupportedTargets].httpsnippet.default,
                            ];

                            setLanguage(value);
                            saveToLocalStorage(LocalStorageLanguageKey, JSON.stringify(value));
                        }}
                        title={lang}
                        type="button"
                    >
                        <Icon className="h-6 w-6" />
                        <span className="block pt-2 ">{lang}</span>
                    </button>
                );
            })}
            <button
                className={cn(buttonClasses, {
                    "border-white": switchedLanguage !== language[0],
                })}
                onClick={() => {
                    const value: [SupportedTargets, string] = [
                        switchedLanguage as SupportedTargets,
                        supportedLanguages[switchedLanguage as SupportedTargets].httpsnippet.default,
                    ];

                    setLanguage(value);
                    saveToLocalStorage(LocalStorageLanguageKey, JSON.stringify(value));
                }}
                title={switchedLanguage as string}
                type="button"
            >
                <SwitchLanguageIcon className="h-6 w-6" />
                <span className="block pt-2 ">{switchedLanguage}</span>
            </button>
            <Select
                className={cn(
                    "block p-2 m-auto rounded-lg border border-white hover:border-gray-50 h-full",
                    "contrast-more:text-gray-700 contrast-more:dark:text-gray-100 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm",
                )}
                /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                onChange={(option) => {
                    const selectedLanguage: SupportedTargets = option.name as SupportedTargets;

                    setSwitchedLanguage(selectedLanguage);
                    saveToLocalStorage(LocalStorageSwitchedLanguageKey, selectedLanguage);

                    const value: [SupportedTargets, string] = [
                        option.name as SupportedTargets,
                        supportedLanguages[option.name as SupportedTargets].httpsnippet.default,
                    ];

                    setLanguage(value);
                    saveToLocalStorage(LocalStorageLanguageKey, JSON.stringify(value));
                }}
                options={filteredLanguages.map((lang) => {
                    return { key: lang, name: lang };
                })}
                /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                selected={{
                    key: switchedLanguage as string,
                    name: switchedLanguage as string,
                }}
                title={renderString(config.api.snippet.languageSwitcherTitle, { locale })}
            >
                <>
                    <EllipsisVerticalIcon className="h-6 w-6" />
                    <span className="sr-only">Open</span>
                </>
            </Select>
        </div>
    );
};

const Snippet: FC<{
    apiDefinition: Oas;
    operation: Operation;
    path: string;
    server?: Server;
}> = ({ apiDefinition, operation, parameterValues, path, server = undefined }) => {
    const config = useConfig();
    const { locale } = useRouter();
    const mounted = useMounted();

    const { defaultLanguage, defaultSwitchLanguage, title, visibleLanguages } = config.api.snippet;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (supportedLanguages[defaultLanguage as SupportedTargets] === undefined) {
        throw new Error(`Invalid default language: ${defaultLanguage}`);
    }

    const filteredLanguages = useMemo(
        () =>
            Object.keys(supportedLanguages)
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                .filter((language) => {
                    let visible = true;

                    visibleLanguages.forEach((vLanguage) => {
                        if (vLanguage === language) {
                            visible = false;
                        }
                    });

                    return visible;
                })
                .filter(Boolean),
        [visibleLanguages],
    );

    const [language, setLanguage] = useState<SnippetLanguage>([
        defaultLanguage as SupportedTargets,
        supportedLanguages[defaultLanguage as SupportedTargets].httpsnippet.default,
    ]);
    const [switchedLanguage, setSwitchedLanguage] = useState<SupportedTargets>(defaultSwitchLanguage as SupportedTargets);

    useEffect(() => {
        const handleEvent = (event: StorageEvent) => {
            if (event.key === LocalStorageLanguageKey && event.newValue !== null) {
                setLanguage(JSON.parse(event.newValue) as SnippetLanguage);
            }

            if (event.key === LocalStorageSwitchedLanguageKey && event.newValue !== null) {
                setSwitchedLanguage(event.newValue as SupportedTargets);
            }
        };

        const storedLanguage = localStorage.getItem(LocalStorageLanguageKey);

        if (storedLanguage !== null) {
            setLanguage(JSON.parse(storedLanguage) as SnippetLanguage);
        }

        const storedSwitchedLanguage = localStorage.getItem(LocalStorageSwitchedLanguageKey);

        if (storedSwitchedLanguage !== null) {
            setSwitchedLanguage(storedSwitchedLanguage as SupportedTargets);
        }

        window.addEventListener("storage", handleEvent);

        return () => {
            window.removeEventListener("storage", handleEvent);
        };
    }, []);

    const { code, highlightMode } = oasToSnippet(apiDefinition, operation as Operation, {}, { oauth2: "bearerToken" }, language, server?.url);

    return (
        <>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 xl:-mt-12">{renderString(title, { locale: locale ?? DEFAULT_LOCALE })}</h3>
            {!mounted && <div className="h-96 animate-pulse bg-gray-100 dark:bg-gray-800" />}
            {mounted && (
                <>
                    <LanguageNav
                        config={config}
                        filteredLanguages={filteredLanguages}
                        language={language}
                        locale={locale ?? DEFAULT_LOCALE}
                        setLanguage={setLanguage}
                        setSwitchedLanguage={setSwitchedLanguage}
                        switchedLanguage={switchedLanguage}
                        visibleLanguages={visibleLanguages}
                    />
                    <Pre
                        /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                        classNames={{
                            pre: "overflow-auto",
                        }}
                        header={
                            <>
                                <div className="flex h-9 items-center gap-2 px-4">
                                    <span className={cn("text-xs font-semibold leading-6", getMethodTextColor(operation.method))}>{operation.method}</span>
                                    <span className="h-0.5 w-0.5 rounded-full bg-white" />
                                    <span className="text-xs leading-6 text-white">{path}</span>
                                </div>
                                <div className="flex h-8 flex-auto items-center justify-items-end gap-4 rounded-tl border border-slate-500/30 bg-slate-700/50 px-4">
                                    <span className="text-xs text-white">Library:</span>
                                    {Object.entries(supportedLanguages[language[0] as SupportedTargets].httpsnippet.targets).map(([key, { name }]) => (
                                        <button
                                            className={twMerge(
                                                cn("text-sm text-white/75 hover:text-gray-300 transition ui-not-focus-visible:outline-none border-none", {
                                                    "text-blue-300 hover:text-blue-300": key === language[1],
                                                }),
                                            )}
                                            onClick={() => {
                                                const value: [SupportedTargets, string] = [language[0], key as ClientId];

                                                setLanguage(value);
                                                saveToLocalStorage(LocalStorageLanguageKey, JSON.stringify(value));
                                            }}
                                            key={key}
                                            type="button"
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>

                                {installGuide[`${language[0]}_${language[1]}`] && (
                                    <>
                                        <h4 className="px-4 py-2 text-sm text-white">Installation Guide</h4>
                                        <div className="flex flex-auto flex-col justify-items-end gap-4 rounded-tl border border-slate-500/30 bg-slate-700/50 px-4 py-1 text-sm text-white/75">
                                            {installGuide[`${language[0]}_${language[1]}`]}
                                        </div>
                                    </>
                                )}
                            </>
                        }
                        data-language={language[0]}
                        data-target={language[1]}
                        filename="Request"
                        hasCopyCode
                    >
                        <Highlight
                            code={code as string}
                            language={snippedLanguageToPrismLanguage[highlightMode as string] ?? (highlightMode as Language)}
                            theme={themes.jettwaveDark}
                        >
                            {({ getLineProps, getTokenProps, tokens }) => (
                                <Code>
                                    {tokens.map((line, index) => (
                                        // eslint-disable-next-line react/no-array-index-key,react/jsx-props-no-spreading
                                        <div key={index} {...getLineProps({ line })}>
                                            {line.map((token, key) => (
                                                // eslint-disable-next-line react/no-array-index-key,react/jsx-props-no-spreading
                                                <span key={key} {...getTokenProps({ token })} />
                                            ))}
                                        </div>
                                    ))}
                                </Code>
                            )}
                        </Highlight>
                    </Pre>
                </>
            )}
        </>
    );
};

export default Snippet;
