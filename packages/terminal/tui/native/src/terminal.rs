use napi_derive::napi;
use std::io::stdout;
use crossterm::{
    terminal::{enable_raw_mode, disable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
    cursor::{Hide, Show},
    event::{EnableMouseCapture, DisableMouseCapture},
    execute,
};

/// Helper trait to convert any `Display`-able error into a `napi::Result`.
trait IntoNapiResult<T> {
    fn into_napi(self) -> napi::Result<T>;
}

impl<T, E: std::fmt::Display> IntoNapiResult<T> for Result<T, E> {
    fn into_napi(self) -> napi::Result<T> {
        self.map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

/// Terminal size returned from `TerminalGuard::get_size()`.
#[napi(object)]
pub struct TerminalSize {
    pub cols: u32,
    pub rows: u32,
}

/// Query the current terminal size without entering any special mode.
#[napi]
pub fn terminal_size() -> napi::Result<TerminalSize> {
    let (cols, rows) = crossterm::terminal::size().into_napi()?;
    Ok(TerminalSize {
        cols: cols as u32,
        rows: rows as u32,
    })
}

/// RAII guard that enters raw mode + alternate screen on construction
/// and restores the terminal on drop (or explicit `leave()` call).
///
/// This prevents the terminal from being left in raw mode if the
/// Node process crashes or the guard is garbage-collected.
#[napi]
pub struct TerminalGuard {
    active: bool,
    mouse: bool,
}

#[napi]
impl TerminalGuard {
    /// Enter raw mode, switch to the alternate screen, and hide the cursor.
    /// Optionally enable SGR mouse tracking and bracketed paste mode.
    #[napi(constructor)]
    pub fn new(mouse: Option<bool>) -> napi::Result<Self> {
        let mouse = mouse.unwrap_or(false);
        enable_raw_mode().into_napi()?;
        // Enable alternate screen, hide cursor, optionally enable mouse + bracketed paste
        if mouse {
            execute!(stdout(), EnterAlternateScreen, Hide, EnableMouseCapture).into_napi()?;
            // Bracketed paste: \x1b[?2004h
            print!("\x1b[?2004h");
        } else {
            execute!(stdout(), EnterAlternateScreen, Hide).into_napi()?;
        }
        Ok(Self { active: true, mouse })
    }

    /// Restore the terminal to its original state.
    /// Safe to call multiple times — only the first call has any effect.
    #[napi]
    pub fn leave(&mut self) -> napi::Result<()> {
        if self.active {
            self.active = false;
            if self.mouse {
                // Disable bracketed paste: \x1b[?2004l
                print!("\x1b[?2004l");
                let _ = execute!(stdout(), DisableMouseCapture);
            }
            disable_raw_mode().into_napi()?;
            execute!(stdout(), LeaveAlternateScreen, Show).into_napi()?;
        }
        Ok(())
    }

    /// Query the current terminal size.
    #[napi]
    pub fn get_size(&self) -> napi::Result<TerminalSize> {
        let (cols, rows) = crossterm::terminal::size().into_napi()?;
        Ok(TerminalSize {
            cols: cols as u32,
            rows: rows as u32,
        })
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        if self.active {
            self.active = false;
            if self.mouse {
                print!("\x1b[?2004l");
                let _ = execute!(stdout(), DisableMouseCapture);
            }
            let _ = disable_raw_mode();
            let _ = execute!(stdout(), LeaveAlternateScreen, Show);
        }
    }
}

