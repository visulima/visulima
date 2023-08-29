import { useRouter } from "next/router";
import type { Heading } from "nextra";
import { useFSRoute, useMounted } from "nextra/hooks";
import { ArrowRightIcon } from "nextra/icons";
import type { Item, MenuItem, PageItem } from "nextra/normalize-pages";
import type { FC, MouseEvent } from "react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import scrollIntoView from "scroll-into-view-if-needed";

import { DEFAULT_LOCALE } from "../constants/base";
import { useActiveAnchor, useConfig, useMenu } from "../contexts";
import { renderComponent } from "../utils/render";
import Anchor from "./anchor";
import Collapse from "./collapse";
import LocaleSwitch from "./locale-switch";
import ThemeSwitch from "./theme-switch";
import cn from "../utils/cn";
import useWindowSize from "../utils/use-window-size";

const TreeState: Record<string, boolean> = Object.create(null) as Record<string, boolean>;

const FocusedItemContext = createContext<string | null>(null);

const OnFocusItemContext = createContext<((item: string | null) => unknown) | null>(null);

const classes = {
    active: cn("font-semibold text-primary-600", "contrast-more:border-primary-500 contrast-more:dark:border-primary-500"),
    border: cn(
        "relative before:absolute before:inset-y-1",
        'before:w-px before:bg-gray-300 before:content-[""] dark:before:bg-neutral-800',
        "ltr:pl-3 ltr:before:left-0 rtl:pr-3 rtl:before:right-0",
    ),
    inactive: cn(
        "text-gray-500 hover:bg-gray-200 hover:text-gray-700 rounded",
        "dark:text-gray-400 dark:hover:bg-primary-100/5 dark:hover:text-gray-200",
        "contrast-more:text-gray-900 contrast-more:dark:text-gray-50",
        "contrast-more:border-transparent contrast-more:hover:border-gray-900 contrast-more:dark:hover:border-gray-50",
    ),
    link: cn(
        "flex px-2 py-1.5 text-sm transition-colors [word-break:break-word] group",
        "cursor-pointer [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] contrast-more:border",
    ),
    list: "flex flex-col gap-1",
};

const FolderLevelContext = createContext(0);

interface FolderProperties {
    anchors: Heading[];
    item: Item | MenuItem | PageItem;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
const FolderImpl: FC<FolderProperties> = ({ anchors, item }) => {
    const routeOriginal = useFSRoute();
    const [route] = routeOriginal.split("#");
    const active = [`${route}/`, route].includes(`${item.route}/`);
    const activeRouteInside = active || route?.startsWith(`${item.route}/`);

    const focusedRoute = useContext(FocusedItemContext);
    const focusedRouteInside = !!focusedRoute?.startsWith(`${item.route}/`);
    const level = useContext(FolderLevelContext);

    const { setMenu } = useMenu();
    const config = useConfig();
    const { theme } = item as Item;

    const isOpen =
        TreeState[item.route] === undefined
            ? active ||
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              activeRouteInside ||
              focusedRouteInside ||
              (theme && "collapsed" in theme ? !theme.collapsed : level < config.sidebar.defaultMenuCollapseLevel)
            : TreeState[item.route] ?? focusedRouteInside;

    const rerender = useState({})[1];

    useEffect(() => {
        const updateTreeState = () => {
            if (activeRouteInside || focusedRouteInside) {
                TreeState[item.route] = true;
            }
        };
        const updateAndPruneTreeState = () => {
            if (activeRouteInside && focusedRouteInside) {
                TreeState[item.route] = true;
            } else {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete TreeState[item.route];
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        config.sidebar.autoCollapse ? updateAndPruneTreeState() : updateTreeState();
    }, [activeRouteInside, focusedRouteInside, item.route, config.sidebar.autoCollapse]);

    if (item.type === "menu") {
        const menu = item as MenuItem;
        const routes = Object.fromEntries((menu.children ?? []).map((mRoute) => [mRoute.name, mRoute]));

        // eslint-disable-next-line no-param-reassign
        item.children = Object.entries(menu.items).map(([key, value]) => {
            return {
                // eslint-disable-next-line security/detect-object-injection
                ...(routes[key] ?? {
                    name: key,
                    ...("locale" in menu && { locale: menu.locale }),
                    route: `${menu.route}/${key}`,
                }),
                ...value,
            };
        }) as Item[];
    }

    const isLink = "withIndexPage" in item && item.withIndexPage;
    // use button when link don't have href because it impacts on SEO
    const ComponentToUse = isLink ? Anchor : "button";

    const onClick = useCallback(
        (event: MouseEvent) => {
            const clickedToggleIcon = ["path", "svg"].includes((event.target as HTMLElement).tagName.toLowerCase());

            if (clickedToggleIcon) {
                event.preventDefault();
            }

            if (isLink) {
                // If it's focused, we toggle it. Otherwise, always open it.
                if (active || clickedToggleIcon) {
                    TreeState[item.route] = !isOpen;
                } else {
                    TreeState[item.route] = true;
                    setMenu(false);
                }

                rerender({});

                return;
            }

            if (active) {
                return;
            }

            TreeState[item.route] = !isOpen;

            rerender({});
        },
        [active, isLink, isOpen, item.route, rerender, setMenu],
    );

    return (
        <li className={cn(active, isOpen ? "open" : "")}>
            <ComponentToUse
                className={cn("items-center justify-between gap-2 w-full text-left", classes.link, active ? classes.active : classes.inactive)}
                href={isLink ? item.route : undefined}
                onClick={onClick}
            >
                {config.sidebar.icon &&
                    renderComponent(config.sidebar.icon, {
                        className: "w-4 h-4",
                        route: item.route,
                        title: item.title,
                        type: item.type,
                    })}
                {renderComponent(config.sidebar.titleComponent, {
                    route: item.route,
                    title: item.title,
                    type: item.type,
                })}
                <div className="grow" />
                <ArrowRightIcon
                    className="h-[18px] min-w-[18px] rounded-sm p-0.5 hover:bg-gray-800/5 dark:hover:bg-gray-100/5"
                    pathClassName={cn("origin-center transition-transform", isOpen ? "ltr:rotate-90 rtl:rotate-[-270deg]" : "rtl:-rotate-180")}
                />
            </ComponentToUse>
            <Collapse className="ltr:pr-0 rtl:pl-0" isOpen={isOpen}>
                {Array.isArray(item.children) ? (
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    <Menu anchors={anchors} className={cn(classes.border, "ltr:ml-1 rtl:mr-1")} directories={item.children} />
                ) : null}
            </Collapse>
        </li>
    );
};

const Folder = memo((properties: FolderProperties) => {
    const level = useContext(FolderLevelContext);

    return (
        <FolderLevelContext.Provider value={level + 1}>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <FolderImpl {...properties} />
        </FolderLevelContext.Provider>
    );
});

const Separator: FC<{ title: string }> = ({ title }) => {
    const config = useConfig();

    return (
        <li
            className={cn(
                "[word-break:break-word]",
                title ? "mt-5 mb-2 px-2 py-1.5 text-sm font-semibold text-gray-900 first:mt-0 dark:text-gray-100" : "my-4",
            )}
        >
            {title ? (
                renderComponent(config.sidebar.titleComponent, {
                    route: "",
                    title,
                    type: "separator",
                })
            ) : (
                <hr className="mx-2 border-t border-gray-400 dark:border-primary-100/10" />
            )}
        </li>
    );
};

const File: FC<{ anchors: Heading[]; item: Item | PageItem }> = ({ anchors, item }) => {
    const route = useFSRoute();
    const onFocus = useContext(OnFocusItemContext);

    // It is possible that the item doesn't have any route - for example an external link.
    const active = item.route && [`${route}/`, route].includes(`${item.route}/`);

    const activeId = useActiveAnchor();
    const { setMenu } = useMenu();
    const config = useConfig();

    if (item.type === "separator") {
        return <Separator title={item.title} />;
    }

    return (
        <li className={cn(classes.list, { active })}>
            <Anchor
                /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                onBlur={() => {
                    onFocus?.(null);
                }}
                /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                onClick={() => {
                    setMenu(false);
                }}
                /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                onFocus={() => {
                    onFocus?.(item.route);
                }}
                className={cn(classes.link, active ? classes.active : classes.inactive, "items-center")}
                href={(item as PageItem).href ?? item.route}
                newWindow={(item as PageItem).newWindow}
            >
                {config.sidebar.icon &&
                    renderComponent(config.sidebar.icon, {
                        className: "w-4 h-4 mr-2 mt-0.5",
                        route: item.route,
                        title: item.title,
                        type: item.type,
                    })}
                {renderComponent(config.sidebar.titleComponent, {
                    route: item.route,
                    title: item.title,
                    type: item.type,
                })}
            </Anchor>
            {active && anchors.length > 0 && (
                <ul className={cn(classes.list, classes.border, "ltr:ml-3 rtl:mr-3")}>
                    {anchors.map(({ id, value }) => (
                        <li key={id}>
                            <a
                                className={cn(
                                    classes.link,
                                    'flex gap-2 before:opacity-25 before:content-["#"]',

                                    activeId === id ? classes.active : classes.inactive,
                                )}
                                onClick={() => {
                                    setMenu(false);
                                }}
                                href={`#${id}`}
                            >
                                {value}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
};

const Menu: FC<{
    anchors: Heading[];
    className?: string;
    directories: Item[] | PageItem[];
    onlyCurrentDocs?: boolean;
}> = ({ anchors, className = undefined, directories, onlyCurrentDocs: onlyCurrentDocumentation = undefined }) => (
    <ul className={cn(classes.list, className)}>
        {directories.map((item) => {
            if (!onlyCurrentDocumentation || item.isUnderCurrentDocsTree) {
                if (item.type === "menu" || (item.children && (item.children.length > 0 || !item.withIndexPage))) {
                    return <Folder anchors={anchors} item={item} key={item.name} />;
                }

                return <File anchors={anchors} item={item} key={item.name} />;
            }

            return null;
        })}
    </ul>
);

interface SideBarProperties {
    asPopover?: boolean;
    documentsDirectories: PageItem[];
    flatDirectories: Item[];
    fullDirectories: Item[];
    headings?: Heading[];
}

const Sidebar: FC<SideBarProperties> = ({ asPopover = false, documentsDirectories, flatDirectories, fullDirectories, headings = [] }) => {
    const config = useConfig();
    const { menu, setMenu } = useMenu();
    const router = useRouter();
    const anchors = useMemo(() => headings.filter((v) => v.depth === 2), [headings]);
    const [focused, setFocused] = useState<string | null>(null);
    const { width } = useWindowSize();

    const containerReference = useRef<HTMLDivElement>(null);
    const sidebarReference = useRef<HTMLDivElement>(null);

    const mounted = useMounted();

    useEffect(() => {
        if (menu) {
            document.body.classList.add("overflow-hidden", "lg:overflow-auto");
        } else {
            document.body.classList.remove("overflow-hidden", "lg:overflow-auto");
        }
    }, [menu]);

    useEffect(() => {
        const activeElement = containerReference.current?.querySelector("li.active");

        if (activeElement && ((width && width > config.sidebar.mobileBreakpoint) || menu)) {
            const scroll = () => {
                scrollIntoView(activeElement, {
                    block: "center",
                    boundary: containerReference.current,
                    inline: "center",
                    scrollMode: "always",
                });
            };

            if (menu) {
                // needs for mobile since menu has transition transform
                setTimeout(scroll, 300);
            } else {
                scroll();
            }
        }
    }, [config.sidebar.mobileBreakpoint, menu, width]);

    // Always close mobile nav when route was changed (e.g. logo click)
    useEffect(() => {
        setMenu(false);
    }, [router.asPath, setMenu]);

    const hasI18n = config.i18n.length > 1;
    const hasMenu = config.darkMode || hasI18n;

    return (
        <>
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
            <div
                className={cn("motion-reduce:transition-none [transition:background-color_1.5s_ease]", {
                    "bg-transparent": !menu,
                    "fixed inset-0 z-10 bg-black/80 dark:bg-black/60": menu,
                })}
                onClick={() => setMenu(false)}
            />
            <aside
                className={cn(
                    "nextra-sidebar-container flex flex-col",
                    "lg:bg-x-gradient-gray-200-gray-400-75 lg:dark:bg-x-gradient-dark-700-dark-800-65",
                    "lg:top-0 lg:shrink-0 motion-reduce:transform-none",
                    "transform-gpu transition-all ease-in-out lg:w-64",
                    "print:hidden",
                    asPopover ? "lg:!hidden" : "lg:sticky lg:self-start",
                    menu ? "max-lg:[transform:translate3d(0,0,0)]" : "max-lg:[transform:translate3d(0,-100%,0)]",
                )}
                ref={containerReference}
            >
                <div className={cn("px-4 pt-4", config.search.position === "navbar" ? "lg:hidden" : "")}>
                    {renderComponent(config.search.component, {
                        directories: flatDirectories,
                    })}
                </div>
                <FocusedItemContext.Provider value={focused}>
                    <OnFocusItemContext.Provider
                        // eslint-disable-next-line react/jsx-no-constructed-context-values
                        value={(item) => {
                            setFocused(item);
                        }}
                    >
                        <div
                            className={cn("overflow-y-auto overflow-x-hidden nextra-scrollbar", "p-2 pr-4", "lg:h-[calc(100vh-var(--nextra-menu-height))]")}
                            ref={sidebarReference}
                        >
                            <div className="transform-gpu ease-in-out motion-reduce:transition-none">
                                {mounted && width && width > config.sidebar.mobileBreakpoint && (
                                    <Menu
                                        // the sidebar when `floatTOC` is enabled.
                                        anchors={config.tocSidebar.float ? [] : anchors}
                                        className="nextra-menu-desktop max-lg:!hidden"
                                        // When the viewport size is larger than `md`, hide the anchors in
                                        // The sidebar menu, shows only the docs directories.
                                        directories={documentsDirectories}
                                        onlyCurrentDocs
                                    />
                                )}
                                {mounted && width && width < config.sidebar.mobileBreakpoint && (
                                    <Menu
                                        // Always show the anchor links on mobile (`md`).
                                        anchors={anchors}
                                        className="nextra-menu-mobile lg:!hidden"
                                        // The mobile dropdown menu, shows all the directories.
                                        directories={fullDirectories}
                                    />
                                )}
                            </div>
                        </div>
                    </OnFocusItemContext.Provider>
                </FocusedItemContext.Provider>

                {hasMenu && (
                    <div
                        className={cn(
                            "sticky bottom-0 border-t border-gray-200 dark:border-gray-800 py-4",
                            "lg:bg-x-gradient-gray-200-gray-400-75 lg:dark:bg-x-gradient-dark-700-dark-800-65",
                            "relative z-[1]", // for top box shadow
                            "flex items-center gap-2",
                            "px-6 -ml-2", // hide ring on focused sidebar links
                            "h-[var(--nextra-menu-height)]",
                            { "justify-end": hasI18n },
                        )}
                        data-toggle-animation="off"
                    >
                        <LocaleSwitch className="ltr:mr-auto rtl:ml-auto" />
                        {hasI18n && config.darkMode && <div className="grow" />}
                        {config.darkMode && <ThemeSwitch locale={router.locale ?? DEFAULT_LOCALE} />}
                    </div>
                )}
            </aside>
        </>
    );
};

export default Sidebar;
