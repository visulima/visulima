import "focus-visible";
import "./theme/polyfill";

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

import Banner from "./components/banner";
import Breadcrumb from "./components/breadcrumb";
import Comments from "./components/comments";
import Footer from "./components/footer";
import Head from "./components/head";
import MetaInfo from "./components/meta-info";
import NavLinks from "./components/nav-links";
import Prose from "./components/prose";
import Sidebar from "./components/sidebar";
import { SkipNavContent } from "./components/skip-nav";
import { DEFAULT_LOCALE } from "./constants/base";
import { ActiveAnchorProvider, ConfigProvider, useConfig } from "./contexts";
import { SlugCounterContext } from "./contexts/active-anchor";
import getComponents from "./mdx-components";
import { renderComponent } from "./utils/render";
import useOnScreen from "./utils/use-on-screen";

const classes = {
    main: "w-full break-words",
    toc: "nextra-tocSidebar order-last w-64 shrink-0 xl:block",
};

const Body: FC<{
    activeType: string;
    breadcrumb: ReactNode;
    children: ReactNode;
    filePath: string;
    locale: string;
    navigation: ReactNode;
    route: string;
    themeContext: PageTheme;
    timestamp?: number;
}> = ({ activeType, breadcrumb, children, filePath, locale, navigation, route, themeContext, timestamp = undefined }) => {
    const config = useConfig();
    const mounted = useMounted();

    if (themeContext.layout === "raw") {
        return <div className={cn("nextra-content", classes.main)}>{children}</div>;
    }

    const date = themeContext.timestamp && config.gitTimestamp && timestamp ? new Date(timestamp) : null;

    const gitTimestampElement =
        mounted && date ? (
            <div className="mb-8 mt-12 block text-xs text-gray-500 ltr:text-right rtl:text-left dark:text-gray-400">
                {renderComponent(config.gitTimestamp, { locale, timestamp: date })}
            </div>
        ) : (
            <div className="mt-16" />
        );

    const isDocumentPage = activeType === "doc" && !["full", "raw"].includes(themeContext.layout);

    const content = (
        <>
            {children}
            {["api", "doc"].includes(activeType) && <hr className="my-8 lg:hidden" />}
            {["api", "doc"].includes(activeType) && (
                <div className="flex flex-col justify-items-end gap-2 text-right lg:!hidden">
                    <MetaInfo config={config} filePath={filePath} locale={locale} route={route} />
                </div>
            )}
            {isDocumentPage && gitTimestampElement}
            {isDocumentPage && config.comments && (
                <div className="mb-8">
                    <hr />
                    <Comments config={config} />
                </div>
            )}
            {isDocumentPage && navigation}
        </>
    );

    const body = config.main?.({ children: content }) ?? content;

    return (
        <article
            className={cn(classes.main, "nextra-content flex min-h-[calc(100vh-var(--nextra-navbar-height))] min-w-0 lg:justify-center overflow-x-hidden", {
                "bg-white dark:bg-darker-800": ["api", "doc"].includes(activeType),
                "nextra-body-typesetting-article": themeContext.typesetting === "article",
                "pr-[calc(env(safe-area-inset-right)-1.5rem)] pb-6 lg:pb-0": themeContext.layout !== "full",
            })}
        >
            <main
                className={cn("w-full min-w-0", {
                    "lg:max-w-4xl pt-4 px-2 md:px-6 lg:px-8": isDocumentPage,
                    "px-4": activeType === "api",
                })}
            >
                {isDocumentPage && breadcrumb}
                {body}
            </main>
        </article>
    );
};

const InnerLayout: FC<PropsWithChildren<PageOpts>> = ({
    children = undefined,
    filePath,
    frontMatter,
    headings,
    pageMap,
    timestamp,
    // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
    const config = useConfig();
    const { defaultLocale, locale = DEFAULT_LOCALE, route } = useRouter();
    const fsPath = useFSRoute();
    const mounted = useMounted();

    const {
        activeIndex,
        activePath,
        activeThemeContext,
        activeType = "doc",
        directories,
        docsDirectories: documentsDirectories,
        flatDirectories,
        flatDocsDirectories: flatDocumentsDirectories,
        topLevelNavbarItems,
    } = useMemo(
        () =>
            normalizePages({
                defaultLocale,
                list: pageMap,
                locale,
                route: fsPath,
            }),
        [pageMap, locale, defaultLocale, fsPath],
    );

    let pageType = activeType;
    let isErrorPage = false;

    if (["/404", "/500"].includes(route)) {
        isErrorPage = true;
        pageType = "page";
    }

    const reference = useRef<HTMLDivElement>(null);
    const isOnScreen = useOnScreen(reference as MutableRefObject<Element>);

    const themeContext = useMemo(() => {
        return {
            prose: true,
            ...activeThemeContext,
            ...frontMatter,
            ...(isErrorPage
                ? {
                      layout: "full" as PageTheme["layout"],
                      timestamp: false,
                      toc: false,
                  }
                : {}),
        };
    }, [activeThemeContext, frontMatter, isErrorPage]);

    const hideSidebar = !themeContext.sidebar || themeContext.layout === "raw" || ["hidden", "page"].includes(pageType);
    const isDocumentPage = (pageType === "doc" || !themeContext.toc) && !["full", "raw"].includes(themeContext.layout);

    const tocSidebarElement = isDocumentPage && (
        <nav aria-label="table of contents" className={cn("nextra-tocSidebar order-last w-64 shrink-0 px-4 hidden lg:!block")}>
            {renderComponent(config.tocSidebar.component, {
                filePath,
                headings: config.tocSidebar.float ? headings : [],
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
                components: config.components,
                isRawLayout: themeContext.layout === "raw",
            })}
        >
            {children}
        </MDXProvider>
    );

    return (
        <WrapBalancerProvider>
            <Toaster
                gutter={config.toaster?.gutter}
                position={config.toaster?.position}
                reverseOrder={config.toaster?.reverseOrder}
                toastOptions={config.toaster?.toastOptions}
            />
            {/* This makes sure that selectors like `[dir=ltr] .nextra-container` */}
            {/* work // before hydration as Tailwind expects the `dir` attribute to exist on the `html` element. */}
            <div
                // eslint-disable-next-line tailwindcss/no-custom-classname
                className={
                    ["hidden", "page"].includes(pageType) || themeContext.layout === "raw"
                        ? ""
                        : "lg:bg-x-gradient-gray-200-gray-200-50-white-50 lg:dark:bg-x-gradient-dark-700-dark-700-50-dark-800"
                }
                dir={direction}
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
                        activeType: pageType,
                        flatDirectories,
                        items: topLevelNavbarItems,
                        themeContext,
                    })}
                <div className={cn("mx-auto flex", themeContext.layout !== "raw" && "max-w-[90rem]")}>
                    <ActiveAnchorProvider>
                        <Sidebar
                            asPopover={hideSidebar}
                            documentsDirectories={documentsDirectories}
                            flatDirectories={flatDirectories}
                            fullDirectories={directories}
                            headings={headings}
                            includePlaceholder={themeContext.layout === "default"}
                        />
                        <div className="relative w-full">
                            {pageType === "doc" && config.hero?.component && (
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
                                    breadcrumb={
                                        !["hidden", "page"].includes(pageType) && themeContext.breadcrumb ? <Breadcrumb activePath={activePath} /> : null
                                    }
                                    navigation={
                                        !["hidden", "page"].includes(pageType) && themeContext.pagination ? (
                                            <NavLinks currentIndex={activeIndex} flatDirectories={flatDocumentsDirectories} layout={themeContext.layout} />
                                        ) : null
                                    }
                                    activeType={pageType}
                                    filePath={filePath}
                                    locale={locale}
                                    route={route}
                                    themeContext={themeContext}
                                    timestamp={timestamp}
                                >
                                    {pageType === "doc" && !["full", "raw"].includes(themeContext.layout) && (
                                        <>
                                            {config.content?.showTitle !== false && (
                                                <h1 className="mt-4 inline-block text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-200 sm:text-3xl">
                                                    {activePath[Object.keys(activePath).length - 1]?.title}
                                                </h1>
                                            )}
                                            {config.content?.showDescription !== false && activePath[Object.keys(activePath).length - 1]?.description && (
                                                <p className="mt-2 text-lg">{activePath[Object.keys(activePath).length - 1]?.description}</p>
                                            )}
                                        </>
                                    )}
                                    {tocPageContentElement}
                                    {themeContext.prose && ["doc", "page"].includes(pageType) ? (
                                        <Prose
                                            className={cn(`layout-${themeContext.layout}`, {
                                                "h-full": themeContext.layout === "full",
                                            })}
                                        >
                                            {mdxContent}
                                        </Prose>
                                    ) : (
                                        mdxContent
                                    )}
                                </Body>
                            </div>
                        </div>
                    </ActiveAnchorProvider>
                </div>
                <Footer activeType={pageType} locale={locale} themeContext={themeContext} />
            </div>
        </WrapBalancerProvider>
    );
};

const Index: FC<NextraThemeLayoutProps> = ({ children = undefined, ...context }) => {
    const counter = useRef(0);

    return (
        <ConfigProvider value={context}>
            <SlugCounterContext.Provider value={counter}>
                {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                <InnerLayout {...context.pageOpts}>{children}</InnerLayout>
            </SlugCounterContext.Provider>
        </ConfigProvider>
    );
};

export default Index;
