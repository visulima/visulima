import { expect, it } from "vitest";
import parseKeypress from "../../src/ink/parse-keypress.js";

// VT220-style modifier sequences (ESC [ 1 ; <mod> P/Q/R/S) are handled in
// upstream Ink but not yet in this fork's parse-keypress implementation.
// These tests document the expected behaviour for when support is added.

it.todo('Ctrl+F1 resolves to name "f1"');
it.todo('Ctrl+F2 resolves to name "f2"');
it.todo('Ctrl+F3 resolves to name "f3"');
it.todo('Ctrl+F4 resolves to name "f4"');
it.todo("unmapped ctrl sequence returns empty name");
it.todo("another unmapped ctrl sequence returns empty name");
it.todo('Shift+F1 resolves to name "f1" with shift');
