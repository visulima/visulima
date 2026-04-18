import { Activity, Database, LayoutDashboard, ListTree } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LiveStatus } from "@/hooks/use-live-events";
import { cn } from "@/lib/utils";

export type View = "overview" | "runs" | "cache";

interface SidebarProps {
    view: View;
    onChange: (view: View) => void;
    workspaceRoot: string | undefined;
    live: LiveStatus;
}

const items: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "runs", label: "Runs", icon: ListTree },
    { id: "cache", label: "Cache", icon: Database },
];

export const Sidebar = ({ view, onChange, workspaceRoot, live }: SidebarProps) => (
    <aside className="flex w-60 flex-col border-r bg-card/40 p-4">
        <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-sm font-bold">
                v
            </div>
            <div>
                <div className="text-sm font-semibold">vis</div>
                <div className="text-xs text-muted-foreground">dashboard</div>
            </div>
        </div>
        <Separator className="my-3" />
        <nav className="flex flex-col gap-1">
            {items.map((item) => {
                const Icon = item.icon;

                return (
                    <Button
                        key={item.id}
                        variant={view === item.id ? "secondary" : "ghost"}
                        size="sm"
                        className="justify-start"
                        onClick={() => onChange(item.id)}
                    >
                        <Icon className="mr-2 h-4 w-4" />
                        {item.label}
                    </Button>
                );
            })}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-2 pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
                <Activity
                    className={cn(
                        "h-3 w-3",
                        live === "open" ? "text-emerald-400" : live === "connecting" ? "text-amber-400" : "text-red-400",
                    )}
                />
                <span>{live === "open" ? "Live" : live === "connecting" ? "Connecting…" : "Offline"}</span>
                {live === "open" ? <Badge variant="success">SSE</Badge> : null}
            </div>
            {workspaceRoot ? (
                <div className="break-all font-mono text-[11px] leading-snug">{workspaceRoot}</div>
            ) : null}
        </div>
    </aside>
);
