/** @jsxImportSource preact */
import type { ComponentChildren, JSX } from "preact";
import { toChildArray } from "preact";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui";

const TRIGGER_CLASS
    = "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground "
        + "data-[state=active]:shadow-none px-4 py-2 text-xs font-medium shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer";

/**
 * Tab strip whose panes are this element's children, matched positionally to
 * `tabs`. Tab selection stays inside the existing `ui` Tabs primitive, so it
 * needs no view state.
 */
const TabView = ({ children, tabs }: { children?: ComponentChildren; tabs: { label: string; value: string }[] }): JSX.Element => {
    const panes = toChildArray(children);

    return (
        <Tabs class="flex flex-col flex-1 min-h-0" defaultValue={tabs[0]?.value}>
            <div class="shrink-0 border-b border-border bg-muted">
                <TabsList class="w-full rounded-none h-auto p-0 bg-transparent justify-start gap-0 overflow-x-auto">
                    {tabs.map(({ label, value }) => (
                        <TabsTrigger class={TRIGGER_CLASS} key={value} value={value}>
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            {tabs.map(({ value }, index) => (
                <TabsContent class="flex-1 overflow-auto mt-0" key={value} value={value}>
                    {panes[index]}
                </TabsContent>
            ))}
        </Tabs>
    );
};

export default TabView;
