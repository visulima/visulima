#![deny(clippy::all)]

use std::io::Write;
use napi_derive::napi;
use napi::bindgen_prelude::Uint32Array;
use unicode_width::UnicodeWidthChar;

mod ansi;
mod terminal;

const CONTINUATION_CELL: u32 = 0x0011_0000;

/// A double-buffered terminal renderer exposed to JavaScript via NAPI.
///
/// Compares a back buffer (from JS) against an internal front buffer and
/// emits only the minimal ANSI escape sequences needed to update the
/// terminal.
///
/// `row_offset` shifts all cursor positioning by N rows. Used for inline
/// and partial-screen modes where the renderer doesn't own row 0.
#[napi]
pub struct Renderer {
    width: u16,
    height: u16,
    row_offset: u16,
    front_buffer: Vec<u32>,
}

#[napi]
impl Renderer {
    #[napi(constructor)]
    pub fn new(width: u16, height: u16) -> Self {
        // Use u32::MAX as sentinel so the very first frame always
        // diffs every cell, including cells with char=0 / attr=0.
        Self {
            width,
            height,
            row_offset: 0,
            front_buffer: vec![u32::MAX; (width as usize) * (height as usize) * 2],
        }
    }

    /// Get the current width.
    #[napi(getter)]
    pub fn width(&self) -> u16 {
        self.width
    }

    /// Get the current height.
    #[napi(getter)]
    pub fn height(&self) -> u16 {
        self.height
    }

    /// Resize the renderer and reset the front buffer.
    #[napi]
    pub fn resize(&mut self, width: u16, height: u16) {
        self.width = width;
        self.height = height;
        self.front_buffer = vec![u32::MAX; (width as usize) * (height as usize) * 2];
    }

    /// Set a row offset for inline/partial-screen modes.
    /// All cursor positioning will be shifted down by this many rows.
    /// Does not reset the front buffer — call resize() if you need a full redraw.
    #[napi]
    pub fn set_row_offset(&mut self, offset: u16) {
        self.row_offset = offset;
    }

    #[napi]
    pub fn render(&mut self, back_buffer: Uint32Array) {
        let output = self.generate_diff(back_buffer.as_ref());
        if !output.is_empty() {
            self.write_output(output.as_bytes());
        }
    }

    /// Generate the ANSI diff string without writing to stdout.
    /// Used by benchmarks to measure diff performance without I/O.
    #[napi]
    pub fn render_diff(&mut self, back_buffer: Uint32Array) -> String {
        self.generate_diff(back_buffer.as_ref())
    }

    /// Write raw bytes to stdout through the same handle the renderer uses.
    /// Use this for cursor rewind sequences in inline mode to avoid
    /// interleaving with Node's process.stdout.write.
    #[napi]
    pub fn write_raw(&self, data: String) {
        if !data.is_empty() {
            self.write_output(data.as_bytes());
        }
    }

    pub fn generate_diff(&mut self, back_buffer: &[u32]) -> String {
        let mut output = String::new();
        // Reserve arbitrary capacity to prevent frequent reallocations
        output.reserve(8192); 

        let mut current_x: i32 = -1;
        let mut current_y: i32 = -1;

        // Initialize tracking colors to 255 (terminal default).
        // This is valid because the reset escape emitted below sets
        // the terminal to its default colors, matching our sentinel.
        let mut last_fg: u8 = 255;
        let mut last_bg: u8 = 255;
        let mut last_style: u8 = 0;

        // Ensure starting state is reset
        output.push_str("\x1b[0m");

        let cols = self.width as usize;

        for i in 0..((self.width as usize) * (self.height as usize)) {
            let offset = i * 2;
            let char_code = back_buffer[offset];
            let attr_code = back_buffer[offset + 1];

            if char_code != self.front_buffer[offset] || attr_code != self.front_buffer[offset + 1] {
                // Determine layout
                let x = (i % cols) as u16;
                let y = (i / cols) as u16;

                // Continuation marker for the trailing cell of a wide glyph.
                // It's an occupied logical cell but non-printing.
                if char_code == CONTINUATION_CELL {
                    self.front_buffer[offset] = char_code;
                    self.front_buffer[offset + 1] = attr_code;
                    current_x = x as i32;
                    current_y = y as i32;
                    continue;
                }

                // Only move cursor if not contiguous.
                // current_x tracks the last occupied cell index, so wide glyphs
                // (width=2) keep contiguous progression aligned.
                if current_x + 1 != x as i32 || current_y != y as i32 {
                    ansi::write_move_cursor(&mut output, x, y + self.row_offset);
                }

                // Extract values (attr: fg 8 bits, bg 8 bits, styles 8 bits)
                let fg = (attr_code & 0xFF) as u8;
                let bg = ((attr_code >> 8) & 0xFF) as u8;
                let styles = ((attr_code >> 16) & 0xFF) as u8;

                let ch = if char_code == 0 {
                    ' '
                } else {
                    char::from_u32(char_code).unwrap_or(' ')
                };
                let display_width = UnicodeWidthChar::width(ch).unwrap_or(1).max(1) as i32;

                // Diff Styles
                if styles != last_style {
                    ansi::write_styles(&mut output, styles);
                    last_style = styles;

                    // Style reset can clear colors, so force color redraw
                    if styles == 0 {
                        last_fg = 255;
                        last_bg = 255;
                    }
                }

                // Diff Colors
                if fg != last_fg {
                    ansi::write_fg(&mut output, fg);
                    last_fg = fg;
                }

                if bg != last_bg {
                    ansi::write_bg(&mut output, bg);
                    last_bg = bg;
                }

                output.push(ch);
                self.front_buffer[offset] = char_code;
                self.front_buffer[offset + 1] = attr_code;

                current_x = x as i32 + display_width - 1;
                current_y = y as i32;
            }
        }
        output
    }

    /// Write output to stdout using safe Rust I/O.
    fn write_output(&self, data: &[u8]) {
        let stdout = std::io::stdout();
        let mut lock = stdout.lock();
        let _ = lock.write_all(data);
        let _ = lock.flush();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prime a renderer so its front buffer matches a zero-filled back buffer.
    /// After this call, only intentional changes will produce diff output.
    fn primed_renderer(w: u16, h: u16) -> Renderer {
        let mut r = Renderer::new(w, h);
        let blank = vec![0u32; (w as usize) * (h as usize) * 2];
        r.generate_diff(&blank);
        r
    }

    #[test]
    fn test_first_frame_diffs_all_cells() {
        // With u32::MAX sentinel, the very first frame should diff every cell
        let mut renderer = Renderer::new(3, 2);
        let back_buffer = vec![0u32; 12]; // 3*2*2
        let diff = renderer.generate_diff(&back_buffer);
        // Should contain more than just the reset — every cell diffs
        assert!(diff.len() > "\x1b[0m".len(), "First frame should produce output for all cells");
    }

    #[test]
    fn test_diffing_engine_empty_after_prime() {
        let mut renderer = primed_renderer(10, 10);
        let back_buffer = vec![0; 200];
        let diff = renderer.generate_diff(&back_buffer);
        // After priming, an identical buffer produces only the reset prefix
        assert_eq!(diff, "\x1b[0m");
    }

    #[test]
    fn test_diffing_engine_single_char() {
        let mut renderer = primed_renderer(10, 10);
        let mut back_buffer = vec![0; 200];
        // Write 'A' to (1, 1), which is index 11
        // offset 22, 23
        back_buffer[22] = 'A' as u32; 
        back_buffer[23] = ((0 as u32) << 16) | ((2 as u32) << 8) | (1 as u32);

        let diff = renderer.generate_diff(&back_buffer);
        // Should contain reset + move_cursor + fg + bg + 'A'
        assert!(diff.contains("\x1b[2;2H")); // Move cursor to (1,1) -> row 2, col 2
        assert!(diff.contains("\x1b[38;5;1m")); // FG 1
        assert!(diff.contains("\x1b[48;5;2m")); // BG 2
        assert!(diff.ends_with("A"));
    }

    #[test]
    fn test_second_identical_call_produces_empty_diff() {
        let mut renderer = primed_renderer(5, 5);
        let mut back_buffer = vec![0; 50];
        back_buffer[0] = 'X' as u32;
        back_buffer[1] = 1; // fg=1, bg=0, style=0

        // First call writes the diff
        let diff1 = renderer.generate_diff(&back_buffer);
        assert!(diff1.contains("X"));

        // Second call with same buffer: front now matches back
        let diff2 = renderer.generate_diff(&back_buffer);
        assert_eq!(diff2, "\x1b[0m", "Second call should only contain the reset prefix");
    }

    #[test]
    fn test_front_buffer_updated_after_diff() {
        let mut renderer = primed_renderer(5, 5);
        let mut back_buffer = vec![0; 50];
        back_buffer[0] = 'Z' as u32;
        back_buffer[1] = 0xFF; // fg=255 (default), bg=0, style=0

        renderer.generate_diff(&back_buffer);

        assert_eq!(renderer.front_buffer[0], 'Z' as u32);
        assert_eq!(renderer.front_buffer[1], 0xFF);
    }

    #[test]
    fn test_contiguous_cells_skip_cursor_move() {
        let mut renderer = primed_renderer(10, 1);
        let mut back_buffer = vec![0; 20]; // 10 cols * 1 row * 2

        // Write 'A' at col 0 and 'B' at col 1 (contiguous)
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = 1;
        back_buffer[2] = 'B' as u32;
        back_buffer[3] = 1;

        let diff = renderer.generate_diff(&back_buffer);

        // Should have one cursor move (to col 0), then A and B without another move
        let move_count = diff.matches('H').count();
        assert_eq!(move_count, 1, "Only one cursor move expected for contiguous cells");
        assert!(diff.contains("AB") || diff.ends_with("AB"),
            "A and B should be adjacent in output without a cursor move between them");
    }

    #[test]
    fn test_non_contiguous_cells_emit_cursor_move() {
        let mut renderer = primed_renderer(10, 1);
        let mut back_buffer = vec![0; 20];

        // Write 'A' at col 0 and 'C' at col 5 (gap)
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = 1;
        back_buffer[10] = 'C' as u32; // col 5 = offset 10
        back_buffer[11] = 1;

        let diff = renderer.generate_diff(&back_buffer);

        let move_count = diff.matches('H').count();
        assert_eq!(move_count, 2, "Two cursor moves expected for non-contiguous cells");
    }

    #[test]
    fn test_wide_glyph_advances_cursor_by_display_width() {
        let mut renderer = primed_renderer(10, 1);
        let mut back_buffer = vec![0; 20];

        // Wide CJK char at col 0, continuation marker at col 1, ASCII at col 2.
        back_buffer[0] = '界' as u32;
        back_buffer[1] = 1;
        back_buffer[2] = CONTINUATION_CELL;
        back_buffer[3] = 1;
        back_buffer[4] = 'B' as u32;
        back_buffer[5] = 1;

        let diff = renderer.generate_diff(&back_buffer);

        // Continuation should be non-printing — no extra char between wide glyph and B.
        assert!(diff.contains("界B"), "Continuation cells must not emit a printable spacer");

        // Only one cursor move expected: start at col 0, then contiguous progression.
        let move_count = diff.matches('H').count();
        assert_eq!(move_count, 1, "Wide glyph should keep cursor progression contiguous");
    }

    #[test]
    fn test_continuation_only_update_is_non_printing() {
        let mut renderer = primed_renderer(5, 1);
        let mut back_buffer = vec![0; 10];

        // Update a single continuation cell to verify it doesn't emit a space.
        back_buffer[2] = CONTINUATION_CELL;
        back_buffer[3] = 1;

        let diff = renderer.generate_diff(&back_buffer);

        // Prefix reset only — continuation markers are non-printing.
        assert_eq!(diff, "\x1b[0m", "Continuation-only updates should not emit printable output");
    }

    #[test]
    fn test_style_change_emits_sgr() {
        let mut renderer = primed_renderer(5, 1);
        let mut back_buffer = vec![0; 10];

        // Cell 0: 'A' bold (style=1)
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = (1u32 << 16) | 1; // style=bold, fg=1

        // Cell 1: 'B' italic (style=4)
        back_buffer[2] = 'B' as u32;
        back_buffer[3] = (4u32 << 16) | 1; // style=italic, fg=1

        let diff = renderer.generate_diff(&back_buffer);

        assert!(diff.contains("\x1b[1m"), "Should contain bold SGR");
        assert!(diff.contains("\x1b[3m"), "Should contain italic SGR");
    }

    #[test]
    fn test_style_reset_forces_color_redraw() {
        let mut renderer = primed_renderer(5, 1);
        let mut back_buffer = vec![0; 10];

        // Cell 0: 'A' bold, fg=1, bg=2
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = (1u32 << 16) | (2u32 << 8) | 1;

        // Cell 1: 'B' no style (reset), fg=1, bg=2
        // After a style reset, colors should be re-emitted even though fg/bg match
        back_buffer[2] = 'B' as u32;
        back_buffer[3] = (0u32 << 16) | (2u32 << 8) | 1;

        let diff = renderer.generate_diff(&back_buffer);

        // After the reset (\x1b[0m), fg and bg should be emitted again
        // Find the reset that corresponds to style=0 (not the prefix reset)
        let after_a = diff.find('A').unwrap();
        let rest = &diff[after_a..];
        assert!(rest.contains("\x1b[0m"), "Should contain style reset after A");
        assert!(rest.contains("\x1b[38;5;1m"), "Should re-emit fg after style reset");
        assert!(rest.contains("\x1b[48;5;2m"), "Should re-emit bg after style reset");
    }

    #[test]
    fn test_color_diff_only_emits_changed_color() {
        let mut renderer = primed_renderer(5, 1);
        let mut back_buffer = vec![0; 10];

        // Cell 0: fg=1, bg=2
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = (2u32 << 8) | 1;

        // Cell 1: fg=1, bg=3 (only bg changed)
        back_buffer[2] = 'B' as u32;
        back_buffer[3] = (3u32 << 8) | 1;

        let diff = renderer.generate_diff(&back_buffer);

        // After A, only bg should change; fg=1 should appear once
        let fg1_count = diff.matches("\x1b[38;5;1m").count();
        assert_eq!(fg1_count, 1, "fg=1 should only be emitted once since it doesn't change");
    }

    #[test]
    fn test_default_fg_emits_reset_code() {
        let mut renderer = primed_renderer(5, 1);
        let mut back_buffer = vec![0; 10];

        // Cell 0: fg=1 (non-default)
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = 1;

        // Cell 1: fg=255 (default)
        back_buffer[2] = 'B' as u32;
        back_buffer[3] = 255;

        let diff = renderer.generate_diff(&back_buffer);
        assert!(diff.contains("\x1b[39m"), "Should contain default fg reset");
    }

    #[test]
    fn test_multirow_rendering() {
        let mut renderer = primed_renderer(3, 3);
        let mut back_buffer = vec![0; 18]; // 3*3*2

        // Cell (0,0): 'A'
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = 1;

        // Cell (0,2) = index 6, offset 12: 'C' (row 2, col 0)
        back_buffer[12] = 'C' as u32;
        back_buffer[13] = 1;

        let diff = renderer.generate_diff(&back_buffer);

        assert!(diff.contains("\x1b[1;1H"), "Should move to row 1, col 1");
        assert!(diff.contains("\x1b[3;1H"), "Should move to row 3, col 1");
        assert!(diff.contains('A'));
        assert!(diff.contains('C'));
    }

    #[test]
    fn test_invalid_char_code_replaced_with_space() {
        let mut renderer = primed_renderer(5, 1);
        let mut back_buffer = vec![0; 10];

        // Use an invalid Unicode code point
        back_buffer[0] = 0xD800; // surrogate, invalid
        back_buffer[1] = 1;

        let diff = renderer.generate_diff(&back_buffer);
        // Invalid char should be replaced with space
        assert!(diff.ends_with(' '), "Invalid char should render as space");
    }

    #[test]
    fn test_row_offset_shifts_cursor_position() {
        let mut renderer = Renderer::new(10, 3);
        renderer.set_row_offset(5);
        let mut back_buffer = vec![0u32; 10 * 3 * 2];
        // Write 'A' at row 0, col 0 in the buffer
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = 1;
        let diff = renderer.generate_diff(&back_buffer);
        // Row 0 in buffer + offset 5 = terminal row 6 (1-based)
        assert!(diff.contains("\x1b[6;1H"), "Row offset should shift cursor to row 6");
    }

    #[test]
    fn test_row_offset_does_not_reset_front_buffer() {
        let mut renderer = primed_renderer(10, 3);
        let mut back_buffer = vec![0u32; 10 * 3 * 2];
        back_buffer[0] = 'A' as u32;
        back_buffer[1] = 1;
        // First render — primes front buffer with 'A'
        renderer.generate_diff(&back_buffer);
        // Now set offset — should NOT reset front buffer
        renderer.set_row_offset(2);
        // Same buffer: should produce no cell changes (only the reset prefix)
        let diff = renderer.generate_diff(&back_buffer);
        assert_eq!(diff, "\x1b[0m", "setRowOffset should not reset front buffer");
    }

    #[test]
    fn test_resize_resets_front_buffer() {
        let mut renderer = primed_renderer(5, 5);
        assert_eq!(renderer.width(), 5);
        assert_eq!(renderer.height(), 5);

        renderer.resize(10, 10);
        assert_eq!(renderer.width(), 10);
        assert_eq!(renderer.height(), 10);

        // After resize, a zero-filled buffer should diff every cell (sentinel reset)
        let back_buffer = vec![0u32; 200];
        let diff = renderer.generate_diff(&back_buffer);
        assert!(diff.len() > "\x1b[0m".len(), "Resize should reset front buffer");
    }
}
