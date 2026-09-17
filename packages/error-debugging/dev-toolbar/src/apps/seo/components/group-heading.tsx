/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

const TONE_CLASS = {
    destructive: { chip: "bg-destructive/10 border-destructive/25 text-destructive", label: "text-destructive/80" },
    warning: { chip: "bg-warning/10 border-warning/25 text-warning", label: "text-warning/80" },
};

/** Heading for a group of missing tags, carrying the group's count. */
const GroupHeading = ({ count, label, tone }: { count: number; label: string; tone: "destructive" | "warning" }): JSX.Element => (
    <p class={clsx("text-[0.58rem] font-bold uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5", TONE_CLASS[tone].label)}>
        <span>{label}</span>
        <span class={clsx("px-1 font-bold border", TONE_CLASS[tone].chip)}>{count}</span>
    </p>
);

export default GroupHeading;
