// Compile-only fixture. Imports the published surface of @visulima/ansi
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { cursorBackward, cursorLeft, cursorUp, eraseLine } from "@visulima/ansi";
import type { CursorStyle, EraseLineMode } from "@visulima/ansi";
import strip from "@visulima/ansi/strip";

const up: string = cursorUp(2);
const left: string = cursorLeft();
const back: string = cursorBackward(3);
const erased: string = eraseLine;
const stripped: string = strip("hi");

declare const style: CursorStyle;
declare const mode: EraseLineMode;

export { back, erased, left, mode, stripped, style, up };
