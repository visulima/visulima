//! TypeScript / JSX → JavaScript transpilation via oxc.
//!
//! Powers vis's runtime TS loader (config files, generators, `vis x`), replacing
//! the `jiti` JS dependency with vis's own native addon — one binary, no extra
//! native dep. Strips types and lowers non-erasable syntax (enums, namespaces,
//! parameter properties, legacy decorators) and JSX. Does NOT type-check.

use std::path::Path;

use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_codegen::Codegen;
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

    let code = Codegen::new().build(&program).code;

    Ok(TransformResult { code })
}
