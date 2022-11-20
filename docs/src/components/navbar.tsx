import { Menu, Transition } from "@headlessui/react";
import cn from "clsx";
import { useRouter } from "next/router";
import { ArrowRightIcon, MenuIcon } from "nextra/icons";
import type { FC, PropsWithChildren } from "react";
import React from "react";

import { DEFAULT_LOCALE } from "../constants";
import { useConfig, useMenu } from "../contexts";
import { getFSRoute, Item, MenuItem, PageItem, renderComponent } from "../utils";
import Anchor from "./anchor";

const classes = {
    link: cn("text-sm contrast-more:text-gray-700 contrast-more:dark:text-gray-100"),
    active: cn("subpixel-antialiased contrast-more:font-bold"),
    inactive: cn("text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"),
};

const NavbarMenu: FC<PropsWithChildren<{ className?: string; menu: MenuItem }>> = ({ className, menu, children }) => {
    const { items } = menu;
    const routes = Object.fromEntries((menu.children || []).map((route) => [route.name, route]));

    return (
        <div className="relative inline-block">
            <Menu>
                <Menu.Button className={cn(className, "-ml-2 hidden items-center whitespace-nowrap rounded p-2 md:inline-flex", classes.inactive)}>
                    {children}
                </Menu.Button>
                <Transition leave="transition-opacity" leaveFrom="opacity-100" leaveTo="opacity-0">
                    {/* eslint-disable-next-line max-len */}
                    <Menu.Items className="absolute right-0 z-20 mt-1 max-h-64 min-w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg dark:bg-neutral-800">
                        {Object.entries(items || {}).map(([key, item]) => {
                            const { href, newWindow, title } = item;

                            return (
                                <Menu.Item key={key}>
                                    <Anchor
                                        href={href || routes[key]?.route || `${menu.route}/${key}`}
                                        className={cn(
                                            // eslint-disable-next-line max-len
                                            "relative hidden w-full select-none whitespace-nowrap text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 md:inline-block",
                                            "py-1.5 ltr:pl-3 ltr:pr-9 rtl:pr-3 rtl:pl-9",
                                        )}
                                        newWindow={newWindow}
                                    >
                                        {title || key}
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

const Navbar: FC<NavBarProperties> = ({ flatDirectories, items, activeType }) => {
    const config = useConfig();
    const { locale = DEFAULT_LOCALE, asPath } = useRouter();
    const activeRoute = getFSRoute(asPath, locale);
    const { menu, setMenu } = useMenu();

    return (
        <div className="nextra-nav-container sticky top-0 z-20 w-full header-border dark:header-border">
            <div
                className={cn(
                    "nextra-nav-container-blur pointer-events-none absolute z-[-1] h-full w-full",
                    activeType === "page" ? "" : "bg-x-gradient-gray-200-gray-200-50-white-50 dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
                )}
            />
            {/* eslint-disable-next-line max-len */}
            <nav className={cn("mx-auto flex max-w-[90rem] bg-white dark:bg-darker-800", activeType === "page" ? "px-4" : "pr-4")}>
                <div
                    className={cn(
                        "grow-0 md:w-64 h-[var(--nextra-navbar-height)] flex items-center",
                        activeType === "page" ? "" : "bg-x-gradient-gray-200-gray-400-75 dark:bg-x-gradient-dark-700-dark-800-65",
                        activeType === "doc" ? "pl-4" : "",
                    )}
                >
                    {config.logoLink ? (
                        <Anchor
                            href={typeof config.logoLink === "string" ? config.logoLink : "/"}
                            className="flex items-center hover:opacity-75 ltr:mr-auto rtl:ml-auto"
                        >
                            {renderComponent(config.logo)}
                        </Anchor>
                    ) : (
                        <div className="flex items-center ltr:mr-auto rtl:ml-auto">{renderComponent(config.logo)}</div>
                    )}
                </div>
                <div className="grow h-[var(--nextra-navbar-height)] flex items-center justify-center space-x-12">
                    {items.map((pageOrMenu) => {
                        if (pageOrMenu.display === "hidden") return null;

                        if (pageOrMenu.type === "menu") {
                            const pmenu = pageOrMenu as MenuItem;

                            const isActive = pmenu.route === activeRoute || activeRoute.startsWith(`${pmenu.route}/`);

                            return (
                                <NavbarMenu
                                    key={pmenu.title}
                                    className={cn(classes.link, "flex gap-1", isActive ? classes.active : classes.inactive)}
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

                        let href = page.href || page.route || "#";

                        // If it's a directory
                        if (page.children) {
                            href = (page.withIndexPage ? page.route : page.firstChildRoute) || href;
                        }

                        const isActive = page.route === activeRoute || activeRoute.startsWith(`${page.route}/`);

                        return (
                            <Anchor
                                href={href}
                                key={page.route}
                                className={cn(
                                    classes.link,
                                    "-ml-2 hidden whitespace-nowrap p-2 md:inline-block",
                                    !isActive || page.newWindow ? classes.inactive : classes.active,
                                )}
                                newWindow={page.newWindow}
                                aria-current={!page.newWindow && isActive}
                            >
                                {page.title}
                            </Anchor>
                        );
                    })}
                </div>
                <div className="flex items-center h-[var(--nextra-navbar-height)] mr-2">
                    {renderComponent(config.search.component, {
                        directories: flatDirectories,
                        className: "hidden md:inline-block mx-min-w-[200px]",
                    })}
                </div>
                <div className="flex items-center h-[var(--nextra-navbar-height)]">
                    {config.project.link ? (
                        <Anchor className="p-2 text-current" href={config.project.link} newWindow>
                            {renderComponent(config.project.icon)}
                        </Anchor>
                    ) : config.project.icon ? (
                        // if no project link is provided, but a component exists, render it
                        // to allow the client to render their own link
                        renderComponent(config.project.icon)
                    ) : null}

                    {config.chat.link ? (
                        <Anchor className="p-2 text-current" href={config.chat.link} newWindow>
                            {renderComponent(config.chat.icon)}
                        </Anchor>
                    ) : config.chat.icon ? (
                        // if no chat link is provided, but a component exists, render it
                        // to allow the client to render their own link
                        renderComponent(config.chat.icon)
                    ) : null}
                </div>
                <div className="flex items-center h-[var(--nextra-navbar-height)]">
                    <button
                        type="button"
                        aria-label="Menu"
                        className="nextra-hamburger -mr-2 rounded p-2 active:bg-gray-400/20 md:hidden"
                        onClick={() => setMenu(!menu)}
                    >
                        <MenuIcon className={cn({ open: menu })} />
                    </button>
                </div>
            </nav>
        </div>
    );
};

export type NavBarProperties = {
    flatDirectories: Item[];
    items: (PageItem | MenuItem)[];
    activeType: string;
};

export default Navbar;
