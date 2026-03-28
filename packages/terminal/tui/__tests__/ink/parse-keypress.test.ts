import { describe, it } from "vitest";

describe("parse-keypress", () => {
    // VT220-style modifier sequences (ESC [ 1 ; <mod> P/Q/R/S) are handled in
    // upstream Ink but not yet in this fork's parse-keypress implementation.
    // These tests document the expected behaviour for when support is added.

    it.todo("ctrl+F1 resolves to name \"f1\"");
    it.todo("ctrl+F2 resolves to name \"f2\"");
    it.todo("ctrl+F3 resolves to name \"f3\"");
    it.todo("ctrl+F4 resolves to name \"f4\"");
    it.todo("unmapped ctrl sequence returns empty name");
    it.todo("another unmapped ctrl sequence returns empty name");
    it.todo("shift+F1 resolves to name \"f1\" with shift");
});
