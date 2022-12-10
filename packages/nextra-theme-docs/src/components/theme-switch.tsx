import { useTheme } from "next-themes";
import { useMounted } from "nextra/hooks";
import { MoonIcon, SunIcon } from "nextra/icons";
import type { ReactElement } from "react";

import Select from "./select";

type ThemeSwitchProperties = {
    lite?: boolean;
};

const OPTIONS = [
    { key: "light", name: "Light" },
    { key: "dark", name: "Dark" },
    { key: "system", name: "System" },
];

const ThemeSwitch = ({ lite }: ThemeSwitchProperties): ReactElement => {
    const { setTheme, resolvedTheme, theme = "" } = useTheme();
    const mounted = useMounted();
    const IconToUse = mounted && resolvedTheme === "dark" ? MoonIcon : SunIcon;
    return (
        <div className="relative">
            <Select
                title="Change theme"
                options={OPTIONS}
                onChange={(option) => {
                    setTheme(option.key);
                }}
                selected={{
                    key: theme,
                    name: (
                        <div className="flex items-center gap-2 capitalize">
                            <IconToUse />
                            <span className={lite ? "md:hidden" : ""}>{mounted ? theme : "light"}</span>
                        </div>
                    ),
                }}
            />
        </div>
    );
};

export default ThemeSwitch;
