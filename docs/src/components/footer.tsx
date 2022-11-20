import cn from "clsx";
import React, { ReactElement } from "react";

import { useConfig } from "../contexts";
import { renderComponent } from "../utils";
import LocaleSwitch from "./locale-switch";
import ThemeSwitch from "./theme-switch";

const Footer = ({ menu, activeType }: { menu?: boolean; activeType: string }): ReactElement => {
    const config = useConfig();

    return (
        <footer
            className={cn(
                "pb-[env(safe-area-inset-bottom)] footer-border dark:footer-border",
                activeType === "page" ? "" : "bg-x-gradient-gray-200-gray-200-50-white-50 dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
            )}
        >
            <div className="mx-auto flex max-w-[90rem] bg-white dark:bg-darker-800">
                <div
                    className={cn(
                        "md:w-64 flex flex-col pl-4 py-12",
                        activeType === "page" ? "" : "bg-x-gradient-gray-200-gray-400-75 dark:bg-x-gradient-dark-700-dark-800-65",
                    )}
                >
                    <div className={cn("mx-auto flex gap-2 px-4 mb-9", menu ? "flex" : "hidden")}>
                        {config.i18n.length > 0 && <LocaleSwitch options={config.i18n} />}
                        {config.darkMode && <ThemeSwitch />}
                    </div>

                    {config.footer?.copyright && renderComponent(config.footer.copyright, { activeType })}
                </div>
                <div
                    className={cn(
                        "grow py-12 text-gray-600 dark:text-gray-400",
                        "pl-[max(env(safe-area-inset-left),3.2rem)] pr-[max(env(safe-area-inset-right),3.2rem)]",
                    )}
                >
                    {renderComponent(config.footer.component)}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
