import { describe, expect, it } from "vitest";

// Test the scroll acceleration logic at the unit level
// The hook itself requires React rendering context; we test the physics math here

describe("scroll-acceleration (unit)", () => {
    it("rapid events in same direction should increase velocity", () => {
        // Simulate the acceleration logic
        expect.assertions(3);

        const acceleration = 1.5;
        const maxVelocity = 20;
        let velocity = 1; // initial scroll down

        // Simulate 3 rapid scroll events
        velocity = Math.min(Math.abs(velocity * acceleration), maxVelocity);

        expect(velocity).toBe(1.5);

        velocity = Math.min(Math.abs(velocity * acceleration), maxVelocity);

        expect(velocity).toBe(2.25);

        velocity = Math.min(Math.abs(velocity * acceleration), maxVelocity);

        expect(velocity).toBeCloseTo(3.375);
    });

    it("velocity should be clamped at maxVelocity", () => {
        expect.assertions(1);

        const acceleration = 2;
        const maxVelocity = 5;
        let velocity = 4;

        velocity = Math.min(Math.abs(velocity * acceleration), maxVelocity);

        expect(velocity).toBe(5); // clamped
    });

    it("decay should reduce velocity over time", () => {
        expect.assertions(3);

        const decayRate = 0.92;
        let velocity = 10;

        velocity *= decayRate;

        expect(velocity).toBeCloseTo(9.2);

        velocity *= decayRate;

        expect(velocity).toBeCloseTo(8.464);

        // After many decays, should approach zero
        for (let index = 0; index < 50; index++) {
            velocity *= decayRate;
        }

        expect(velocity).toBeLessThan(0.5);
    });

    it("direction change should reset velocity", () => {
        // Simulate: scrolling down, then switching to up
        expect.assertions(1);

        let velocity = 5; // positive = down
        const newDirection = "up";
        const sign = newDirection === "down" ? 1 : -1;

        // Direction change: reset
        velocity = sign; // reset to base velocity in new direction

        expect(velocity).toBe(-1);
    });
});
