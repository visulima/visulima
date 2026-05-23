// Compile-only fixture. Imports the published surface of @visulima/boxen
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { boxen } from "@visulima/boxen";
import type { Alignment, BorderStyle, Options } from "@visulima/boxen";

const opts: Options = {
    borderStyle: "round",
    padding: 1,
};

const rendered: string = boxen("hello", opts);

declare const align: Alignment;
declare const style: BorderStyle;

export { align, opts, rendered, style };
