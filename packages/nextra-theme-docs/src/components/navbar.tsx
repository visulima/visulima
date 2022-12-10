import { Menu, Transition } from "@headlessui/react";
import cn from "clsx";
import { useRouter } from "next/router";
import { ArrowRightIcon, MenuIcon } from "nextra/icons";
import type { FC, PropsWithChildren, ReactNode } from "react";

import { DEFAULT_LOCALE } from "../constants";
import { useConfig, useMenu } from "../contexts";
import type { Item, MenuItem, PageItem } from "../utils";
import { getFSRoute, renderComponent } from "../utils";
import Anchor from "./anchor";

const classes = {
    link: cn("text-sm contrast-more:text-gray-700 contrast-more:dark:text-gray-100"),
    active: cn("subpixel-antialiased font-medium"),
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
                            const { route } = menu;

                            return (
                                <Menu.Item key={key}>
                                    <Anchor
                                        href={href || routes[key]?.route || `${route}/${key}`}
                                        className={cn(
                                            // eslint-disable-next-line max-len
                                            "relative hidden w-full select-none whitespace-nowrap text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 md:inline-block relative",
                                            "py-1.5 ltr:pl-3 ltr:pr-9 rtl:pr-3 rtl:pl-9",
                                        )}
                                        newWindow={newWindow}
                                    >
                                        {title || key}
                                        <span className="absolute">{title || key}</span>
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

// eslint-disable-next-line radar/cognitive-complexity
const Navbar: FC<NavBarProperties> = ({ flatDirectories, items, activeType }) => {
    const config = useConfig();
    const { locale = DEFAULT_LOCALE, asPath } = useRouter();
    const activeRoute = getFSRoute(asPath, locale);
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

    if (config?.chat?.link) {
        chatLink = (
            <Anchor className="p-2 text-current" href={config.chat.link} newWindow>
                {renderComponent(config.chat.icon)}
            </Anchor>
        );
    } else if (config?.chat?.icon) {
        // if no chat link is provided, but a component exists, render it
        // to allow the client to render their own link
        chatLink = renderComponent(config.chat.icon);
    }

    return (
        <>
            {config.navbar?.linkBack && (
                <div className="md:hidden bg-gray-100 text-center p-4 font-medium">
                    {renderComponent(config.navbar.linkBack, {
                        locale,
                    })}
                </div>
            )}
            <div className="nextra-nav-container sticky top-0 z-20 w-full header-border dark:header-border">
                <div
                    className={cn(
                        "pointer-events-none absolute z-[-1] h-full w-full",
                        // eslint-disable-next-line max-len
                        ["page", "hidden"].includes(activeType)
                            ? ""
                            : "bg-x-gradient-gray-200-gray-200-50-white-50 dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
                    )}
                />
                {/* eslint-disable-next-line max-len */}
                <nav className={cn("mx-auto flex max-w-[90rem] bg-white dark:bg-darker-800", ["page", "hidden"].includes(activeType) ? "px-4" : "pr-4")}>
                    <div
                        className={cn(
                            "grow-0 md:w-64 h-[var(--nextra-navbar-height)] flex items-center",
                            ["page", "hidden"].includes(activeType) ? "" : "bg-x-gradient-gray-200-gray-400-75 dark:bg-x-gradient-dark-700-dark-800-65",
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
                        {items.map((pageOrMenu, index) => {
                            if (pageOrMenu.display === "hidden") {
                                return null;
                            }

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
                            const isInactive = !isActive || page.newWindow;

                            return (
                                <Anchor
                                    href={href}
                                    key={String(String(page.route) + index + page.type)}
                                    className={cn(
                                        classes.link,
                                        "-ml-2 hidden whitespace-nowrap p-2 md:inline-block",
                                        isInactive ? classes.inactive : classes.active,
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
                        {/* eslint-disable-next-line react/jsx-no-useless-fragment */}
                        <>
                            {projectLink}
                            {chatLink}
                        </>
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
                    {config.navbar?.linkBack && (
                        <div className="items-center h-[var(--nextra-navbar-height)] hidden md:flex ml-4">
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

export type NavBarProperties = {
    flatDirectories: Item[];
    items: (PageItem | MenuItem)[];
    activeType: string;
};

export default Navbar;
