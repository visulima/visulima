import "focus-visible";
import "./polyfill";

import cn from "clsx";
import { useRouter } from "next/router";
import type { NextraThemeLayoutProps, PageOpts } from "nextra";
import { useFSRoute, useMounted } from "nextra/hooks";
import { MDXProvider } from "nextra/mdx";
import type { PageTheme } from "nextra/normalize-pages";
import { normalizePages } from "nextra/normalize-pages";
import type { FC, MutableRefObject, PropsWithChildren, ReactNode, RefObject } from "react";
import { useMemo, useRef } from "react";
import { Toaster } from "react-hot-toast";
import { Provider as WrapBalancerProvider } from "react-wrap-balancer";

import Banner from "../components/banner";
import Breadcrumb from "../components/breadcrumb";
import Comments from "../components/comments";
import Footer from "../components/footer";
import Head from "../components/head";
import MetaInfo from "../components/meta-info";
import NavLinks from "../components/nav-links";
import Prose from "../components/prose";
import Sidebar from "../components/sidebar";
import { SkipNavContent } from "../components/skip-nav";
import { DEFAULT_LOCALE } from "../constants";
import { ActiveAnchorProvider, ConfigProvider, useConfig } from "../contexts";
import getComponents from "../mdx-components";
import { renderComponent } from "../utils";
import useOnScreen from "../utils/use-on-screen";
import { SlugCounterContext } from "../contexts/active-anchor";

const classes = {
    toc: "nextra-tocSidebar order-last hidden w-64 shrink-0 xl:block",
    main: "w-full break-words",
};

const Body: FC<{
    themeContext: PageTheme;
    breadcrumb: ReactNode;
    timestamp?: number;
    navigation: ReactNode;
    children: ReactNode;
    activeType: string;
    filePath: string;
    locale: string;
    route: string;
}> = ({ themeContext, breadcrumb, timestamp, navigation, children, activeType, filePath, locale, route }) => {
    const config = useConfig();
    const mounted = useMounted();

    if (themeContext.layout === "raw") {
        return <div className={cn("nextra-content", classes.main)}>{children}</div>;
    }

    const date = themeContext.timestamp && config.gitTimestamp && timestamp ? new Date(timestamp) : null;

    const gitTimestampElement =
        mounted && date ? (
            <div className="mb-8 mt-12 block text-xs text-gray-500 ltr:text-right rtl:text-left dark:text-gray-400">
                {renderComponent(config.gitTimestamp, { timestamp: date, locale })}
            </div>
        ) : (
            <div className="mt-16" />
        );

    const content = (
        <>
            {children}
            {activeType === "doc" && <hr className="my-8 lg:hidden" />}
            {activeType === "doc" && (
                <div className="flex flex-col justify-items-end gap-2 text-right lg:hidden">
                    <MetaInfo config={config} filePath={filePath} locale={locale} route={route} />
                </div>
            )}
            {activeType === "doc" && !["raw", "full"].includes(themeContext.layout) && gitTimestampElement}
            {activeType === "doc" && config.comments && (
                <div className="mb-8">
                    <hr />
                    <Comments config={config} />
                </div>
            )}
            {navigation}
        </>
    );

    const body = config.main?.({ children: content }) ?? content;

    if (themeContext.layout === "full") {
        return (
            <article
                className={cn(
                    classes.main,

                    "nextra-content min-h-[calc(100vh-var(--nextra-navbar-height))] pl-[max(env(safe-area-inset-left),2rem)] pr-[max(env(safe-area-inset-right),2rem)] bg-white dark:bg-darker-800",
                )}
            >
                {body}
            </article>
        );
    }

    return (
        <article
            className={cn(
                classes.main,

                "nextra-content flex min-h-[calc(100vh-var(--nextra-navbar-height))] min-w-0 justify-center pb-8 pr-[calc(env(safe-area-inset-right)-1.5rem)] bg-white dark:bg-darker-800 overflow-x-hidden",
                themeContext.typesetting === "article" && "nextra-body-typesetting-article",
            )}
        >
            <main className={cn("w-full min-w-0 pt-4 px-2 md:px-6 lg:px-8", activeType === "doc" ? "max-w-4xl" : "")}>
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
    // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
    const config = useConfig();
    const { locale = DEFAULT_LOCALE, defaultLocale, route } = useRouter();
    const fsPath = useFSRoute();
    const mounted = useMounted();

    const {
        activeType = "doc",
        activeIndex,
        activeThemeContext,
        activePath,
        topLevelNavbarItems,
        docsDirectories: documentsDirectories,
        flatDirectories,
        flatDocsDirectories: flatDocumentsDirectories,
        directories,
    } = useMemo(
        () =>
            normalizePages({
                list: pageMap,
                locale,
                defaultLocale,
                route: fsPath,
            }),
        [pageMap, locale, defaultLocale, fsPath],
    );
    const reference: any = useRef<HTMLDivElement>(null);
    const isOnScreen = useOnScreen(reference as MutableRefObject<Element>);

    const themeContext = { prose: true, ...activeThemeContext, ...frontMatter };
    const hideSidebar = !themeContext.sidebar || themeContext.layout === "raw" || ["page", "hidden"].includes(activeType);
    const isDocumentPage = (activeType === "doc" || themeContext.toc) && !["raw", "full"].includes(themeContext.layout);

    const tocSidebarElement = isDocumentPage && (
        <nav className={cn(classes.toc, "px-4")} aria-label="table of contents">
            {renderComponent(config.tocSidebar.component, {
                headings: config.tocSidebar.float ? headings : [],
                filePath,
                isOnScreen: mounted && !isOnScreen,
                locale,
                route,
            })}
        </nav>
    );
    const tocPageContentElement =
        isDocumentPage &&
        renderComponent(config.tocContent.component, {
            headings: config.tocContent.float ? headings : [],
            wrapperRef: reference as RefObject<HTMLDivElement>,
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
        <WrapBalancerProvider>
            <Toaster />
            {/* This makes sure that selectors like `[dir=ltr] .nextra-container` */}
            {/* work // before hydration as Tailwind expects the `dir` attribute to exist on the `html` element. */}
            <div
                dir={direction}
                // eslint-disable-next-line tailwindcss/no-custom-classname
                className={
                    ["page", "hidden"].includes(activeType) || themeContext.layout === "raw"
                        ? ""
                        : "lg:bg-x-gradient-gray-200-gray-200-50-white-50 lg:dark:bg-x-gradient-dark-700-dark-700-50-dark-800"
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
                {themeContext.navbar &&
                    renderComponent(config.navbar.component, {
                        flatDirectories,
                        items: topLevelNavbarItems,
                        activeType,
                        themeContext,
                    })}
                <div className={cn("mx-auto flex", themeContext.layout !== "raw" && "max-w-[90rem]")}>
                    <ActiveAnchorProvider>
                        <Sidebar
                            documentsDirectories={documentsDirectories}
                            flatDirectories={flatDirectories}
                            fullDirectories={directories}
                            headings={headings}
                            asPopover={hideSidebar}
                            includePlaceholder={themeContext.layout === "default"}
                        />
                        <div className="relative w-full">
                            {activeType === "doc" && config.hero?.component && (
                                <div
                                    // eslint-disable-next-line tailwindcss/no-custom-classname
                                    className={`absolute w-full ${
                                        config.hero.height
                                            ? typeof config.hero.height === "string"
                                                ? `h-[${config.hero.height}]`
                                                : `h-[${config.hero.height}px]`
                                            : ""
                                    }`}
                                >
                                    {renderComponent(config.hero.component, { route })}
                                </div>
                            )}
                            <div
                                className={cn(
                                    "flex w-full",
                                    config.hero?.height
                                        ? typeof config.hero.height === "string"
                                            ? `mt-[${config.hero.height}]`
                                            : `mt-[${config.hero.height}px]`
                                        : null,
                                )}
                            >
                                {tocSidebarElement}
                                <SkipNavContent />
                                <Body
                                    themeContext={themeContext}
                                    breadcrumb={
                                        !["page", "hidden"].includes(activeType) && themeContext.breadcrumb ? <Breadcrumb activePath={activePath} /> : null
                                    }
                                    timestamp={timestamp}
                                    navigation={
                                        !["page", "hidden"].includes(activeType) && themeContext.pagination ? (
                                            <NavLinks flatDirectories={flatDocumentsDirectories} currentIndex={activeIndex} layout={themeContext.layout} />
                                        ) : null
                                    }
                                    activeType={activeType}
                                    route={route}
                                    locale={locale}
                                    filePath={filePath}
                                >
                                    {activeType === "doc" && !["raw", "full"].includes(themeContext.layout) && (
                                        <>
                                            <h1 className="mt-4 text-3xl font-bold leading-loose tracking-tight hyphens-auto lg:text-4xl xl:text-5xl">
                                                {activePath[Object.keys(activePath).length - 1]?.title}
                                            </h1>
                                            <p className="mt-2 text-lg">
                                                {activePath[Object.keys(activePath).length - 1]?.description}
                                            </p>
                                        </>
                                    )}
                                    {tocPageContentElement}
                                    {themeContext.prose && ["page", "doc"].includes(activeType) ? (
                                        <Prose className={themeContext.layout === "full" ? "h-full" : ""}>{mdxContent}</Prose>
                                    ) : (
                                        mdxContent
                                    )}
                                </Body>
                            </div>
                        </div>
                    </ActiveAnchorProvider>
                </div>
                <Footer activeType={activeType} themeContext={themeContext} locale={locale} />
            </div>
        </WrapBalancerProvider>
    );
};

const Theme: FC<NextraThemeLayoutProps> = ({ children, ...context }) => {
    const counter = useRef(0);

    return (
        <ConfigProvider value={context}>
            <SlugCounterContext.Provider value={counter.current}>
                    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                    <InnerLayout {...context.pageOpts}>{children}</InnerLayout>
            </SlugCounterContext.Provider>
        </ConfigProvider>
    );
};

export default Theme;
