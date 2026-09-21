/** @jsxImportSource preact */
import type { ComponentChildren, JSX } from "preact";
import { toChildArray } from "preact";

import Badge from "./badge";
import Button from "./button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const TRIGGER_CLASS
    = "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground "
        + "data-[state=active]:shadow-none px-4 py-2 text-xs font-medium shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer";

/**
 * Tab strip whose panes are this element's children, matched positionally to
 * `tabs`. Tab selection stays inside the existing `ui` Tabs primitive, so it
 * needs no view state.
 */
interface Tab {
    /** Count shown beside the label — omit for no badge. */
    badge?: number;
    badgeVariant?: "destructive" | "warning";
    label: string;
    value: string;
}

interface TabViewProps {
    /** Trailing button label — omit for no button. */
    actionLabel?: string;
    children?: ComponentChildren;
    /** Wired by the view's `on.action` binding. */
    onAction?: (event: Event) => void;
    tabs: Tab[];
}

const TabView = ({ actionLabel, children, onAction, tabs }: TabViewProps): JSX.Element => {
    // Paired to `tabs` by position, which holds because the renderer keeps a
    // slot for a child that renders nothing rather than compacting it away.
    const panes = toChildArray(children);

    return (
        <Tabs class="flex flex-col flex-1 min-h-0" defaultValue={tabs[0]?.value}>
            <div class="shrink-0 border-b border-border bg-muted flex items-center gap-2 pr-3">
                <TabsList class="w-full rounded-none h-auto p-0 bg-transparent justify-start gap-0 overflow-x-auto">
                    {tabs.map(({ badge, badgeVariant = "warning", label, value }) => (
                        <TabsTrigger class={TRIGGER_CLASS} key={value} value={value}>
                            {label}
                            {badge !== undefined && (
                                <Badge class="text-[0.58rem] min-w-[1.1rem] text-center ml-1.5" variant={badgeVariant}>
                                    {badge}
                                </Badge>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {actionLabel !== undefined && (
                    <Button class="shrink-0 text-xs" onClick={onAction} size="sm" variant="outline">
                        {actionLabel}
                    </Button>
                )}
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
