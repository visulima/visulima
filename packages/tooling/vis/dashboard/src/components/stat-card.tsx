import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon?: LucideIcon;
    tone?: "default" | "good" | "warn" | "bad";
    className?: string;
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
    default: "text-foreground",
    good: "text-emerald-400",
    warn: "text-amber-400",
    bad: "text-red-400",
};

export const StatCard = ({ label, value, sub, icon: Icon, tone = "default", className }: StatCardProps) => (
    <Card className={cn("gap-2 py-4", className)}>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-0">
            <CardTitle>{label}</CardTitle>
            {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
            <div className={cn("text-2xl font-semibold tabular-nums", toneClass[tone])}>{value}</div>
            {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
        </CardContent>
    </Card>
);
