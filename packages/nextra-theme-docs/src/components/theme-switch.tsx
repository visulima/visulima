import { useTheme } from "next-themes";
import { useMounted } from "nextra/hooks";
import { MoonIcon, SunIcon } from "nextra/icons";
import type { FC, ReactElement } from "react";
import { useCallback, useMemo } from "react";

import { useConfig } from "../contexts";
import { renderString } from "../utils/render";
import type { MenuOption } from "./select";
import Select from "./select";

const ThemeSwitch: FC<{
    className?: string;
    lite?: boolean;
    locale: string;
}> = ({ className = undefined, lite = undefined, locale }): ReactElement => {
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

    const onChange = useCallback(
        (option: MenuOption) => {
            setTheme(option.key as string);
        },
        [setTheme],
    );

    const selected = useMemo(() => {
        return {
            key: theme,
            name: (
                <div className="flex items-center gap-2 capitalize">
                    <IconToUse />
                    <span className={lite ? "lg:hidden" : ""}>{mounted ? theme : "light"}</span>
                </div>
            ),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted, theme]);

    return (
        <Select className={className} onChange={onChange} options={OPTIONS} selected={selected} title={renderString(config.themeSwitch.title, { locale })} />
    );
};

export default ThemeSwitch;
