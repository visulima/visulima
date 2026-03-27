use std::fmt::Write;

/// Write a foreground color ANSI escape sequence into `buf`.
/// Color 255 is treated as the terminal default foreground (`\x1b[39m`).
/// All other values use 256-color mode (`\x1b[38;5;Nm`).
pub fn write_fg(buf: &mut String, color: u8) {
    if color == 255 {
        buf.push_str("\x1b[39m");
    } else {
        let _ = write!(buf, "\x1b[38;5;{}m", color);
    }
}

/// Write a background color ANSI escape sequence into `buf`.
/// Color 255 is treated as the terminal default background (`\x1b[49m`).
/// All other values use 256-color mode (`\x1b[48;5;Nm`).
pub fn write_bg(buf: &mut String, color: u8) {
    if color == 255 {
        buf.push_str("\x1b[49m");
    } else {
        let _ = write!(buf, "\x1b[48;5;{}m", color);
    }
}

/// Write SGR style escape sequences into `buf`.
///
/// The `styles` byte is a bitmask:
/// - bit 0 (1):   Bold
/// - bit 1 (2):   Dim
/// - bit 2 (4):   Italic
/// - bit 3 (8):   Underline
/// - bit 4 (16):  Blink
/// - bit 5 (32):  Invert
/// - bit 6 (64):  Hidden
/// - bit 7 (128): Strikethrough
///
/// A value of 0 emits a full SGR reset (`\x1b[0m`).
pub fn write_styles(buf: &mut String, styles: u8) {
    if styles == 0 {
        buf.push_str("\x1b[0m");
        return;
    }
    if styles & 1 != 0 { buf.push_str("\x1b[1m"); } // Bold
    if styles & 2 != 0 { buf.push_str("\x1b[2m"); } // Dim
    if styles & 4 != 0 { buf.push_str("\x1b[3m"); } // Italic
    if styles & 8 != 0 { buf.push_str("\x1b[4m"); } // Underline
    if styles & 16 != 0 { buf.push_str("\x1b[5m"); } // Blink
    if styles & 32 != 0 { buf.push_str("\x1b[7m"); } // Invert
    if styles & 64 != 0 { buf.push_str("\x1b[8m"); } // Hidden
    if styles & 128 != 0 { buf.push_str("\x1b[9m"); } // Strikethrough
}

/// Write a cursor-movement escape sequence into `buf`.
/// Converts from 0-based (x, y) to 1-based ANSI row/col.
pub fn write_move_cursor(buf: &mut String, x: u16, y: u16) {
    let _ = write!(buf, "\x1b[{};{}H", y + 1, x + 1);
}

// Keep thin wrapper functions for backward compat and tests.
// These allocate a String and are NOT used in the hot render path.

#[cfg(test)]
pub fn get_fg_ansi(color: u8) -> String {
    let mut s = String::new();
    write_fg(&mut s, color);
    s
}

#[cfg(test)]
pub fn get_bg_ansi(color: u8) -> String {
    let mut s = String::new();
    write_bg(&mut s, color);
    s
}

#[cfg(test)]
pub fn get_styles_ansi(styles: u8) -> String {
    let mut s = String::new();
    write_styles(&mut s, styles);
    s
}

#[cfg(test)]
pub fn move_cursor(x: u16, y: u16) -> String {
    let mut s = String::new();
    write_move_cursor(&mut s, x, y);
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Foreground color ──

    #[test]
    fn fg_default_color() {
        assert_eq!(get_fg_ansi(255), "\x1b[39m");
    }

    #[test]
    fn fg_color_zero() {
        assert_eq!(get_fg_ansi(0), "\x1b[38;5;0m");
    }

    #[test]
    fn fg_color_mid() {
        assert_eq!(get_fg_ansi(128), "\x1b[38;5;128m");
    }

    #[test]
    fn fg_color_254() {
        assert_eq!(get_fg_ansi(254), "\x1b[38;5;254m");
    }

    // ── Background color ──

    #[test]
    fn bg_default_color() {
        assert_eq!(get_bg_ansi(255), "\x1b[49m");
    }

    #[test]
    fn bg_color_zero() {
        assert_eq!(get_bg_ansi(0), "\x1b[48;5;0m");
    }

    #[test]
    fn bg_color_mid() {
        assert_eq!(get_bg_ansi(128), "\x1b[48;5;128m");
    }

    #[test]
    fn bg_color_254() {
        assert_eq!(get_bg_ansi(254), "\x1b[48;5;254m");
    }

    // ── Styles ──

    #[test]
    fn styles_reset() {
        assert_eq!(get_styles_ansi(0), "\x1b[0m");
    }

    #[test]
    fn styles_bold() {
        assert_eq!(get_styles_ansi(1), "\x1b[1m");
    }

    #[test]
    fn styles_dim() {
        assert_eq!(get_styles_ansi(2), "\x1b[2m");
    }

    #[test]
    fn styles_italic() {
        assert_eq!(get_styles_ansi(4), "\x1b[3m");
    }

    #[test]
    fn styles_underline() {
        assert_eq!(get_styles_ansi(8), "\x1b[4m");
    }

    #[test]
    fn styles_blink() {
        assert_eq!(get_styles_ansi(16), "\x1b[5m");
    }

    #[test]
    fn styles_invert() {
        assert_eq!(get_styles_ansi(32), "\x1b[7m");
    }

    #[test]
    fn styles_hidden() {
        assert_eq!(get_styles_ansi(64), "\x1b[8m");
    }

    #[test]
    fn styles_strikethrough() {
        assert_eq!(get_styles_ansi(128), "\x1b[9m");
    }

    #[test]
    fn styles_bold_italic() {
        // bold (1) | italic (4) = 5
        assert_eq!(get_styles_ansi(5), "\x1b[1m\x1b[3m");
    }

    #[test]
    fn styles_all_bits() {
        let result = get_styles_ansi(0xFF);
        assert!(result.contains("\x1b[1m"));
        assert!(result.contains("\x1b[2m"));
        assert!(result.contains("\x1b[3m"));
        assert!(result.contains("\x1b[4m"));
        assert!(result.contains("\x1b[5m"));
        assert!(result.contains("\x1b[7m"));
        assert!(result.contains("\x1b[8m"));
        assert!(result.contains("\x1b[9m"));
    }

    // ── Cursor movement ──

    #[test]
    fn move_cursor_origin() {
        // (0,0) should produce row 1, col 1
        assert_eq!(move_cursor(0, 0), "\x1b[1;1H");
    }

    #[test]
    fn move_cursor_offset() {
        // (5,3) should produce row 4, col 6
        assert_eq!(move_cursor(5, 3), "\x1b[4;6H");
    }

    #[test]
    fn move_cursor_large() {
        assert_eq!(move_cursor(199, 49), "\x1b[50;200H");
    }
}

