import cn from "clsx";
import React, { ReactElement } from "react";

import { useConfig } from "../contexts";
import { renderComponent } from "../utils";
import LocaleSwitch from "./locale-switch";
import ThemeSwitch from "./theme-switch";

const Footer = ({ activeType }: { activeType: string }): ReactElement => {
    const config = useConfig();

    return (
        <footer
            className={cn(
                "pb-[env(safe-area-inset-bottom)] footer-border dark:footer-border",
                "px-8",
                activeType === "doc" && "md:bg-x-gradient-gray-200-gray-200-50-white-50 md:dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
            )}
        >
            <div className="mx-auto flex flex-col md:flex-row md:max-w-[90rem] bg-white dark:bg-darker-800">
                <div
                    className={cn(
                        "flex md:flex-col py-6 md:py-12 md:w-64 md:shrink-0",
                        ["page", "hidden"].includes(activeType) ? "" : "md:bg-x-gradient-gray-200-gray-400-75 md:dark:bg-x-gradient-dark-700-dark-800-65",
                    )}
                >
                    <div className={cn("mx-auto md:mx-0 flex", activeType === "doc" ? "md:hidden" : "mb-3")}>
                        {config.i18n.length > 0 && <LocaleSwitch options={config.i18n} />}
                        {config.darkMode && <ThemeSwitch />}
                    </div>

                    <div className="hidden md:block">{config.footer?.copyright && renderComponent(config.footer.copyright, { activeType })}</div>
                </div>
                <div
                    className={cn(
                        "md:grow md:py-12 text-gray-600 dark:text-gray-400",
                        "md:pl-[max(env(safe-area-inset-left),3.2rem)] md:pr-[max(env(safe-area-inset-right),3.2rem)]",
                    )}
                >
                    {renderComponent(config.footer.component)}
                </div>
                <div className="block mt-8 md:hidden md:mb-0 footer-border dark:footer-border py-8 md:py-0 w-full">
                    {config.footer?.copyright && renderComponent(config.footer.copyright, { activeType })}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
