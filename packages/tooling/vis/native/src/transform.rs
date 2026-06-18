//! TypeScript / JSX → JavaScript transpilation via oxc.
//!
//! Powers vis's runtime TS loader (config files, generators, `vis x`), replacing
//! the `jiti` JS dependency with vis's own native addon — one binary, no extra
//! native dep. Strips types and lowers non-erasable syntax (enums, namespaces,
//! parameter properties, legacy decorators) and JSX. Does NOT type-check.

use std::path::Path;

use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_codegen::{Codegen, CodegenOptions, CodegenReturn};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;
use oxc_transformer::{TransformOptions, Transformer};

#[napi(object)]
pub struct TransformResult {
    /// Transpiled JavaScript source.
    pub code: String,
}

/// Transpile a TS/TSX/JS/JSX source string to JavaScript. `filename` selects the
/// source dialect by extension (`.ts`/`.tsx`/`.mts`/`.cts`/`.js`/...). Returns the
/// emitted JS; throws on a fatal parse failure.
#[napi(catch_unwind)]
pub fn transform_ts(filename: String, source: String) -> napi::Result<TransformResult> {
    let allocator = Allocator::default();
    let path = Path::new(&filename);
    let source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::ts());

    let parser_return = Parser::new(&allocator, &source, source_type).parse();

    if parser_return.panicked {
        return Err(napi::Error::from_reason(format!(
            "vis-native: failed to parse {filename}"
        )));
    }

    let mut program = parser_return.program;

    let scoping = SemanticBuilder::new().build(&program).semantic.into_scoping();

    let options = TransformOptions::default();

    Transformer::new(&allocator, path, &options).build_with_scoping(scoping, &mut program);

    // Emit a source map so stack traces from `vis x`/config point at the original
    // TS source, not the transpiled output. Inlined as a base64 data URL so it
    // travels with the code through both loader tiers (registerHooks + temp file);
    // the runtime enables `process.setSourceMapsEnabled(true)` to consume it.
    let CodegenReturn { mut code, map, .. } = Codegen::new()
        .with_options(CodegenOptions {
            source_map_path: Some(path.to_path_buf()),
            ..Default::default()
        })
        .build(&program);

    if let Some(map) = map {
        code.push_str("\n//# sourceMappingURL=");
        code.push_str(&map.to_data_url());
        code.push('\n');
    }

    Ok(TransformResult { code })
}
