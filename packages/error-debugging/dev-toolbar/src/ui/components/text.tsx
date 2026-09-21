/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

const TONE_CLASS = {
    body: "text-[0.7rem] text-muted-foreground leading-relaxed",
    caption: "text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground",
};

/** A paragraph of explanatory copy. */
const Text = ({ text, tone = "body" }: { text: string; tone?: "body" | "caption" }): JSX.Element => <p class={clsx(TONE_CLASS[tone], "mb-3")}>{text}</p>;

export default Text;
