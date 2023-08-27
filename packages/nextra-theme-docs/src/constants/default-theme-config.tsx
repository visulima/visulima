import { GitHubIcon } from "nextra/icons";
import { isValidElement } from "react";

import Anchor from "../components/anchor";
import FlexSearch from "../components/flexsearch";
import Navbar from "../components/navbar";
import TocPageContent from "../components/toc/toc-page-content";
import TocSidebar from "../components/toc/toc-sidebar";
import type { DocumentationThemeConfig } from "../theme/theme-schema";
import getGitEditUrl from "../utils/get-git-edit-url";

export const DEFAULT_THEME: DocumentationThemeConfig = {
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
    banner: {
        dismissible: true,
        key: "nextra-banner",
    },
    content: {
        permalink: {
            label: ({ locale }: { locale: string }) => {
                if (locale === "zh-CN") {
                    return "Permalink for this section";
                }

                if (locale === "ru") {
                    return "Ссылка на этот раздел";
                }

                if (locale === "fr") {
                    return "Lien permanent pour cette section";
                }

                return "Permalink for this section";
            },
        },
        showDescription: true,
        showTitle: true,
    },
    darkMode: true,
    direction: "ltr",
    docsRepositoryBase: "https://github.com/shuding/nextra",
    editLink: {
        component({ children, className, filePath }) {
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
        content: ({ locale }: { locale: string }) => {
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
    footer: {
        component: () => null,
        copyright: `MIT ${new Date().getFullYear()} © Nextra.`,
    },
    gitTimestamp({ locale, timestamp }) {
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
            <meta content="#fff" name="msapplication-TileColor" />
            <meta content="en" httpEquiv="Content-Language" />
            <meta content="Nextra: the next docs builder" name="description" />
            <meta content="summary_large_image" name="twitter:card" />
            <meta content="@shuding_" name="twitter:site" />
            <meta content="Nextra: the next docs builder" property="og:title" />
            <meta content="Nextra: the next docs builder" property="og:description" />
            <meta content="Nextra" name="apple-mobile-web-app-title" />
        </>
    ),
    i18n: [],
    localSwitch: {
        title: ({ locale }) => {
            if (locale === "zh-CN") {
                return "切换语言";
            }

            if (locale === "ru") {
                return "Переключить язык";
            }

            if (locale === "fr") {
                return "Changer de langue";
            }

            return "Switch language";
        },
    },
    logo: (
        <>
            <span className="font-extrabold">Nextra</span>
            <span className="ml-2 hidden font-normal text-gray-600 lg:inline">The Next Docs Builder</span>
        </>
    ),
    logoLink: true,
    navbar: {
        // eslint-disable-next-line react/jsx-props-no-spreading
        component: (properties) => <Navbar {...properties} />,
    },
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
    serverSideError: {
        content: "Submit an issue about error in url →",
        labels: "bug",
    },
    sidebar: {
        autoCollapse: true,
        defaultMenuCollapseLevel: 2,
        mobileBreakpoint: 1023,
        titleComponent: ({ title }) => <span className="grow">{title}</span>,
    },
    themeSwitch: {
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
    },
    tocContent: {
        component: TocPageContent,
        float: true,
        title: "On This Page",
    },
    tocSidebar: {
        component: TocSidebar,
        float: true,
        title: "On This Page",
    },
    useNextSeoProps: () => {
        return { titleTemplate: "%s – Nextra" };
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
