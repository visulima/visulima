import { Menu, Transition } from "@headlessui/react";
import cn from "clsx";
import { useRouter } from "next/router";
import { useFSRoute } from "nextra/hooks";
import { ArrowRightIcon, MenuIcon } from "nextra/icons";
import type { Item, MenuItem, PageItem, PageTheme } from "nextra/normalize-pages";
import type { FC, PropsWithChildren, ReactNode } from "react";

import { DEFAULT_LOCALE } from "../constants";
import { useConfig, useMenu } from "../contexts";
import { renderComponent } from "../utils";
import Anchor from "./anchor";

const classes = {
    active: cn("subpixel-antialiased font-medium"),
    inactive: cn("text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"),
    link: cn("text-sm contrast-more:text-gray-700 contrast-more:dark:text-gray-100"),
};

const NavbarMenu: FC<PropsWithChildren<{ className?: string; menu: MenuItem }>> = ({ children, className, menu }) => {
    const { items } = menu;
    const routes = Object.fromEntries((menu.children ?? []).map((route) => [route.name, route]));

    return (
        <div className="relative inline-block">
            <Menu>
                <Menu.Button className={cn(className, "-ml-2 hidden items-center whitespace-nowrap rounded p-2 lg:inline-flex", classes.inactive)}>
                    {children}
                </Menu.Button>
                <Transition leave="transition-opacity" leaveFrom="opacity-100" leaveTo="opacity-0">
                    {}
                    <Menu.Items className="absolute right-0 z-20 mt-1 max-h-64 min-w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 dark:bg-neutral-800 dark:ring-white/20">
                        {Object.entries(items).map(([key, item]) => {
                            const { href, newWindow, title } = item;
                            const { route } = menu;

                            return (
                                <Menu.Item key={key}>
                                    <Anchor
                                        className={cn(
                                            "relative hidden w-full select-none whitespace-nowrap text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 md:inline-block relative",
                                            "py-1.5 ltr:pl-3 ltr:pr-9 rtl:pr-3 rtl:pl-9",
                                        )}
                                        href={href ?? routes[key]?.route ?? `${route}/${key}`}
                                        newWindow={newWindow ?? false}
                                    >
                                        {}
                                        <span className="absolute">{title || key}</span>
                                        {}
                                        <span className="invisible font-medium">{title || key}</span>
                                    </Anchor>
                                </Menu.Item>
                            );
                        })}
                    </Menu.Items>
                </Transition>
            </Menu>
        </div>
    );
};

const Navbar: FC<NavBarProperties> = ({ activeType, flatDirectories, items, themeContext }) => {
    const config = useConfig();
    const { locale = DEFAULT_LOCALE } = useRouter();
    const activeRoute = useFSRoute();
    const { menu, setMenu } = useMenu();

    let projectLink: FC | ReactNode | null = null;

    if (config.project.link) {
        projectLink = (
            <Anchor className="p-2 text-current" href={config.project.link} newWindow>
                {renderComponent(config.project.icon)}
            </Anchor>
        );
    } else if (config.project.icon) {
        // if no project link is provided, but a component exists, render it
        // to allow the client to render their own link
        projectLink = renderComponent(config.project.icon);
    }

    let chatLink: FC | ReactNode | null = null;

    if (config.chat?.link) {
        chatLink = (
            <Anchor className="p-2 text-current" href={config.chat.link} newWindow>
                {renderComponent(config.chat.icon)}
            </Anchor>
        );
    } else if (config.chat?.icon) {
        // if no chat link is provided, but a component exists, render it
        // to allow the client to render their own link
        chatLink = renderComponent(config.chat.icon);
    }

    const isLayoutRaw = themeContext.layout === "raw";

    return (
        <>
            {config.navbar.linkBack && (
                <div className="bg-gray-100 p-4 text-center font-medium lg:hidden">
                    {renderComponent(config.navbar.linkBack, {
                        locale,
                    })}
                </div>
            )}
            <div className="nextra-nav-container header-border dark:header-border sticky top-0 z-20 w-full bg-white dark:bg-dark/50">
                <div
                    className={cn(
                        "pointer-events-none absolute z-[-1] h-full w-full",

                        ["hidden", "page"].includes(activeType) || isLayoutRaw
                            ? ""
                            : "bg-x-gradient-gray-200-gray-200-50-white-50 dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
                    )}
                />
                {}
                <nav
                    className={cn(
                        "mx-auto flex max-w-[90rem] bg-white dark:bg-darker-800",
                        ["hidden", "page"].includes(activeType) || isLayoutRaw ? "px-2 md:px-6 lg:px-8" : "pr-6 xl:pr-0",
                    )}
                >
                    <div
                        className={cn(
                            "grow lg:grow-0 w-2/4 lg:w-64 h-[var(--nextra-navbar-height)] flex items-center",

                            ["hidden", "page"].includes(activeType) || isLayoutRaw
                                ? ""
                                : "lg:bg-x-gradient-gray-200-gray-400-75 lg:dark:bg-x-gradient-dark-700-dark-800-65 pl-6 xl:pl-8",
                        )}
                    >
                        {config.logoLink ? (
                            <Anchor
                                className="flex items-center hover:opacity-75 ltr:mr-auto rtl:ml-auto"
                                href={typeof config.logoLink === "string" ? config.logoLink : "/"}
                            >
                                {renderComponent(config.logo)}
                            </Anchor>
                        ) : (
                            <div className="flex items-center ltr:mr-auto rtl:ml-auto">{renderComponent(config.logo)}</div>
                        )}
                    </div>
                    {}
                    <div className="hidden h-[var(--nextra-navbar-height)] grow items-center justify-end gap-2 pl-[max(env(safe-area-inset-left),1.5rem)] pr-[max(env(safe-area-inset-right),1.5rem)] lg:flex">
                        {items.map((pageOrMenu, index) => {
                            if (pageOrMenu.display === "hidden") {
                                return null;
                            }

                            if (pageOrMenu.type === "menu") {
                                const pmenu = pageOrMenu as MenuItem;

                                const isActive = pmenu.route === activeRoute || activeRoute.startsWith(`${pmenu.route}/`);

                                return (
                                    <NavbarMenu
                                        className={cn(classes.link, "flex gap-1", isActive ? classes.active : classes.inactive)}
                                        key={pmenu.title}
                                        menu={pmenu}
                                    >
                                        {pmenu.title}
                                        <ArrowRightIcon
                                            className="h-[18px] min-w-[18px] rounded-sm p-0.5"
                                            pathClassName="origin-center transition-transform rotate-90"
                                        />
                                    </NavbarMenu>
                                );
                            }

                            const page = pageOrMenu as PageItem;

                            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                            let href = page.href || page.route || "#";

                            // If it's a directory
                            if (page.children) {
                                href = (page.withIndexPage ? page.route : page.firstChildRoute) ?? href;
                            }

                            const route = page.href ?? page.route;
                            const isActive = route === activeRoute || activeRoute.startsWith(`${route}/`);
                            const isInactive = !isActive || page.newWindow;

                            return (
                                <Anchor
                                    className={cn(
                                        classes.link,
                                        "relative -ml-2 hidden whitespace-nowrap p-2 lg:inline-block",
                                        isInactive ? classes.inactive : classes.active,
                                    )}
                                    aria-current={!page.newWindow && isActive}
                                    href={href}
                                    key={String(String(page.route) + index + page.type)}
                                    newWindow={page.newWindow ?? false}
                                >
                                    <span className="absolute inset-x-0 text-center">{page.title}</span>
                                    <span className="invisible font-medium">{page.title}</span>
                                </Anchor>
                            );
                        })}
                    </div>
                    {config.search.position === "navbar" && (
                        <div className="mr-2 flex h-[var(--nextra-navbar-height)] items-center">
                            {renderComponent(config.search.component, {
                                className: "hidden lg:inline-block mx-min-w-[200px]",
                                directories: flatDirectories,
                            })}
                        </div>
                    )}
                    <div className="flex h-[var(--nextra-navbar-height)] items-center">
                        {/* eslint-disable-next-line react/jsx-no-useless-fragment */}
                        <>
                            {projectLink}
                            {chatLink}
                        </>
                    </div>
                    <div className="flex h-[var(--nextra-navbar-height)] items-center">
                        <button
                            aria-label="Menu"
                            className="nextra-hamburger -mr-2 rounded p-2 active:bg-gray-400/20 lg:hidden"
                            onClick={() => setMenu(!menu)}
                            type="button"
                        >
                            <MenuIcon className={cn({ open: menu })} />
                        </button>
                    </div>
                    {config.navbar.linkBack && (
                        <div className="ml-4 hidden h-[var(--nextra-navbar-height)] items-center lg:flex">
                            {renderComponent(config.navbar.linkBack, {
                                locale,
                            })}
                        </div>
                    )}
                </nav>
            </div>
        </>
    );
};

export interface NavBarProperties {
    activeType: string;
    flatDirectories: Item[];
    items: (MenuItem | PageItem)[];
    themeContext: PageTheme;
}

export default Navbar;
