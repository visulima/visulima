import moonIcon from "lucide-static/icons/moon.svg?raw";
import sunIcon from "lucide-static/icons/sun.svg?raw";

import { Icon } from "@/components/icon";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export type View = "overview" | "runs" | "cache";

interface MastheadProps {
    view: View;
    onChange: (view: View) => void;
}

const items: { id: View; label: string; ord: string }[] = [
    { id: "overview", label: "OVERVIEW", ord: "01" },
    { id: "runs", label: "RUNS", ord: "02" },
    { id: "cache", label: "CACHE", ord: "03" },
];

export const Masthead = ({ view, onChange }: MastheadProps) => {
    const { theme, toggle } = useTheme();

    return (
        <header className="nd-masthead relative flex flex-wrap items-end gap-6 px-12 pt-8 pb-5">
            <div className="nd-brand leading-none">
                vis<span className="nd-slash">/</span>dashboard
                <span className="nd-brand-sub mt-3 block text-[11px]">cache &amp; run telemetry</span>
            </div>

            <nav
                aria-label="Primary"
                className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-wrap items-center justify-center gap-2"
            >
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        data-active={view === item.id}
                        onClick={() => onChange(item.id)}
                        className={cn(
                            "nd-navtab pointer-events-auto inline-flex h-7 cursor-pointer items-center rounded-[4px] px-3 text-[11px] uppercase",
                        )}
                    >
                        <span className="nd-navtab-ord">{item.ord}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            <span className="flex-auto" />

            <button
                type="button"
                onClick={toggle}
                aria-label="Toggle color theme"
                title="Toggle color theme"
                className="nd-tbtn nd-tbtn-theme relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[4px]"
            >
                <Icon svg={theme === "dark" ? sunIcon : moonIcon} />
            </button>
        </header>
    );
};
