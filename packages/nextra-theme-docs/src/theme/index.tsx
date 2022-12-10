import "focus-visible";
import "./polyfill";

import { MDXProvider } from "@mdx-js/react";
import cn from "clsx";
import { useRouter } from "next/router";
import type { PageMapItem, PageOpts } from "nextra";
import type { FC, PropsWithChildren, ReactNode } from "react";
import { useMemo, useRef } from "react";
import { Toaster } from "react-hot-toast";

import Banner from "../components/banner";
import Breadcrumb from "../components/breadcrumb";
import Comments from "../components/comments";
import Footer from "../components/footer";
import Head from "../components/head";
import NavLinks from "../components/nav-links";
import Prose from "../components/prose";
import Sidebar from "../components/sidebar";
import { DEFAULT_LOCALE } from "../constants";
import { ActiveAnchorProvider, ConfigProvider, useConfig } from "../contexts";
import getComponents from "../mdx-components";
import type { PageTheme } from "../types";
import type { Item } from "../utils";
import { getFSRoute, normalizePages, renderComponent } from "../utils";
import useOnScreen from "../utils/use-on-screen";

const useDirectoryInfo = (pageMap: PageMapItem[]) => {
    const { locale = DEFAULT_LOCALE, defaultLocale, route } = useRouter();

    return useMemo(() => {
        // asPath can return redirected url
        const fsPath = getFSRoute(route, locale);

        return normalizePages({
            list: pageMap,
            locale,
            defaultLocale,
            route: fsPath,
        });
    }, [pageMap, locale, defaultLocale, route]);
};

const Body: FC<{
    themeContext: PageTheme;
    breadcrumb: ReactNode;
    timestamp?: number;
    navigation: ReactNode;
    children: ReactNode;
    activeType: string;
}> = ({
    themeContext, breadcrumb, timestamp, navigation, children, activeType,
}) => {
    const config = useConfig();

    if (themeContext.layout === "raw") {
        return <div className="w-full overflow-x-hidden">{children}</div>;
    }

    const date = themeContext.timestamp && config.gitTimestamp && timestamp ? new Date(timestamp) : null;

    const gitTimestampElement = date ? (
        <div className="mt-12 mb-8 block text-xs text-gray-500 px-8 ltr:text-right rtl:text-left dark:text-gray-400">
            {renderComponent(config.gitTimestamp, { timestamp: date })}
        </div>
    ) : (
        <div className="mt-16" />
    );

    const content = (
        <>
            {children}
            {activeType === "docs" && <Comments />}
            {gitTimestampElement}
            {navigation}
        </>
    );

    const body = config.main?.({ children: content }) || content;

    if (themeContext.layout === "full") {
        return (
            // eslint-disable-next-line max-len
            <article className="min-h-[calc(100vh-4rem)] w-full overflow-x-hidden pl-[max(env(safe-area-inset-left),2rem)] pr-[max(env(safe-area-inset-right),2rem)]">
                {body}
            </article>
        );
    }

    return (
        <article
            className={cn(
                // eslint-disable-next-line max-len
                "flex min-h-[calc(100vh-4rem)] w-full min-w-0 max-w-full justify-center pr-[calc(env(safe-area-inset-right)-1.5rem)] bg-white dark:bg-darker-800",
                themeContext.typesetting === "article" && "nextra-body-typesetting-article",
            )}
        >
            <main className={cn("w-full min-w-0 pt-4", activeType === "doc" ? "max-w-4xl px-6 md:px-8" : "")}>
                {breadcrumb}
                {body}
            </main>
        </article>
    );
};

const InnerLayout: FC<PropsWithChildren<PageOpts>> = ({
    filePath,
    pageMap,
    frontMatter,
    headings,
    timestamp,
    children,
    // eslint-disable-next-line radar/cognitive-complexity
}) => {
    const config = useConfig();
    const {
        // eslint-disable-next-line max-len
        activeType = "doc",
        activeIndex,
        activeThemeContext,
        activePath,
        topLevelNavbarItems,
        docsDirectories,
        flatDirectories,
        flatDocsDirectories,
        directories,
    } = useDirectoryInfo(pageMap);
    const reference: any = useRef<HTMLDivElement>();
    const isOnScreen = useOnScreen(reference, `-${(reference?.current?.clientHeight || 0) + 50}px`);

    const themeContext = { ...activeThemeContext, ...frontMatter };
    const hideSidebar = !themeContext.sidebar || themeContext.layout === "raw" || ["page", "hidden"].includes(activeType);
    const tocClassName = "nextra-tocSidebar order-last hidden w-64 shrink-0 xl:block";
    const isDocumentPage = activeType === "doc" || themeContext.toc;

    const { locale = DEFAULT_LOCALE, route } = useRouter();

    const tocSidebarElement = isDocumentPage && (
        <nav className={cn(tocClassName, "px-4")} aria-label="table of contents">
            {renderComponent(config.tocSidebar.component, {
                headings: config.tocSidebar.float ? headings : [],
                filePath,
                isOnScreen: !isOnScreen,
                locale,
                route,
            })}
        </nav>
    );
    const tocPageContentElement = isDocumentPage
        && renderComponent(config.tocContent.component, {
            headings: config.tocContent.float ? headings : [],
            wrapperRef: reference,
        });
    const localeConfig = config.i18n.find((l) => l.locale === locale);
    const isRTL = localeConfig ? localeConfig.direction === "rtl" : config.direction === "rtl";
    const direction = isRTL ? "rtl" : "ltr";

    const mdxContent = (
        <MDXProvider
            components={getComponents({
                isRawLayout: themeContext.layout === "raw",
                components: config.components,
            })}
        >
            {children}
        </MDXProvider>
    );

    return (
        <>
            <Toaster />
            {/* This makes sure that selectors like `[dir=ltr] .nextra-container` */}
            {/* work // before hydration as Tailwind expects the `dir` attribute to exist on the `html` element. */}
            <div
                dir={direction}
                // eslint-disable-next-line max-len
                className={
                    ["page", "hidden"].includes(activeType)
                        ? ""
                        : "md:bg-x-gradient-gray-200-gray-200-50-white-50 md:dark:bg-x-gradient-dark-700-dark-700-50-dark-800"
                }
            >
                <script
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                        __html: `document.documentElement.setAttribute('dir','${direction}')`,
                    }}
                />
                <Head />
                <Banner />
                {themeContext.navbar
                    && renderComponent(config.navbar.component, {
                        flatDirectories,
                        items: topLevelNavbarItems,
                        activeType,
                    })}
                <div className={cn("mx-auto flex", themeContext.layout !== "raw" && "max-w-[90rem]")}>
                    <ActiveAnchorProvider>
                        <Sidebar
                            docsDirectories={docsDirectories}
                            flatDirectories={flatDirectories}
                            fullDirectories={directories}
                            headings={headings}
                            asPopover={hideSidebar}
                            includePlaceholder={themeContext.layout === "default"}
                        />
                        <div className="relative w-full">
                            {activeType === "doc" && config.hero?.component && (
                                <div
                                    className={`absolute w-full ${
                                        config.hero?.height
                                            ? (typeof config.hero.height === "string"
                                                ? `h-[${config.hero.height}]`
                                                : `h-[${config.hero.height}px]`)
                                            : ""
                                    }`}
                                >
                                    {renderComponent(config.hero.component, { route })}
                                </div>
                            )}
                            <div
                                className={`flex w-full${
                                    config.hero?.height
                                        ? (typeof config.hero.height === "string"
                                            ? ` mt-[${config.hero.height}]`
                                            : ` mt-[${config.hero.height}px]`)
                                        : ""
                                }`}
                            >
                                {tocSidebarElement}
                                <Body
                                    themeContext={themeContext}
                                    // eslint-disable-next-line max-len
                                    breadcrumb={
                                        !["page", "hidden"].includes(activeType) && themeContext.breadcrumb ? <Breadcrumb activePath={activePath} /> : null
                                    }
                                    timestamp={timestamp}
                                    navigation={
                                        !["page", "hidden"].includes(activeType) && themeContext.pagination ? (
                                            <NavLinks flatDirectories={flatDocsDirectories} currentIndex={activeIndex} />
                                        ) : null
                                    }
                                    activeType={activeType}
                                >
                                    {activeType === "doc" && (
                                        <h1 className="md:text-4xl lg:text-5xl text-3xl leading-tall tracking-tight font-bold hyphenated mt-4">
                                            {(activePath[Object.keys(activePath).length - 1] as Item).title}
                                        </h1>
                                    )}
                                    {tocPageContentElement}
                                    {activeType === "doc" ? <Prose as="article">{mdxContent}</Prose> : mdxContent}
                                </Body>
                            </div>
                        </div>
                    </ActiveAnchorProvider>
                </div>
                {themeContext.footer && <Footer activeType={activeType} />}
            </div>
        </>
    );
};

const Theme: FC = (properties) => {
    const { route } = useRouter();
    // eslint-disable-next-line no-underscore-dangle
    const context = globalThis.__nextra_pageContext__[route];

    if (!context) {
        throw new Error(`No content found for ${route}.`);
    }

    const { pageOpts, Content } = context;

    return (
        <ConfigProvider value={context}>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <InnerLayout {...pageOpts}>
                {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                <Content {...properties} />
            </InnerLayout>
        </ConfigProvider>
    );
};

export default Theme;
