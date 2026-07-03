import type { Writable } from "node:stream";

import { createDecMode, resetMode, setMode } from "@visulima/ansi";
import isInCi from "is-in-ci";

// DEC Private Mode 2026 — Synchronized Output Mode.
// `bsu` (Begin Sync Update) and `esu` (End Sync Update) bracket a batch of
// writes so VT-compliant terminals paint them atomically instead of tearing.
// `setMode`/`resetMode` emit `CSI ?2026h` / `CSI ?2026l`.
const SynchronizedOutputMode = createDecMode(2026);

export const bsu: string = setMode(SynchronizedOutputMode);
export const esu: string = resetMode(SynchronizedOutputMode);

export function shouldSynchronize(stream: Writable, interactive?: boolean): boolean {
    return "isTTY" in stream && (stream as Writable & { isTTY: boolean }).isTTY && (interactive ?? !isInCi);
}
