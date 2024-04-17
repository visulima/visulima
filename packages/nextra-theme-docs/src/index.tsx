import "focus-visible";
import "./theme/polyfill";

import cn from "clsx";
import { useRouter } from "next/router";
import { useFSRoute, useMounted } from "nextra/hooks";
import { MDXProvider } from "nextra/mdx";
import type { PageTheme } from "nextra/normalize-pages";
import { normalizePages } from "nextra/normalize-pages";
import type { NextraThemeLayoutProps, PageOpts } from "nextra/types";
import type { FC, MutableRefObject, ReactNode, RefObject } from "react";
import { Fragment, useMemo, useRef } from "react";
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
import getComponents from "./mdx-components";
import { renderComponent } from "./utils/render";
import useOnScreen from "./utils/use-on-screen";

const Body: FC<{
    activeType: string;
    breadcrumb: ReactNode;
    children: ReactNode;
    filePath: string;
    header: ReactNode;
    locale: string;
    navigation: ReactNode;
    route: string;
    themeContext: PageTheme & { type: "api" | "default" };
    timestamp?: number;
}> = ({ activeType, breadcrumb, children, filePath, header, locale, navigation, route, themeContext, timestamp = undefined }) => {
    const config = useConfig();
    const mounted = useMounted();

    if (themeContext.layout === "raw") {
        return <div className={cn("w-full break-words")}>{children}</div>;
    }

    const date = themeContext.timestamp && config.gitTimestamp && timestamp ? new Date(timestamp) : null;

    const gitTimestampElement =
        mounted && date ? (
            <div className="mb-8 mt-12 block text-xs text-gray-500 dark:text-gray-400 ltr:text-right rtl:text-left">
                {renderComponent(config.gitTimestamp, { locale, timestamp: date })}
            </div>
        ) : (
            <div className="mt-16" />
        );

    const isDocumentPage = activeType === "doc" && !["full", "raw"].includes(themeContext.layout) && themeContext.type === "default";

    const content = (
        <>
            {children}
            {activeType === "doc" && <hr className="my-8 lg:hidden" />}
            {activeType === "doc" && (
                <div className="flex flex-col justify-items-end gap-2 text-right lg:!hidden">
                    <MetaInfo config={config} filePath={filePath} locale={locale} route={route} />
                </div>
            )}
            {isDocumentPage && gitTimestampElement}
            {(isDocumentPage || activeType === "api") && config.comments && (
                <div className="mb-8">
                    <hr />
                    <Comments config={config} />
                </div>
            )}
            {isDocumentPage && navigation}
        </>
    );

    const body = config.main?.({ children: content }) ?? content;
    const WrapperElement = isDocumentPage || themeContext.type === "api" ? "article" : Fragment;
    const HeaderWrapperElement = isDocumentPage || themeContext.type === "api" ? "header" : Fragment;

    return (
        <WrapperElement>
            {(breadcrumb || header) && (
                <HeaderWrapperElement>
                    {breadcrumb}
                    {header}
                </HeaderWrapperElement>
            )}
            {body}
        </WrapperElement>
    );
};

const InnerLayout: FC<
    PageOpts & {
        children: ReactNode;
    }
> = ({
    children,
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

    if (["/404", "/500"].includes(route as string)) {
        isErrorPage = true;
        pageType = "page";
    }

    const reference = useRef<HTMLDivElement>(null);
    const isOnScreen = useOnScreen(reference as MutableRefObject<Element>);

    const themeContext = useMemo<PageTheme & { hero: boolean; prose: boolean; type: "api" | "default" }>(() => {
        return {
            hero: true,
            prose: true,
            type: "default",
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
    const isDocumentPage = (pageType === "doc" || !themeContext.toc) && !["full", "raw"].includes(themeContext.layout) && themeContext.type === "default";

    const tocSidebarElement = isDocumentPage && (
        <nav aria-label="table of contents" className={cn("nextra-tocSidebar order-last w-64 shrink-0 px-4 hidden xl:!block print:hidden")}>
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
                <div
                    className={cn("mx-auto flex", {
                        "max-w-[90rem]": themeContext.layout !== "raw",
                    })}
                >
                    <ActiveAnchorProvider>
                        <Sidebar
                            asPopover={hideSidebar}
                            documentsDirectories={documentsDirectories}
                            flatDirectories={flatDirectories}
                            fullDirectories={directories}
                            headings={headings}
                        />
                        <div
                            className={cn("min-w-0 w-full", {
                                "bg-white dark:bg-darker-800": activeType === "doc",
                            })}
                        >
                            {pageType === "doc" && themeContext.type === "default" && themeContext.hero && config.hero?.component && (
                                <div className="w-full lg:min-w-0">{renderComponent(config.hero.component, { route })}</div>
                            )}
                            <div className="flex w-full">
                                {tocSidebarElement}
                                <SkipNavContent />
                                <main
                                    className={cn(
                                        "nextra-content lg:min-w-0 min-h-[calc(100vh-var(--nextra-navbar-height)-var(--nextra-menu-switcher-height))] w-full break-words",
                                        {
                                            "lg:!pb-0": pageType === "doc",
                                            "nextra-body-typesetting-article": themeContext.typesetting === "article",
                                            "pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-6":
                                                themeContext.layout !== "full",
                                        },
                                    )}
                                >
                                    <Body
                                        activeType={pageType}
                                        breadcrumb={
                                            !["hidden", "page"].includes(pageType) && themeContext.breadcrumb ? <Breadcrumb activePath={activePath} /> : null
                                        }
                                        filePath={filePath}
                                        header={
                                            pageType === "doc" &&
                                            !["full", "raw"].includes(themeContext.layout) && (
                                                <>
                                                    {config.content.showTitle !== false && (
                                                        <h1 className="mt-4 inline-block text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-200 sm:text-3xl">
                                                            {activePath[Object.keys(activePath).length - 1]?.title}
                                                        </h1>
                                                    )}
                                                    {config.content.showDescription !== false &&
                                                        activePath[Object.keys(activePath).length - 1]?.description && (
                                                            <p className="mt-2 text-lg">{activePath[Object.keys(activePath).length - 1]?.description}</p>
                                                        )}
                                                </>
                                            )
                                        }
                                        locale={locale}
                                        navigation={
                                            !["hidden", "page"].includes(pageType) && themeContext.pagination ? (
                                                <NavLinks currentIndex={activeIndex} flatDirectories={flatDocumentsDirectories} layout={themeContext.layout} />
                                            ) : null
                                        }
                                        route={route}
                                        themeContext={themeContext}
                                        timestamp={timestamp}
                                    >
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
                                </main>
                            </div>
                        </div>
                    </ActiveAnchorProvider>
                </div>
                <Footer activeType={pageType} locale={locale} themeContext={themeContext} />
            </div>
        </WrapBalancerProvider>
    );
};

const Index: FC<NextraThemeLayoutProps> = ({ children, ...context }) => (
    <ConfigProvider value={context}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <InnerLayout {...context.pageOpts}>{children}</InnerLayout>
    </ConfigProvider>
);

export default Index;
