import { GitHubIcon } from "nextra/icons";
import { isValidElement } from "react";

import Anchor from "./components/anchor";
import FlexSearch from "./components/flexsearch";
import Navbar from "./components/navbar";
import TocPageContent from "./components/toc/toc-page-content";
import TocSidebar from "./components/toc/toc-sidebar";
import type { DocumentationThemeConfig } from "./theme/theme-schema";
import type { PageTheme } from "./types";
import { getGitEditUrl } from "./utils";

export const DEFAULT_LOCALE = "en-US";

export const IS_BROWSER = typeof window !== "undefined";

export const DEFAULT_PAGE_THEME: PageTheme = {
    breadcrumb: true,
    collapsed: false,
    footer: true,
    layout: "default",
    navbar: true,
    pagination: true,
    sidebar: true,
    timestamp: true,
    toc: true,
    typesetting: "default",
};

export const DEFAULT_THEME: DocumentationThemeConfig = {
    newNextLinkBehavior: false,
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
        content: ({ locale }) => {
            if (locale === "zh-CN") {
                return <>在 GitHub 上编辑此页</>;
            }

            if (locale === "ru") {
                return <>Редактировать эту страницу на GitHub</>;
            }

            if (locale === "fr") {
                return <>Modifier cette page sur GitHub</>;
            }

            return <>Edit this page on GitHub</>;
        },
    },
    feedback: {
        content: "Question? Give us feedback →",
        labels: "feedback",
    },
    navbar: {
        component: Navbar,
    },
    footer: {
        component: () => null,
        copyright: `MIT ${new Date().getFullYear()} © Nextra.`,
    },
    gitTimestamp({ timestamp, locale }) {
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
            <span className="ml-2 hidden font-normal text-gray-600 lg:inline">The Next Docs Builder</span>
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
        codeblocks: false,
        component({ className }) {
            return <FlexSearch className={className} />;
        },
        emptyResult: <span className="block select-none p-8 text-center text-sm text-gray-400">No results found.</span>,
        error({ locale }) {
            if (locale === "zh-CN") {
                return "无法加载搜索索引。";
            }

            if (locale === "ru") {
                return "Не удалось загрузить поисковый индекс.";
            }

            if (locale === "fr") {
                return "Impossible de charger l'index de recherche.";
            }

            return "Failed to load search index.";
        },
        loading({ locale }) {
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
        placeholder: ({ locale }) => {
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
        position: "navbar",
    },
    backToTop: {
        active: true,
        content: ({ locale }: { locale: string }) => {
            if (locale === "zh-CN") {
                return "返回顶部";
            }

            if (locale === "ru") {
                return "Вернуться к началу";
            }

            if (locale === "fr") {
                return "Retour en haut";
            }

            return "Back to top";
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
    useNextSeoProps: () => {
        return { titleTemplate: "%s – Nextra" };
    },
    themeSwitch: {
        title: ({ locale }) => {
            if (locale === "zh-CN") {
                return "切换主题";
            }

            if (locale === "ru") {
                return "Переключить тему";
            }

            if (locale === "fr") {
                return "Changer de thème";
            }

            return "Switch theme";
        },
        light: ({ locale }) => {
            if (locale === "zh-CN") {
                return "浅色";
            }

            if (locale === "ru") {
                return "Светлая";
            }

            if (locale === "fr") {
                return "Clair";
            }

            return "Light";
        },
        dark: ({ locale }) => {
            if (locale === "zh-CN") {
                return "深色";
            }

            if (locale === "ru") {
                return "Темная";
            }

            if (locale === "fr") {
                return "Sombre";
            }

            return "Dark";
        },
        system: ({ locale }) => {
            if (locale === "zh-CN") {
                return "跟随系统";
            }

            if (locale === "ru") {
                return "Системная";
            }

            if (locale === "fr") {
                return "Système";
            }

            return "System";
        },
    },
};

export const DEEP_OBJECT_KEYS = Object.entries(DEFAULT_THEME)
    .map(([key, value]) => {
        const isObject = value && typeof value === "object" && !Array.isArray(value) && !isValidElement(value);

        if (isObject) {
            return key;
        }

        return null;
    })
    .filter(Boolean);

export const ERROR_ROUTES = new Set(["/404", "/500"]);
