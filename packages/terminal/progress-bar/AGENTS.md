# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/progress-bar` renders single (`ProgressBar`) and stacked (`MultiProgressBar`) terminal progress bars with selectable styles. Public API in `src/index.ts`; types (`ProgressBarOptions`, `ProgressBarPayload`, `ProgressBarStyle`, `MultiBarOptions`) come from `src/types.ts`, helpers (`applyStyleToOptions`, `getBarChar`) from `src/utils.ts`.

## Architecture

- All redraw bookkeeping is delegated to `@visulima/interactive-manager` (the only runtime dependency) — keep cursor/erase logic out of this package and route through the manager so spinners and progress bars coexist without tearing.
- Style presets live in `src/utils.ts`; add new styles there alongside the existing bar-character pickers rather than introducing a new module.

## Related

- Pairs with `@visulima/spinner` (same `InteractiveManager` substrate, so a CLI can render both at once).
