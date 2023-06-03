import { useTheme } from "next-themes";
import { useMounted } from "nextra/hooks";
import { MoonIcon, SunIcon } from "nextra/icons";
import type { FC, ReactElement } from "react";
import { useMemo } from "react";

import { useConfig } from "../contexts";
import { renderString } from "../utils";
import Select from "./select";

const ThemeSwitch: FC<{
    lite?: boolean;
    className?: string;
    locale: string;
}> = ({ lite, className, locale }): ReactElement => {
    const config = useConfig();
    const { setTheme, resolvedTheme, theme = "" } = useTheme();
    const mounted = useMounted();

    const IconToUse = mounted && resolvedTheme === "dark" ? MoonIcon : SunIcon;
    const OPTIONS = useMemo(
        () => [
            { key: "light", name: renderString(config.themeSwitch.light, { locale }) },
            { key: "dark", name: renderString(config.themeSwitch.dark, { locale }) },
            { key: "system", name: renderString(config.themeSwitch.system, { locale }) },
        ],
        [config.themeSwitch, locale],
    );

    return (
        <Select
            title={renderString(config.themeSwitch.title, { locale })}
            options={OPTIONS}
            onChange={(option) => {
                setTheme(option.key);
            }}
            className={className}
            selected={{
                key: theme,
                name: (
                    <div className="flex items-center gap-2 capitalize">
                        <IconToUse />
                        <span className={lite ? "lg:hidden" : ""}>{mounted ? theme : "light"}</span>
                    </div>
                ),
            }}
        />
    );
};

export default ThemeSwitch;
