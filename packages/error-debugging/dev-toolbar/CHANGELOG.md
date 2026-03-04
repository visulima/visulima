## @visulima/dev-toolbar [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.3...@visulima/dev-toolbar@1.0.0-alpha.4) (2026-03-04)

### Bug Fixes

* allowed vite 8 ([807071e](https://github.com/visulima/visulima/commit/807071ea041e1beaf7e773ac6bbd23efa9f33b32))
* **dev-toolbar:** exclude inspector and tailwind from More "Additional Apps" ([812252a](https://github.com/visulima/visulima/commit/812252a96916ac346765631a0997ff2150e54e40))

### Miscellaneous Chores

* deps update ([9be09e9](https://github.com/visulima/visulima/commit/9be09e95e2bce8fe52e88b186c43b8cc6bae865c))
* **dev-toolbar:** fix all ESLint errors and warnings across src and tests ([a14d2ed](https://github.com/visulima/visulima/commit/a14d2ed116b23ff1c61db28324b76aa55931919c))
* **dev-toolbar:** remove external Google Fonts dependency ([2e81646](https://github.com/visulima/visulima/commit/2e81646f49a886d8ef9df7f9c951c87363f9b50d))

## @visulima/dev-toolbar [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.2...@visulima/dev-toolbar@1.0.0-alpha.3) (2026-03-03)

### Features

* **dev-toolbar:** add editor option to configure launch-editor per project ([2003693](https://github.com/visulima/visulima/commit/200369383470a835c5312b8af7b11e4d4183c369))
* **dev-toolbar:** add JSX source injection Vite plugin for inspector click-to-source ([2c5c5a6](https://github.com/visulima/visulima/commit/2c5c5a65399cd8cb14b10c83a9346364e7ca3ecd))
* **dev-toolbar:** add light/dark theme awareness to inspector overlays ([2bd30ee](https://github.com/visulima/visulima/commit/2bd30eeb9e7047894d8287a63b4719873df22375))
* **dev-toolbar:** add open-in-editor, copy HTML, and copy path to inspector ([f88e9b0](https://github.com/visulima/visulima/commit/f88e9b0d21979dd1214c511a9474b0204bb16191))
* **dev-toolbar:** add Preact-native UI kit and migrate apps to use it ([2fced8e](https://github.com/visulima/visulima/commit/2fced8e8547409ad9d39fd9af2a81010a5fd1999))
* **dev-toolbar:** add removeDevtoolsOnBuild option to Vite plugin ([d8d1d67](https://github.com/visulima/visulima/commit/d8d1d67a20747df23da60e4d81a2acd89516dc48))
* **dev-toolbar:** implement timeline event capture for HMR, network and JS errors ([9851ac7](https://github.com/visulima/visulima/commit/9851ac7a12a3b72d52b4f705c2afa7ecbfdf3cc0))

### Bug Fixes

* **dev-toolbar:** add suppressHydrationWarning to prevent SSR hydration mismatch ([3c5d8e0](https://github.com/visulima/visulima/commit/3c5d8e0eb7eaf786dbe029598f50dfb2b5ce68a6))
* **dev-toolbar:** align UI components and inspector with design system ([93ff58b](https://github.com/visulima/visulima/commit/93ff58b88e61d2eab8b3289cf3ad76028380a45f))
* **dev-toolbar:** correct broken test assertions for settings, button, input, and textarea ([770100f](https://github.com/visulima/visulima/commit/770100f5a73b634e65373fb2b2e344a353a0978c))
* **dev-toolbar:** fix inspector by closing panel during inspection and move settings to bottom ([575e79c](https://github.com/visulima/visulima/commit/575e79ce2c581c0f48eae55589c83d9dbb30b6f1))
* **dev-toolbar:** hide action-only apps (e.g. Inspector) from canvas sidebar ([9fcf7e1](https://github.com/visulima/visulima/commit/9fcf7e1786ec4b7c1666da6500f011eff13a2fd2))
* **dev-toolbar:** prevent action buttons from opening the canvas panel ([113e540](https://github.com/visulima/visulima/commit/113e540bb19d5dbedc6fbef9138bf04d2434b7f1))
* **dev-toolbar:** prevent hydration mismatch from data-vdt-source in SSR apps ([231ecc7](https://github.com/visulima/visulima/commit/231ecc73f70a49da4a6cd0b584760d12369bd8f0))
* **dev-toolbar:** remove redundant server arg from RPC function dispatch ([a941dc7](https://github.com/visulima/visulima/commit/a941dc7e593d3681bed61b374262abb8a476392b))
* **dev-toolbar:** replace require() with dynamic import() in openInEditor ([3fede74](https://github.com/visulima/visulima/commit/3fede740db2c431c6bb62897d13a0d9afb8cc65a))
* **dev-toolbar:** split RPC barrel and fix open-in-editor with launch-editor ([28e079a](https://github.com/visulima/visulima/commit/28e079afa10ac4ed2e729205f8bdf9405d33c1c2))
* **dev-toolbar:** use HMR WebSocket RPC to open files in editor ([a63cdab](https://github.com/visulima/visulima/commit/a63cdab1c30f9f73eb6b5f59f7c1ee4143135eba))
* **dev-toolbar:** use original file positions to prevent SSR hydration mismatch ([a40edd5](https://github.com/visulima/visulima/commit/a40edd5fb1a11a5208182dd71627b472f64db6c5))

### Documentation

* **dev-toolbar:** document removeDevtoolsOnBuild option ([00955b2](https://github.com/visulima/visulima/commit/00955b2a484df78f66b4c58babbeb514d4943285))
* **dev-toolbar:** update docs for all recent feature additions ([b204e0f](https://github.com/visulima/visulima/commit/b204e0f8956cafb6967363fa0cc2b01c435cdedc))

### Code Refactoring

* **dev-toolbar:** convert inspector to toolbar action button ([0d0b682](https://github.com/visulima/visulima/commit/0d0b682e65511c158baa29134a8c50e7db459284))

## @visulima/dev-toolbar [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.1...@visulima/dev-toolbar@1.0.0-alpha.2) (2026-03-01)

### Bug Fixes

* **dev-toolbar:** correct Tailwind v4 PostCSS setup in TanStack Start examples ([090da58](https://github.com/visulima/visulima/commit/090da58cbbd87695c238dfd1f7371a6f06b9ef80))
* **dev-toolbar:** dismiss tooltip on button click ([0ed60af](https://github.com/visulima/visulima/commit/0ed60af72f2390f8fcebde063d35e45e6f7fe9b8))
* **dev-toolbar:** handle CJS/ESM interop for axe-core dynamic import ([7a86907](https://github.com/visulima/visulima/commit/7a8690730b7c7858beb635dc1d66869d5b5e19e2))
* **dev-toolbar:** use appendTo in TanStack Start examples for SSR ([0844250](https://github.com/visulima/visulima/commit/0844250edbeeda1dfdc28058316bb6303e91fda6))

### Documentation

* **dev-toolbar:** document appendTo for SSR frameworks (TanStack Start) ([eba507e](https://github.com/visulima/visulima/commit/eba507eba8d0b705f23f32e7c08dc40fca87473a))

### Miscellaneous Chores

* **dev-toolbar:** add framework examples for six setups ([38117c1](https://github.com/visulima/visulima/commit/38117c1e0d6d8d3abb94785d95780482f5870d5c))
* **dev-toolbar:** add TanStack Start + Cloudflare Pages example ([1463ef8](https://github.com/visulima/visulima/commit/1463ef892669215bdc71fe90048e40cfbb4907c0))
* **dev-toolbar:** add TanStack Start and Cloudflare examples ([ddfe175](https://github.com/visulima/visulima/commit/ddfe17571bb416712eb02f4ae0222d182bdc2844))
* remove IDE configs, memory-bank, and stale lint script ([3a1100e](https://github.com/visulima/visulima/commit/3a1100e1f9e5dae6fb6fefd486195e8cc80fc578))

## @visulima/dev-toolbar 1.0.0-alpha.1 (2026-02-28)

### Features

* **dev-toolbar:** initialize dev-toolbar package  ([#586](https://github.com/visulima/visulima/issues/586)) ([a3ab9d6](https://github.com/visulima/visulima/commit/a3ab9d6e6c768853854b95fa8eee908b95235ea5))
