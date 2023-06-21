import { useTheme } from "next-themes";
import { useMounted } from "nextra/hooks";
import { MoonIcon, SunIcon } from "nextra/icons";
import type { FC, ReactElement } from "react";
import { useMemo } from "react";

import { useConfig } from "../contexts";
import { renderString } from "../utils/render";
import Select from "./select";

const ThemeSwitch: FC<{
    className?: string;
    lite?: boolean;
    locale: string;
}> = ({ className, lite, locale }): ReactElement => {
    const config = useConfig();
    const { resolvedTheme, setTheme, theme = "" } = useTheme();
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
            onChange={(option) => {
                setTheme(option.key);
            }}
            selected={{
                key: theme,
                name: (
                    <div className="flex items-center gap-2 capitalize">
                        <IconToUse />
                        <span className={lite ? "lg:hidden" : ""}>{mounted ? theme : "light"}</span>
                    </div>
                ),
            }}
            className={className}
            options={OPTIONS}
            title={renderString(config.themeSwitch.title, { locale })}
        />
    );
};

export default ThemeSwitch;
