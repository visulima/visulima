/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import searchIcon from "lucide-static/icons/search.svg?data-uri&encoding=css";
import type { JSX } from "preact";
import { useState } from "preact/hooks";

import { COLUMN_LABEL, Input, Section } from "../../../ui";
import Icon from "../../../ui/components/icon";
import type { PluginInfo } from "../types";

const ENFORCE_COLORS: Record<string, string> = {
    post: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pre: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const PluginRow = ({ index, plugin }: { index: number; plugin: PluginInfo }): JSX.Element => (
    <div class="flex items-center gap-3 px-4 py-1.5 hover:bg-secondary transition-colors duration-100">
        <span class="text-xxs text-muted-foreground font-mono tabular-nums w-5 shrink-0 text-right select-none opacity-40">{index + 1}</span>
        <span class="text-xs font-mono text-foreground flex-1 truncate">{plugin.name}</span>
        {plugin.enforce ? (
            <span class={clsx("text-xxs font-mono font-bold px-1.5 py-0.5 border uppercase tracking-wide", ENFORCE_COLORS[plugin.enforce])}>
                {plugin.enforce}
            </span>
        ) : (
            <span class="text-xxs font-mono text-muted-foreground px-1.5 py-0.5 bg-secondary border border-border">normal</span>
        )}
    </div>
);

/**
 * Filterable plugin list.
 *
 * Stays a hand-written component rather than spec elements: the filter is a
 * value *computed* from state, and the base spec vocabulary can bind and
 * toggle state but not derive from it.
 */
const PluginList = ({ plugins }: { plugins: PluginInfo[] }): JSX.Element => {
    const [query, setQuery] = useState("");
    // Carry the original position through the filter. `indexOf` would be
    // O(n²) and, worse, returns the first match — so a plugin registered at
    // both `pre` and `post` would render two rows with the same number and
    // collide on the key.
    const numbered = plugins.map((plugin, index) => { return { index, plugin }; });
    const filtered = query ? numbered.filter(({ plugin }) => plugin.name.toLowerCase().includes(query.toLowerCase())) : numbered;

    return (
        <Section>
            <div class="flex items-center gap-2 px-4 py-1.5 bg-secondary border-b border-border">
                <span class={clsx(COLUMN_LABEL, "w-6 shrink-0")}>#</span>
                <div class="flex-1 flex items-center gap-2">
                    <Icon class="text-muted-foreground shrink-0" size={11} src={searchIcon} />
                    <Input
                        class="h-5 text-xs bg-transparent border-0 border-b border-border rounded-none px-0 py-0 focus-visible:ring-0 focus-visible:border-foreground placeholder:text-muted-foreground"
                        onInput={(event) => {
                            setQuery((event.target as HTMLInputElement).value);
                        }}
                        placeholder={`filter ${plugins.length} plugins…`}
                        type="search"
                        value={query}
                    />
                </div>
                <span class={clsx(COLUMN_LABEL, "w-14 text-right")}>Enforce</span>
            </div>

            {filtered.length === 0 ? (
                <div class="px-4 py-6 text-center text-xs text-muted-foreground">No plugins match "{query}"</div>
            ) : (
                filtered.map(({ index, plugin }) => <PluginRow index={index} key={`${index}:${plugin.name}`} plugin={plugin} />)
            )}

            {query && filtered.length > 0 && (
                <div class="px-4 py-1.5 bg-secondary border-t border-border text-right">
                    <span class="text-xxs text-muted-foreground">
                        {filtered.length} of {plugins.length}
                    </span>
                </div>
            )}
        </Section>
    );
};

export default PluginList;
