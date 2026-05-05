use ec4rs::property::{EndOfLine, IndentSize, IndentStyle};
use napi_derive::napi;

#[napi(object)]
pub struct EditorconfigDefaults {
    pub indent: Option<String>,
    pub line_ending: Option<String>,
}

/// Resolves `.editorconfig` defaults for `file_path` using the spec-compliant
/// `ec4rs` parser. Mirrors the previous `editorconfig` npm package surface
/// consumed by `src/util/editorconfig.ts`: returns the indent string and a
/// normalized line-ending tag, or `None` for either when no usable value is
/// configured. Parse / IO failures collapse to an empty result so callers can
/// fall back to content sniffing without try/catch noise.
#[napi]
pub fn resolve_editorconfig_defaults(file_path: String) -> EditorconfigDefaults {
    let cfg = match ec4rs::properties_of(&file_path) {
        Ok(c) => c,
        Err(_) => {
            return EditorconfigDefaults {
                indent: None,
                line_ending: None,
            };
        },
    };

    let indent = if matches!(cfg.get::<IndentStyle>(), Ok(IndentStyle::Tabs)) {
        Some("\t".to_string())
    } else if let Ok(IndentSize::Value(n)) = cfg.get::<IndentSize>() {
        if n > 0 { Some(" ".repeat(n)) } else { None }
    } else {
        None
    };

    let line_ending = match cfg.get::<EndOfLine>() {
        Ok(EndOfLine::Lf) => Some("lf".to_string()),
        Ok(EndOfLine::CrLf) => Some("crlf".to_string()),
        _ => None,
    };

    EditorconfigDefaults { indent, line_ending }
}
