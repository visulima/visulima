import { useRouter } from "next/router";
import { ThemeProvider } from "next-themes";
import type { PageOpts } from "nextra";
import { GitHubIcon } from "nextra/icons";
import type { ReactElement, ReactNode } from "react";
import {
    createContext, isValidElement, useContext, useMemo, useState,
} from "react";

import Anchor from "../components/anchor";
import FlexSearch from "../components/flexsearch";
import MatchSorterSearch from "../components/match-sorter-search";
import Navbar from "../components/navbar";
import TocPageContent from "../components/toc/toc-page-content";
import TocSidebar from "../components/toc/toc-sidebar";
import { DEFAULT_LOCALE } from "../constants";
import type { Context, DocumentationThemeConfig } from "../types";
import { getGitEditUrl } from "../utils";
import { MenuProvider } from "./menu";

const DEFAULT_THEME: DocumentationThemeConfig = {
    banner: {
        dismissible: true,
        key: "nextra-banner",
    },
    darkMode: true,
    direction: "ltr",
    docsRepositoryBase: "https://github.com/shuding/nextra",
    editLink: {
        component({ className, filePath, children }) {
            const editUrl = getGitEditUrl(filePath);
            if (!editUrl) {
                return null;
            }
            return (
                <Anchor className={className} href={editUrl}>
                    {children}
                </Anchor>
            );
        },
        text: "Edit this page",
    },
    feedback: {},
    navbar: {
        component: Navbar,
    },
    footer: {
        copyright: `MIT ${new Date().getFullYear()} © Nextra.`,
    },
    getNextSeoProps: () => {
        return { titleTemplate: "%s – Nextra" };
    },
    gitTimestamp({ timestamp }) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { locale = DEFAULT_LOCALE } = useRouter();

        return (
            <>
                Last updated on{" "}
                {timestamp.toLocaleDateString(locale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                })}
            </>
        );
    },
    head: (
        <>
            <meta name="msapplication-TileColor" content="#fff" />
            <meta httpEquiv="Content-Language" content="en" />
            <meta name="description" content="Nextra: the next docs builder" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@shuding_" />
            <meta property="og:title" content="Nextra: the next docs builder" />
            <meta property="og:description" content="Nextra: the next docs builder" />
            <meta name="apple-mobile-web-app-title" content="Nextra" />
        </>
    ),
    i18n: [],
    logo: (
        <>
            <span className="font-extrabold">Nextra</span>
            <span className="ml-2 hidden font-normal text-gray-600 md:inline">The Next Docs Builder</span>
        </>
    ),
    logoLink: true,
    navigation: {
        next: true,
        prev: true,
    },
    nextThemes: {
        defaultTheme: "system",
        storageKey: "theme",
    },
    notFound: {
        content: "Submit an issue about broken link",
        labels: "bug",
    },
    primaryHue: {
        dark: 204,
        light: 212,
    },
    project: {
        icon: (
            <>
                <GitHubIcon />
                <span className="sr-only">GitHub</span>
            </>
        ),
    },
    search: {
        component({ className, directories }) {
            // eslint-disable-next-line react-hooks/rules-of-hooks,@typescript-eslint/no-use-before-define
            const config = useConfig();

            return config.flexsearch ? <FlexSearch className={className} /> : <MatchSorterSearch className={className} directories={directories} />;
        },
        emptyResult: <span className="block select-none p-8 text-center text-sm text-gray-400">No results found.</span>,
        loading() {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { locale } = useRouter();

            if (locale === "zh-CN") {
                return "正在加载…";
            }

            if (locale === "ru") {
                return "Загрузка…";
            }

            if (locale === "fr") {
                return "Сhargement…";
            }

            return "Loading…";
        },
        placeholder() {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { locale } = useRouter();

            if (locale === "zh-CN") {
                return "搜索文档…";
            }

            if (locale === "ru") {
                return "Поиск документации…";
            }

            if (locale === "fr") {
                return "Rechercher de la documentation…";
            }

            return "Search documentation…";
        },
    },
    serverSideError: {
        content: "Submit an issue about error in url →",
        labels: "bug",
    },
    sidebar: {
        defaultMenuCollapseLevel: 2,
        // eslint-disable-next-line react/jsx-no-useless-fragment
        titleComponent: ({ title }) => <>{title}</>,
    },
    tocSidebar: {
        component: TocSidebar,
        float: true,
        title: "On This Page",
    },
    tocContent: {
        component: TocPageContent,
        float: true,
        title: "On This Page",
    },
};

const DEEP_OBJECT_KEYS = Object.entries(DEFAULT_THEME)
    .map(([key, value]) => {
        const isObject = value && typeof value === "object" && !Array.isArray(value) && !isValidElement(value);

        if (isObject) {
            return key;
        }

        return null;
    })
    .filter(Boolean) as (keyof DocumentationThemeConfig)[];

const theme = {
    title: "",
    frontMatter: {},
    ...DEFAULT_THEME,
};

const ConfigContext = createContext<Config>(theme);

export const useConfig = () => useContext(ConfigContext);

// eslint-disable-next-line radar/cognitive-complexity
export const ConfigProvider = ({ children, value: { themeConfig, pageOpts } }: { children: ReactNode; value: Context }): ReactElement => {
    const [menu, setMenu] = useState(false);

    const extendedConfig: Config = useMemo(() => {
        return {
            ...DEFAULT_THEME,
            ...themeConfig,
            flexsearch: pageOpts.flexsearch,
            ...(typeof pageOpts.newNextLinkBehavior === "boolean" && {
                newNextLinkBehavior: pageOpts.newNextLinkBehavior,
            }),
            title: pageOpts.title,
            frontMatter: pageOpts.frontMatter,
            ...Object.fromEntries(
                DEEP_OBJECT_KEYS.map((key) => (typeof themeConfig[key] === "object"
                    ? [
                        key,
                        // @ts-expect-error -- key has always object value
                        { ...DEFAULT_THEME[key], ...themeConfig[key] },
                    ]
                    : [])),
            ),
        };
    }, [themeConfig, pageOpts.flexsearch, pageOpts.newNextLinkBehavior, pageOpts.title, pageOpts.frontMatter]);

    const { nextThemes } = extendedConfig;

    return (
        <ThemeProvider
            attribute="class"
            disableTransitionOnChange
            defaultTheme={nextThemes.defaultTheme}
            storageKey={nextThemes.storageKey}
            forcedTheme={nextThemes.forcedTheme}
        >
            <ConfigContext.Provider value={extendedConfig}>
                <MenuProvider value={{ menu, setMenu }}>{children}</MenuProvider>
            </ConfigContext.Provider>
        </ThemeProvider>
    );
};

export type Config = DocumentationThemeConfig & Pick<PageOpts, "flexsearch" | "frontMatter" | "newNextLinkBehavior" | "title">;
