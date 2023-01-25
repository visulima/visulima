import cn from "clsx";
import Slugger from "github-slugger";
import { useRouter } from "next/router";
import type { Heading } from "nextra";
import { ArrowRightIcon } from "nextra/icons";
import type { FC } from "react";
import {
    createContext, memo, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import scrollIntoView from "scroll-into-view-if-needed";

import { DEFAULT_LOCALE } from "../constants";
import { useActiveAnchor, useConfig, useMenu } from "../contexts";
import type { Item, MenuItem, PageItem } from "../utils";
import { getFSRoute, getHeadingText, renderComponent } from "../utils";
import Anchor from "./anchor";
import Collapse from "./collapse";
import LocaleSwitch from "./locale-switch";
import ThemeSwitch from "./theme-switch";

const TreeState: Record<string, boolean> = Object.create(null);

const FocusedItemContext = createContext<string | null>(null);
// eslint-disable-next-line no-spaced-func
const OnFocuseItemContext = createContext<((item: string | null) => any) | null>(null);

const classes = {
    link: cn(
        "flex px-2 py-1.5 text-sm transition-colors [word-break:break-word]",
        "cursor-pointer [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] contrast-more:border",
    ),
    inactive: cn(
        "text-gray-500 hover:bg-gray-200 hover:text-gray-700",
        "dark:text-gray-400 dark:hover:bg-primary-100/5 dark:hover:text-gray-200",
        "contrast-more:text-gray-900 contrast-more:dark:text-gray-50",
        "contrast-more:border-transparent contrast-more:hover:border-gray-900 contrast-more:dark:hover:border-gray-50",
    ),
    active: cn("font-semibold text-primary-600", "contrast-more:border-primary-500 contrast-more:dark:border-primary-500"),
    list: cn("flex-col gap-1"),
    border: cn(
        "relative before:absolute before:inset-y-1.5",
        'before:w-px before:bg-gray-300 before:content-[""] dark:before:bg-neutral-800',
        "ltr:pl-3 ltr:before:left-0 rtl:pr-3 rtl:before:right-0",
    ),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any,radar/cognitive-complexity
const FolderImpl: FC<{ item: Item | MenuItem | PageItem; anchors: string[] }> = ({ item, anchors }) => {
    const { asPath, locale = DEFAULT_LOCALE } = useRouter();
    const routeOriginal = getFSRoute(asPath, locale);
    const [route] = routeOriginal.split("#");
    const active = [route, `${route}/`].includes(`${item.route}/`);
    const activeRouteInside = active || (route as string).startsWith(`${item.route}/`);

    const focusedRoute = useContext(FocusedItemContext);
    const focusedRouteInside = !!focusedRoute?.startsWith(`${item.route}/`);

    // TODO: This is not always correct. Might be related to docs root.
    const folderLevel = (item.route.match(/\//g) || []).length;

    const { setMenu } = useMenu();
    const config = useConfig();
    const { theme } = item as Item;
    // eslint-disable-next-line unicorn/no-negated-condition
    const open = TreeState[item.route] === undefined
        ? active
              || activeRouteInside
              || focusedRouteInside
              || (theme && "collapsed" in theme ? !theme.collapsed : folderLevel <= config.sidebar.defaultMenuCollapseLevel)
        : TreeState[item.route] || focusedRouteInside;

    const rerender = useState({})[1];

    useEffect(() => {
        if (activeRouteInside || focusedRouteInside) {
            TreeState[item.route] = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeRouteInside || focusedRouteInside, item.route]);

    if (item.type === "menu") {
        const menu = item as MenuItem;
        const routes = Object.fromEntries((menu.children || []).map((mRoute) => [mRoute.name, mRoute]));

        // eslint-disable-next-line no-param-reassign
        item.children = Object.entries(menu.items || {}).map(([key, value]) => {
            return {
                ...(routes[key] || {
                    name: key,
                    locale: menu.locale,
                    route: `${menu.route}/${key}`,
                    type: "menu",
                    kind: "MdxPage",
                }),
                ...value,
            };
        });
    }

    return (
        <li className={cn({ open, active })}>
            <Anchor
                href={(item as Item).withIndexPage ? item.route : ""}
                className={cn("items-center justify-between gap-2", classes.link, active ? classes.active : classes.inactive)}
                onClick={(event) => {
                    const clickedToggleIcon = ["svg", "path"].includes((event.target as HTMLElement).tagName.toLowerCase());

                    if (clickedToggleIcon) {
                        event.preventDefault();
                    }

                    if ((item as Item).withIndexPage) {
                        // If it's focused, we toggle it. Otherwise, always open it.
                        if (active || clickedToggleIcon) {
                            TreeState[item.route] = !open;
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

                    TreeState[item.route] = !open;
                    rerender({});
                }}
            >
                {renderComponent(config.sidebar.titleComponent, {
                    title: item.title,
                    type: item.type,
                })}
                <ArrowRightIcon
                    className="h-[18px] min-w-[18px] rounded-sm p-0.5 hover:bg-gray-800/5 dark:hover:bg-gray-100/5"
                    pathClassName={cn("origin-center transition-transform rtl:-rotate-180", open && "ltr:rotate-90 rtl:rotate-[-270deg]")}
                />
            </Anchor>
            <Collapse className="ltr:pr-0 rtl:pl-0" open={open}>
                {Array.isArray(item.children) ? (
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    <Menu className={cn(classes.border, "ltr:ml-1 rtl:mr-1")} directories={item.children} anchors={anchors} />
                ) : null}
            </Collapse>
        </li>
    );
};

const Folder = memo(FolderImpl);

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
                    title,
                    type: "separator",
                })
            ) : (
                <hr className="mx-2 border-t border-gray-400 dark:border-primary-100/10" />
            )}
        </li>
    );
};

const File: FC<{ item: Item | PageItem; anchors: string[] }> = ({ item, anchors }) => {
    const { asPath, locale = DEFAULT_LOCALE } = useRouter();
    const route = getFSRoute(asPath, locale);
    const onFocus = useContext(OnFocuseItemContext);

    // It is possible that the item doesn't have any route - for example an external link.
    const active = item.route && [route, `${route}/`].includes(`${item.route}/`);

    const slugger = new Slugger();
    const activeAnchor = useActiveAnchor();
    const { setMenu } = useMenu();
    const config = useConfig();

    if (item.type === "separator") {
        return <Separator title={item.title} />;
    }

    return (
        <li className={cn(classes.list, { active })}>
            <Anchor
                href={(item as PageItem).href || item.route}
                newWindow={(item as PageItem).newWindow}
                className={cn(classes.link, active ? classes.active : classes.inactive)}
                onClick={() => {
                    setMenu(false);
                }}
                onFocus={() => {
                    onFocus?.(item.route);
                }}
                onBlur={() => {
                    onFocus?.(null);
                }}
            >
                {renderComponent(config.sidebar.titleComponent, {
                    title: item.title,
                    type: item.type,
                })}
            </Anchor>
            {active && anchors.length > 0 && (
                <ul className={cn(classes.list, classes.border, "ltr:ml-3 rtl:mr-3")}>
                    {anchors.map((text) => {
                        const slug = slugger.slug(text);
                        return (
                            <li key={slug}>
                                <a
                                    href={`#${slug}`}
                                    className={cn(
                                        classes.link,
                                        'flex gap-2 before:opacity-25 before:content-["#"]',
                                        activeAnchor[slug]?.isActive ? classes.active : classes.inactive,
                                    )}
                                    onClick={() => {
                                        setMenu(false);
                                    }}
                                >
                                    {text}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
};

interface MenuProperties {
    directories: Item[] | PageItem[];
    anchors: string[];
    className?: string;
    onlyCurrentDocs?: boolean;
}

const Menu: FC<MenuProperties> = ({
    directories, anchors, className, onlyCurrentDocs,
}) => (
    <ul className={cn(classes.list, className)}>
        {directories.map((item) => (!onlyCurrentDocs || item.isUnderCurrentDocsTree ? (
            item.type === "menu" || (item.children && (item.children.length > 0 || !item.withIndexPage)) ? (
                    <Folder key={item.name} item={item} anchors={anchors} />
            ) : (
                    <File key={item.name} item={item} anchors={anchors} />
            )
        ) : null))}
    </ul>
);

interface SideBarProperties {
    docsDirectories: PageItem[];
    flatDirectories: Item[];
    fullDirectories: Item[];
    asPopover?: boolean;
    headings?: Heading[];
    includePlaceholder: boolean;
}

const emptyHeading: any[] = [];

const Sidebar: FC<SideBarProperties> = ({
    docsDirectories,
    flatDirectories,
    fullDirectories,
    asPopover = false,
    headings = emptyHeading,
    includePlaceholder,
    // eslint-disable-next-line radar/cognitive-complexity
}) => {
    const config = useConfig();
    const { menu, setMenu } = useMenu();
    const [focused, setFocused] = useState<string | null>(null);
    const anchors = useMemo(
        () => headings
            .filter((v) => v.children && v.depth === 2 && v.type === "heading")
            .map((heading) => getHeadingText(heading))
            .filter(Boolean),
        [headings],
    );
    const sidebarReference = useRef<HTMLDivElement>(null);
    const containerReference = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (menu) {
            document.body.classList.add("overflow-hidden", "md:overflow-auto");
        } else {
            document.body.classList.remove("overflow-hidden", "md:overflow-auto");
        }
    }, [menu]);

    useEffect(() => {
        const activeElement = sidebarReference.current?.querySelector("li.active");

        if (activeElement && (window.innerWidth > 767 || menu)) {
            const scroll = () => {
                scrollIntoView(activeElement, {
                    block: "center",
                    inline: "center",
                    scrollMode: "always",
                    boundary: containerReference.current,
                });
            };
            if (menu) {
                // needs for mobile since menu has transition transform
                setTimeout(scroll, 300);
            } else {
                scroll();
            }
        }
    }, [menu]);

    const hasMenu = config.i18n.length > 0 || config.darkMode;

    return (
        <>
            {includePlaceholder && asPopover ? <div className="hidden h-0 w-64 shrink-0 xl:block" /> : null}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
                className={cn(
                    "motion-reduce:transition-none [transition:background-color_1.5s_ease]",
                    menu ? "fixed inset-0 z-10 bg-black/80 dark:bg-black/60" : "bg-transparent",
                )}
                onClick={() => setMenu(false)}
            />
            <aside
                className={cn(
                    "nextra-sidebar-container flex flex-col",
                    "md:bg-x-gradient-gray-200-gray-400-75 md:dark:bg-x-gradient-dark-700-dark-800-65",
                    "md:top-16 md:w-64 md:shrink-0 md:transform-none",
                    asPopover ? "md:hidden" : "md:sticky md:self-start",
                    menu ? "[transform:translate3d(0,0,0)]" : "[transform:translate3d(0,-100%,0)]",
                )}
                ref={containerReference}
            >
                <div
                    className={cn(
                        "z-[1]", // for bottom box shadow
                        "p-4 md:hidden",
                        "shadow-[0_2px_14px_6px_#fff] dark:shadow-[0_2px_14px_6px_#111]",
                        "contrast-more:shadow-none dark:contrast-more:shadow-none",
                    )}
                >
                    {renderComponent(config.search.component, {
                        directories: flatDirectories,
                    })}
                </div>
                <FocusedItemContext.Provider value={focused}>
                    <OnFocuseItemContext.Provider
                        // eslint-disable-next-line react/jsx-no-constructed-context-values
                        value={(item) => {
                            setFocused(item);
                        }}
                    >
                        <div
                            className={cn("nextra-scrollbar overflow-y-auto px-4 pb-4 md:pt-4", "grow md:h-[calc(100vh-var(--nextra-navbar-height)-3.75rem)]")}
                            ref={sidebarReference}
                        >
                            <Menu
                                className="hidden md:flex"
                                // The sidebar menu, shows only the docs directories.
                                directories={docsDirectories}
                                // When the viewport size is larger than `md`, hide the anchors in
                                // the sidebar when `floatTOC` is enabled.
                                anchors={config.tocSidebar.float ? [] : anchors}
                                onlyCurrentDocs
                            />
                            <Menu
                                className="flex md:hidden"
                                // The mobile dropdown menu, shows all the directories.
                                directories={fullDirectories}
                                // Always show the anchor links on mobile (`md`).
                                anchors={anchors}
                            />
                        </div>
                    </OnFocuseItemContext.Provider>
                </FocusedItemContext.Provider>

                {hasMenu && (
                    <div
                        className={cn(
                            "relative z-[1]", // for top box shadow
                            "mx-4 py-4",
                            "flex items-center gap-2",
                        )}
                    >
                        {config.i18n.length > 0 && <LocaleSwitch options={config.i18n} className="grow" />}
                        {config.darkMode && <ThemeSwitch lite={config.i18n.length > 0} />}
                    </div>
                )}
            </aside>
        </>
    );
};

export default Sidebar;
