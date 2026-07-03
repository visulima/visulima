# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/spinner` is a minimal terminal spinner library — single (`Spinner`) and stacked (`MultiSpinner`) animations driven by a frame catalog. Public API in `src/index.ts`: the classes plus helpers (`getSpinner`, `getSpinnerNames`, `getRandomSpinner`, `spinners`) and types from `src/types.ts`.

## Architecture

- The bundled frame catalog lives in `src/spinners.ts`. `cli-spinners` is a devDependency used only at build time as the seed — do not add it as a runtime dep.
- All redraw work is delegated to `@visulima/interactive-manager` (only runtime dep). Custom frames extend `CustomSpinnerName`; `SpinnerName` is the bundled-catalog union.
- `SpinnerStartOptions` separates one-shot start args from the persistent `SpinnerOptions` on the instance — keep that split when adding new knobs.

## Related

- Pairs with `@visulima/progress-bar`; both ride the same `InteractiveManager`.
