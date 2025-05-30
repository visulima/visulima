import { describe, expect, it } from "vitest";

import { ESC } from "../../src/constants";
import type { MouseButtonType, MouseModifiers } from "../../src/mouse";
import {
    disableAnyEventMouse,
    disableButtonEventMouse,
    disableFocusTracking,
    disableNormalMouse,
    disableSgrMouse,
    disableX10Mouse,
    enableAnyEventMouse,
    enableButtonEventMouse,
    enableFocusTracking,
    enableNormalMouse,
    enableSgrMouse,
    enableX10Mouse,
    encodeMouseButtonByte,
    MouseButton,
    mouseSgrSequence,
    mouseX10Sequence,
} from "../../src/mouse";

describe(encodeMouseButtonByte, () => {
    it("should encode basic buttons without modifiers or motion", () => {
        expect.assertions(4);
        expect(encodeMouseButtonByte(MouseButton.LEFT, false)).toBe(0b0000_0000); // Left = 0
        expect(encodeMouseButtonByte(MouseButton.MIDDLE, false)).toBe(0b0000_0001); // Middle = 1
        expect(encodeMouseButtonByte(MouseButton.RIGHT, false)).toBe(0b0000_0010); // Right = 2
        expect(encodeMouseButtonByte(MouseButton.RELEASE, false)).toBe(0b0000_0011); // Release = 3
    });

    it("should encode wheel buttons", () => {
        expect.assertions(4);
        // Wheel Up = 0 + wheel bit
        expect(encodeMouseButtonByte(MouseButton.WHEEL_UP, false)).toBe(0b0100_0000);
        // Wheel Down = 1 + wheel bit
        expect(encodeMouseButtonByte(MouseButton.WHEEL_DOWN, false)).toBe(0b0100_0001);
        // Wheel Left = 2 + wheel bit
        expect(encodeMouseButtonByte(MouseButton.WHEEL_LEFT, false)).toBe(0b0100_0010);
        // Wheel Right = 3 + wheel bit
        expect(encodeMouseButtonByte(MouseButton.WHEEL_RIGHT, false)).toBe(0b0100_0011);
    });

    it("should encode additional buttons (8-11)", () => {
        expect.assertions(4);
        // Button 8 (Backward) = 0 + additional bit
        expect(encodeMouseButtonByte(MouseButton.BACKWARD, false)).toBe(0b1000_0000);
        // Button 9 (Forward) = 1 + additional bit
        expect(encodeMouseButtonByte(MouseButton.FORWARD, false)).toBe(0b1000_0001);
        // Button 10 = 2 + additional bit
        expect(encodeMouseButtonByte(MouseButton.BUTTON_10, false)).toBe(0b1000_0010);
        // Button 11 = 3 + additional bit
        expect(encodeMouseButtonByte(MouseButton.BUTTON_11, false)).toBe(0b1000_0011);
    });

    it("should encode motion bit", () => {
        expect.assertions(1);
        expect(encodeMouseButtonByte(MouseButton.LEFT, true)).toBe(0b0010_0000);
    });

    it("should encode modifiers", () => {
        expect.assertions(1);

        const modifiers: MouseModifiers = { alt: true, ctrl: true, shift: true };

        // Left (0) + shift (4) + alt (8) + ctrl (16) = 28
        expect(encodeMouseButtonByte(MouseButton.LEFT, false, modifiers)).toBe(0b0001_1100);
    });

    it("should encode motion with modifiers", () => {
        expect.assertions(2);

        const modifiers: MouseModifiers = { shift: true };

        // Left (0) + shift (4) + motion (32) = 36
        expect(encodeMouseButtonByte(MouseButton.LEFT, true, modifiers)).toBe(0b0010_0100);
        // Wheel up (64) + shift (4) + motion (32) = 100
        expect(encodeMouseButtonByte(MouseButton.WHEEL_UP, true, modifiers)).toBe(0b0110_0100);
    });

    it("should return 0xFF for invalid button", () => {
        expect.assertions(1);
        expect(encodeMouseButtonByte(99 as MouseButtonType, false)).toBe(0xFF);
    });
});

describe(mouseX10Sequence, () => {
    const X10_OFFSET = 32;

    it("should generate correct X10 sequence for left click at (0,0)", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.LEFT, false);
        const x = 0;
        const y = 0;

        // Cb = 0, Cx = 1, Cy = 1 (0-indexed + 1)
        // Chars: (0+32), (0+1+32), (0+1+32) => 32, 33, 33 => ' ', '!', '!'
        expect(mouseX10Sequence(callback, x, y)).toBe(
            `${ESC}[M${String.fromCodePoint(callback + X10_OFFSET)}${String.fromCodePoint(x + 1 + X10_OFFSET)}${String.fromCodePoint(y + 1 + X10_OFFSET)}`,
        );
    });

    it("should generate correct X10 sequence for wheel up at (10,20) with shift", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.WHEEL_UP, false, { shift: true }); // 0b0100_0100 = 68
        const x = 10;
        const y = 20;

        // Cx = 11, Cy = 21
        // Chars: (68+32), (10+1+32), (20+1+32) => 100, 43, 53 => 'd', '+', '5'
        expect(mouseX10Sequence(callback, x, y)).toBe(
            `${ESC}[M${String.fromCodePoint(callback + X10_OFFSET)}${String.fromCodePoint(x + 1 + X10_OFFSET)}${String.fromCodePoint(y + 1 + X10_OFFSET)}`,
        );
    });

    it("should return empty string for invalid Cb in X10", () => {
        expect.assertions(1);
        expect(mouseX10Sequence(0xFF, 0, 0)).toBe("");
    });

    it("should generate correct X10 sequence for max coordinates (222,222)", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.LEFT, false);
        const x = 222;
        const y = 222;

        // Max coord for X10 before char issues: 255 - 1 - 32 = 222
        // Cx = 223, Cy = 223
        // Chars: (cb+32), (222+1+32), (222+1+32) => (cb+32), 255, 255
        expect(mouseX10Sequence(callback, x, y)).toBe(
            `${ESC}[M${String.fromCodePoint(callback + X10_OFFSET)}${String.fromCodePoint(x + 1 + X10_OFFSET)}${String.fromCodePoint(y + 1 + X10_OFFSET)}`,
        );
    });

    it("should generate correct X10 sequence with all modifiers", () => {
        expect.assertions(1);

        const modifiers: MouseModifiers = { alt: true, ctrl: true, shift: true };
        const callback = encodeMouseButtonByte(MouseButton.MIDDLE, true, modifiers);
        // Middle(1) + Shift(4) + Alt(8) + Ctrl(16) + Motion(32) = 61
        const x = 5;
        const y = 10;

        // Chars: (61+32), (5+1+32), (10+1+32) => 93, 38, 43 => ']', '&', '+'
        expect(mouseX10Sequence(callback, x, y)).toBe(
            `${ESC}[M${String.fromCodePoint(callback + X10_OFFSET)}${String.fromCodePoint(x + 1 + X10_OFFSET)}${String.fromCodePoint(y + 1 + X10_OFFSET)}`,
        );
    });
});

describe(mouseSgrSequence, () => {
    it("should generate correct SGR sequence for left click press at (0,0)", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.LEFT, false); // 0
        const x = 0;
        const y = 0;

        // Expect: ESC[<0;1;1M
        expect(mouseSgrSequence(callback, x, y, false)).toBe(`${ESC}[<${callback};${x + 1};${y + 1}M`);
    });

    it("should generate correct SGR sequence for right click release at (5,8)", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.RIGHT, false); // 2
        const x = 5;
        const y = 8;

        // Expect: ESC[<2;6;9m
        expect(mouseSgrSequence(callback, x, y, true)).toBe(`${ESC}[<${callback};${x + 1};${y + 1}m`);
    });

    it("should generate correct SGR sequence for motion with middle button at (15,25) with Ctrl", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.MIDDLE, true, { ctrl: true }); // Middle(1) + Ctrl(16) + Motion(32) = 49
        const x = 15;
        const y = 25;

        // Expect: ESC[<49;16;26M
        expect(mouseSgrSequence(callback, x, y, false)).toBe(`${ESC}[<${callback};${x + 1};${y + 1}M`);
    });

    it("should return empty string for invalid Cb in SGR", () => {
        expect.assertions(1);
        expect(mouseSgrSequence(0xFF, 0, 0, false)).toBe("");
    });

    it("should generate correct SGR sequence with high coordinates (e.g., 1000, 1000)", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.LEFT, false); // 0
        const x = 999;
        const y = 999; // 0-indexed, so 1000th pixel

        // Expect: ESC[<0;1000;1000M
        expect(mouseSgrSequence(callback, x, y, false)).toBe(`${ESC}[<${callback};${x + 1};${y + 1}M`);
    });

    it("should generate correct SGR sequence with all modifiers for press", () => {
        expect.assertions(1);

        const modifiers: MouseModifiers = { alt: true, ctrl: true, shift: true };
        const callback = encodeMouseButtonByte(MouseButton.RIGHT, true, modifiers);
        // Right(2) + Shift(4) + Alt(8) + Ctrl(16) + Motion(32) = 62
        const x = 10;
        const y = 20;

        // Expect: ESC[<62;11;21M
        expect(mouseSgrSequence(callback, x, y, false)).toBe(`${ESC}[<${callback};${x + 1};${y + 1}M`);
    });

    it("should generate correct SGR sequence with all modifiers for release", () => {
        expect.assertions(1);

        const modifiers: MouseModifiers = { alt: true, ctrl: true, shift: true };
        // For release, typically motion is false, but the button byte still includes modifier info.
        // Let's test with MouseButton.RELEASE (which is 0, mapped to 3 by encode function without other flags initially)
        // then add modifiers.
        // Release(3) + Shift(4) + Alt(8) + Ctrl(16) = 31
        const callback = encodeMouseButtonByte(MouseButton.RELEASE, false, modifiers);
        const x = 10;
        const y = 20;

        // Expect: ESC[<31;11;21m
        expect(mouseSgrSequence(callback, x, y, true)).toBe(`${ESC}[<${callback};${x + 1};${y + 1}m`);
    });

    it("should generate correct SGR sequence for motion during a release event (uncommon but possible)", () => {
        expect.assertions(1);

        const callback = encodeMouseButtonByte(MouseButton.LEFT, true, { alt: true }); // Left(0) + Alt(8) + Motion(32) = 40
        const x = 1;
        const y = 1;

        // Expect: ESC[<40;2;2m (note the 'm' for release)
        expect(mouseSgrSequence(callback, x, y, true)).toBe(`${ESC}[<${callback};${x + 1};${y + 1}m`);
    });
});

describe("mouse Reporting Mode Control Sequences", () => {
    it("should generate correct sequence for enableX10Mouse", () => {
        expect.assertions(1);
        expect(enableX10Mouse).toBe(`${ESC}[?9h`);
    });

    it("should generate correct sequence for disableX10Mouse", () => {
        expect.assertions(1);
        expect(disableX10Mouse).toBe(`${ESC}[?9l`);
    });

    it("should generate correct sequence for enableNormalMouse", () => {
        expect.assertions(1);
        expect(enableNormalMouse).toBe(`${ESC}[?1000h`);
    });

    it("should generate correct sequence for disableNormalMouse", () => {
        expect.assertions(1);
        expect(disableNormalMouse).toBe(`${ESC}[?1000l`);
    });

    it("should generate correct sequence for enableButtonEventMouse", () => {
        expect.assertions(1);
        expect(enableButtonEventMouse).toBe(`${ESC}[?1002h`);
    });

    it("should generate correct sequence for disableButtonEventMouse", () => {
        expect.assertions(1);
        expect(disableButtonEventMouse).toBe(`${ESC}[?1002l`);
    });

    it("should generate correct sequence for enableAnyEventMouse", () => {
        expect.assertions(1);
        expect(enableAnyEventMouse).toBe(`${ESC}[?1003h`);
    });

    it("should generate correct sequence for disableAnyEventMouse", () => {
        expect.assertions(1);
        expect(disableAnyEventMouse).toBe(`${ESC}[?1003l`);
    });

    it("should generate correct sequence for enableSgrMouse", () => {
        expect.assertions(1);
        expect(enableSgrMouse).toBe(`${ESC}[?1006h`);
    });

    it("should generate correct sequence for disableSgrMouse", () => {
        expect.assertions(1);
        expect(disableSgrMouse).toBe(`${ESC}[?1006l`);
    });

    it("should generate correct sequence for enableFocusTracking", () => {
        expect.assertions(1);
        expect(enableFocusTracking).toBe(`${ESC}[?1004h`);
    });

    it("should generate correct sequence for disableFocusTracking", () => {
        expect.assertions(1);
        expect(disableFocusTracking).toBe(`${ESC}[?1004l`);
    });
});
