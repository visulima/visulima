# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/pail` package.

## Version 3.0.0

### Dependency Consolidation

In version 3.0.0, we consolidated external dependencies by replacing them with internal `@visulima/string` package utilities.

#### Replaced Dependencies

| Previous        | New                                 | Reason                                   |
| --------------- | ----------------------------------- | ---------------------------------------- |
| `wrap-ansi`     | `@visulima/string` (wordWrap)       | Consolidated text wrapping functionality |
| `string-length` | `@visulima/string` (getStringWidth) | Consolidated string width calculation    |

#### Benefits

- **Reduced bundle size**: Fewer external dependencies
- **Better maintenance**: Internal package control
- **Consistent API**: Unified string utilities across visulima packages
- **Performance**: Optimized internal implementations

#### Backward Compatibility

This change is **backward compatible** for pail users. The internal API changes don't affect the public pail API. Users of pail don't need to change their code - this is purely an internal refactoring.
