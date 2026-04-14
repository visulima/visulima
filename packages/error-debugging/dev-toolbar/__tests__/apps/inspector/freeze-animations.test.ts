// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { freezeAll, isFrozen, toggleFreeze, unfreezeAll } from "../../../src/apps/inspector/freeze-animations";

describe("freeze-animations", () => {
    afterEach(() => {
        // Ensure clean state
        if (isFrozen()) {
            unfreezeAll();
        }
    });

    describe(isFrozen, () => {
        it("returns false initially", () => {
            expect(isFrozen()).toBe(false);
        });
    });

    describe(freezeAll, () => {
        it("sets frozen state to true", () => {
            freezeAll();

            expect(isFrozen()).toBe(true);

            unfreezeAll();
        });

        it("injects freeze CSS into head", () => {
            freezeAll();

            const style = document.querySelector("#__vdt_freeze_styles");

            expect(style).toBe(true);
            expect(style?.textContent).toContain("animation-play-state: paused");
            expect(style?.textContent).toContain("transition: none");

            unfreezeAll();
        });

        it("is idempotent", () => {
            freezeAll();
            freezeAll(); // second call should be no-op

            expect(isFrozen()).toBe(true);

            const styles = document.querySelectorAll("#__vdt_freeze_styles");

            expect(styles).toHaveLength(1);

            unfreezeAll();
        });
    });

    describe(unfreezeAll, () => {
        it("sets frozen state to false", () => {
            freezeAll();
            unfreezeAll();

            expect(isFrozen()).toBe(false);
        });

        it("removes freeze CSS from head", () => {
            freezeAll();
            unfreezeAll();

            const style = document.querySelector("#__vdt_freeze_styles");

            expect(style).toBeNull();
        });

        it("is no-op when not frozen", () => {
            unfreezeAll(); // should not throw

            expect(isFrozen()).toBe(false);
        });
    });

    describe(toggleFreeze, () => {
        it("freezes when not frozen", () => {
            const result = toggleFreeze();

            expect(result).toBe(true);
            expect(isFrozen()).toBe(true);

            unfreezeAll();
        });

        it("unfreezes when frozen", () => {
            freezeAll();

            const result = toggleFreeze();

            expect(result).toBe(false);
            expect(isFrozen()).toBe(false);
        });
    });
});
