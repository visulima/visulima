import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import url from "node:url";

import { strip as stripAnsi } from "@visulima/ansi";
import delay from "delay";
import React, { act, startTransition, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, Text, useAnimation } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import mockTimerCalls from "../helpers/mock-timer-calls";

const _request = createRequire(import.meta.url);
const ptyAvailable = (() => {
    try {
        _request("node-pty");

        return true;
    } catch {
        return false;
    }
})();

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const AnimatedCounter = ({ interval }: { readonly interval?: number }) => {
    const { frame } = useAnimation({ interval });

    return <Text>{String(frame)}</Text>;
};

const ConditionalAnimation = ({ interval, isActive }: { readonly interval?: number; readonly isActive: boolean }) => {
    const { frame } = useAnimation({ interval, isActive });

    return <Text>{String(frame)}</Text>;
};

describe(useAnimation, () => {
    it("frame increments over time", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const { unmount } = render(<AnimatedCounter interval={50} />, {
            debug: true,
            stdout,
        });

        await delay(20);

        expect(stdout.get()).toBe("0");

        await delay(80);
        const frame = Number.parseInt(stdout.get(), 10);

        expect(frame).toBeGreaterThanOrEqual(1);

        unmount();
    });

    it("does not update when isActive is false", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const { unmount } = render(<ConditionalAnimation interval={50} isActive={false} />, {
            debug: true,
            stdout,
        });

        await delay(20);

        expect(stdout.get()).toBe("0");

        await delay(120);

        expect(stdout.get()).toBe("0");

        unmount();
    });

    it("multiple animations with the same interval stay in sync", async () => {
        expect.assertions(3);

        const MultiSpinner = () => {
            const { frame: frame1 } = useAnimation({ interval: 50 });
            const { frame: frame2 } = useAnimation({ interval: 50 });

            return (
                <Text>
                    {String(frame1)},{String(frame2)}
                </Text>
            );
        };

        const stdout = createStdout();
        const { unmount } = render(<MultiSpinner />, {
            debug: true,
            stdout,
        });

        await delay(20);

        expect(stdout.get()).toBe("0,0");

        await delay(100);
        const output = stdout.get();
        const [a, b] = output.split(",").map(Number);

        // Both frames should be equal since they use the same interval.
        expect(a).toBe(b);
        expect(a!).toBeGreaterThanOrEqual(1);

        unmount();
    });

    describe("shared timer", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("multiple animations with the same interval share one timer", async () => {
            expect.assertions(4);

            const mocks = mockTimerCalls();

            try {
                const MultiSpinner = () => {
                    const { frame: frame1 } = useAnimation({ interval: 50 });
                    const { frame: frame2 } = useAnimation({ interval: 50 });

                    return (
                        <Text>
                            {String(frame1)},{String(frame2)}
                        </Text>
                    );
                };

                const stdout = createStdout();
                const { unmount } = render(<MultiSpinner />, {
                    debug: true,
                    stdout,
                });

                expect(mocks.setTimeoutCallCount).toBeGreaterThanOrEqual(1);
                expect(mocks.timeoutDelays.every((d) => d === 50)).toBe(true);

                await vi.advanceTimersByTimeAsync(100);
                const output = stdout.get();
                const [frame1, frame2] = output.split(",").map(Number);

                expect(frame1).toBe(frame2);
                expect(frame1!).toBeGreaterThanOrEqual(1);

                unmount();
            } finally {
                mocks.restore();
            }
        });

        it("animations with different intervals still use the shared timer", async () => {
            expect.assertions(2);

            const mocks = mockTimerCalls();

            try {
                const MultiSpinner = () => {
                    const { frame: fastFrame } = useAnimation({ interval: 50 });
                    const { frame: slowFrame } = useAnimation({ interval: 80 });

                    return (
                        <Text>
                            {String(fastFrame)},{String(slowFrame)}
                        </Text>
                    );
                };

                const stdout = createStdout();
                const { unmount } = render(<MultiSpinner />, {
                    debug: true,
                    stdout,
                });

                expect(mocks.timeoutDelays.every((d) => d >= 50)).toBe(true);

                await vi.advanceTimersByTimeAsync(170);
                const output = stdout.get();
                const [fastFrame, slowFrame] = output.split(",").map(Number);

                expect(fastFrame!).toBeGreaterThan(slowFrame!);

                unmount();
            } finally {
                mocks.restore();
            }
        });

        it("shared timer is cleaned up and recreated after the last animation unmounts", async () => {
            expect.assertions(5);

            const mocks = mockTimerCalls();

            try {
                const stdout = createStdout();
                const firstRender = render(<AnimatedCounter interval={50} />, {
                    debug: true,
                    stdout,
                });

                expect(mocks.setTimeoutCallCount).toBeGreaterThanOrEqual(1);

                firstRender.unmount();

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(1);

                const secondRender = render(<AnimatedCounter interval={50} />, {
                    debug: true,
                    stdout,
                });

                expect(mocks.setTimeoutCallCount).toBe(2);

                await vi.advanceTimersByTimeAsync(120);

                expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

                secondRender.unmount();

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(2);
            } finally {
                mocks.restore();
            }
        });

        it("shared timer stays alive while another same-interval animation remains mounted", async () => {
            expect.assertions(6);

            const mocks = mockTimerCalls();

            try {
                const AnimationValue = () => {
                    const { frame } = useAnimation({ interval: 50 });

                    return <Text>{String(frame)}</Text>;
                };

                const MaybeDualAnimation = ({ showSecond }: { readonly showSecond: boolean }) => (
                    <>
                        <AnimationValue />
                        {showSecond ? <Text>,</Text> : undefined}
                        {showSecond ? <AnimationValue /> : undefined}
                    </>
                );

                const stdout = createStdout();
                const { rerender, unmount } = render(<MaybeDualAnimation showSecond />, {
                    debug: true,
                    stdout,
                });

                expect(mocks.setTimeoutCallCount).toBeGreaterThanOrEqual(1);

                await vi.advanceTimersByTimeAsync(120);
                const frameBeforeUnmount = Number.parseInt(stdout.get().split(",")[0]!, 10);

                expect(frameBeforeUnmount).toBeGreaterThanOrEqual(1);

                rerender(<MaybeDualAnimation showSecond={false} />);

                expect(mocks.setTimeoutCallCount).toBeGreaterThanOrEqual(1);
                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(1);

                await vi.advanceTimersByTimeAsync(120);
                const frameAfterUnmount = Number.parseInt(stdout.get(), 10);

                expect(frameAfterUnmount).toBeGreaterThan(frameBeforeUnmount);

                unmount();

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(2);
            } finally {
                mocks.restore();
            }
        });

        it("shared timer stays alive while another different-interval animation remains mounted", async () => {
            expect.assertions(6);

            const mocks = mockTimerCalls();

            try {
                const AnimationValue = ({ interval }: { readonly interval: number }) => {
                    const { frame } = useAnimation({ interval });

                    return <Text>{String(frame)}</Text>;
                };

                const MaybeDualAnimation = ({ showSecond }: { readonly showSecond: boolean }) => (
                    <>
                        <AnimationValue interval={50} />
                        {showSecond ? <Text>,</Text> : undefined}
                        {showSecond ? <AnimationValue interval={80} /> : undefined}
                    </>
                );

                const stdout = createStdout();
                const { rerender, unmount } = render(<MaybeDualAnimation showSecond />, {
                    debug: true,
                    stdout,
                });

                expect(mocks.setTimeoutCallCount).toBeGreaterThanOrEqual(1);

                await vi.advanceTimersByTimeAsync(120);
                const frameBeforeUnmount = Number.parseInt(stdout.get().split(",")[0]!, 10);

                expect(frameBeforeUnmount).toBeGreaterThanOrEqual(1);

                rerender(<MaybeDualAnimation showSecond={false} />);

                expect(mocks.setTimeoutCallCount).toBeGreaterThanOrEqual(1);
                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(1);

                await vi.advanceTimersByTimeAsync(120);
                const frameAfterUnmount = Number.parseInt(stdout.get(), 10);

                expect(frameAfterUnmount).toBeGreaterThan(frameBeforeUnmount);

                unmount();

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(2);
            } finally {
                mocks.restore();
            }
        });

        it("inactive animations do not start the shared timer until one becomes active", async () => {
            expect.assertions(6);

            const mocks = mockTimerCalls();

            try {
                const MaybeActiveAnimations = ({ isFirstActive, isSecondActive }: { readonly isFirstActive: boolean; readonly isSecondActive: boolean }) => {
                    const { frame: firstFrame } = useAnimation({
                        interval: 50,
                        isActive: isFirstActive,
                    });
                    const { frame: secondFrame } = useAnimation({
                        interval: 50,
                        isActive: isSecondActive,
                    });

                    return (
                        <Text>
                            {String(firstFrame)},{String(secondFrame)}
                        </Text>
                    );
                };

                const stdout = createStdout();
                const { rerender, unmount } = render(<MaybeActiveAnimations isFirstActive={false} isSecondActive={false} />, {
                    debug: true,
                    stdout,
                });

                expect(mocks.setTimeoutCallCount).toBe(0);

                await vi.advanceTimersByTimeAsync(100);

                expect(stdout.get()).toBe("0,0");

                rerender(<MaybeActiveAnimations isFirstActive isSecondActive={false} />);

                expect(mocks.setTimeoutCallCount).toBe(1);

                await vi.advanceTimersByTimeAsync(120);
                const [firstFrame, secondFrame] = stdout.get().split(",").map(Number);

                expect(firstFrame!).toBeGreaterThanOrEqual(1);
                expect(secondFrame).toBe(0);

                unmount();

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(1);
            } finally {
                mocks.restore();
            }
        });

        it("no timer leak when all animations are inactive", async () => {
            expect.assertions(5);

            const mocks = mockTimerCalls();

            try {
                const stdout = createStdout();

                // Mount with isActive=false - no timer should start
                const { rerender, unmount } = render(<ConditionalAnimation interval={50} isActive={false} />, { debug: true, stdout });

                expect(mocks.setTimeoutCallCount).toBe(0);

                // Activate - timer should start
                rerender(<ConditionalAnimation interval={50} isActive />);

                expect(mocks.setTimeoutCallCount).toBe(1);

                await vi.advanceTimersByTimeAsync(120);

                expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

                // Deactivate - subscriber unsubscribes, timer should be cleaned up
                rerender(<ConditionalAnimation interval={50} isActive={false} />);

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(1);

                // Unmount - timer should already be gone
                unmount();

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(1);
            } finally {
                mocks.restore();
            }
        });

        it("frame catches up when the shared timer is delayed", async () => {
            expect.assertions(1);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={50} />, {
                debug: true,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(220);

            expect(stdout.get()).toBe("4");

            unmount();
        });

        it("isActive false from mount never starts a timer or advances the frame", async () => {
            expect.assertions(5);

            const mocks = mockTimerCalls();

            try {
                const stdout = createStdout();
                const { unmount } = render(<ConditionalAnimation interval={50} isActive={false} />, { debug: true, stdout });

                expect(mocks.setTimeoutCallCount).toBe(0);
                expect(stdout.get()).toBe("0");

                await vi.advanceTimersByTimeAsync(500);

                expect(mocks.setTimeoutCallCount).toBe(0);
                expect(stdout.get()).toBe("0");

                unmount();

                expect(mocks.clearTimeoutCallCount).toBe(0);
            } finally {
                mocks.restore();
            }
        });

        it("pausing animation stops ticks before the next frame", async () => {
            expect.assertions(3);

            const stdout = createStdout();
            const { rerender, unmount } = render(<ConditionalAnimation interval={8} isActive />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(25);

            const pausedFrame = Number.parseInt(stdout.get(), 10);

            expect(pausedFrame).toBeGreaterThanOrEqual(1);

            rerender(<ConditionalAnimation interval={8} isActive={false} />);

            expect(stdout.get()).toBe(String(pausedFrame));

            await vi.advanceTimersByTimeAsync(25);

            expect(stdout.get()).toBe(String(pausedFrame));

            unmount();
        });

        it("changing interval unsubscribes stale ticks before reset", async () => {
            expect.assertions(3);

            const DynamicInterval = ({ interval }: { readonly interval: number }) => {
                const { frame } = useAnimation({ interval });

                return <Text>{String(frame)}</Text>;
            };

            const stdout = createStdout();
            const { rerender, unmount } = render(<DynamicInterval interval={8} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(25);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            rerender(<DynamicInterval interval={200} />);

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(17);

            expect(stdout.get()).toBe("0");

            unmount();
        });

        it("wall clock changes do not move animations backwards", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={8} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(25);

            const frameBeforeClockJump = Number.parseInt(stdout.get(), 10);

            expect(frameBeforeClockJump).toBeGreaterThanOrEqual(1);

            await vi.advanceTimersByTimeAsync(25);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(frameBeforeClockJump);

            unmount();
        });

        it("animations advance in debug mode when interactive is false", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={8} />, {
                debug: true,
                interactive: false,
                maxFps: 120,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(25);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            unmount();
        });

        it("newly mounted animations do not inherit elapsed time", async () => {
            expect.assertions(4);

            const AnimationValue = ({ interval }: { readonly interval: number }) => {
                const { frame } = useAnimation({ interval });

                return <Text>{String(frame)}</Text>;
            };

            const DelayedDualAnimation = () => {
                const [showSecond, setShowSecond] = React.useState(false);

                React.useEffect(() => {
                    const timer = setTimeout(() => {
                        setShowSecond(true);
                    }, 20);

                    return () => {
                        clearTimeout(timer);
                    };
                }, []);

                return (
                    <>
                        <AnimationValue interval={20} />
                        <Text>,</Text>
                        {showSecond ? <AnimationValue interval={20} /> : <Text>-</Text>}
                    </>
                );
            };

            const stdout = createStdout();
            const { unmount } = render(<DelayedDualAnimation />, {
                debug: true,
                stdout,
            });

            const getOutput = () => stdout.get().replaceAll("\n", "");

            await vi.advanceTimersByTimeAsync(25);

            expect(getOutput()).toBe("1,0");

            await vi.advanceTimersByTimeAsync(40);

            const [firstFrame, secondFrame] = getOutput().split(",").map(Number);

            expect(firstFrame).toBeGreaterThanOrEqual(2);
            expect(secondFrame).toBeGreaterThanOrEqual(1);
            expect(firstFrame! - secondFrame!).toBe(1);

            unmount();
        });

        it("newly activated animations do not inherit elapsed time", async () => {
            expect.assertions(4);

            const AnimationValue = ({ interval, isActive = true }: { readonly interval: number; readonly isActive?: boolean }) => {
                const { frame } = useAnimation({ interval, isActive });

                return <Text>{String(frame)}</Text>;
            };

            const DelayedActivationAnimation = () => {
                const [isSecondActive, setIsSecondActive] = React.useState(false);

                React.useEffect(() => {
                    const timer = setTimeout(() => {
                        setIsSecondActive(true);
                    }, 20);

                    return () => {
                        clearTimeout(timer);
                    };
                }, []);

                return (
                    <>
                        <AnimationValue interval={20} />
                        <Text>,</Text>
                        <AnimationValue interval={20} isActive={isSecondActive} />
                    </>
                );
            };

            const stdout = createStdout();
            const { unmount } = render(<DelayedActivationAnimation />, {
                debug: true,
                stdout,
            });

            const getOutput = () => stdout.get().replaceAll("\n", "");

            await vi.advanceTimersByTimeAsync(25);

            expect(getOutput()).toBe("1,0");

            await vi.advanceTimersByTimeAsync(40);

            const [firstFrame, secondFrame] = getOutput().split(",").map(Number);

            expect(firstFrame).toBeGreaterThanOrEqual(2);
            expect(secondFrame).toBeGreaterThanOrEqual(1);
            expect(firstFrame! - secondFrame!).toBe(1);

            unmount();
        });

        it("rerendering with the same interval does not reset the frame", async () => {
            expect.assertions(2);

            const DynamicInterval = ({ interval }: { readonly interval: number }) => {
                const { frame } = useAnimation({ interval });

                return <Text>{String(frame)}</Text>;
            };

            const stdout = createStdout();
            const { rerender, unmount } = render(<DynamicInterval interval={20} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(50);

            const frameBeforeRerender = Number.parseInt(stdout.get(), 10);

            expect(frameBeforeRerender).toBeGreaterThanOrEqual(1);

            rerender(<DynamicInterval interval={20} />);

            expect(stdout.get()).toBe(String(frameBeforeRerender));

            unmount();
        });

        it("frame resets to 0 on each resume across multiple cycles", async () => {
            expect.assertions(6);

            const stdout = createStdout();
            const { rerender, unmount } = render(<ConditionalAnimation interval={50} isActive />, { debug: true, maxFps: 120, stdout });

            // Cycle 1
            await vi.advanceTimersByTimeAsync(120);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            rerender(<ConditionalAnimation interval={50} isActive={false} />);
            rerender(<ConditionalAnimation interval={50} isActive />);

            expect(stdout.get()).toBe("0");

            // Cycle 2
            await vi.advanceTimersByTimeAsync(120);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            rerender(<ConditionalAnimation interval={50} isActive={false} />);
            rerender(<ConditionalAnimation interval={50} isActive />);

            expect(stdout.get()).toBe("0");

            // Cycle 3
            await vi.advanceTimersByTimeAsync(120);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            rerender(<ConditionalAnimation interval={50} isActive={false} />);
            rerender(<ConditionalAnimation interval={50} isActive />);

            expect(stdout.get()).toBe("0");

            unmount();
        });

        it("unmount before first tick cleans up without error", async () => {
            expect.assertions(4);

            const mocks = mockTimerCalls();

            try {
                const stdout = createStdout();
                const { unmount } = render(<AnimatedCounter interval={50} />, {
                    debug: true,
                    stdout,
                });

                expect(stdout.get()).toBe("0");
                expect(mocks.setTimeoutCallCount).toBeGreaterThanOrEqual(1);

                // Unmount before any tick fires
                unmount();

                expect(mocks.clearTimeoutCallCount).toBeGreaterThanOrEqual(1);

                // Confirm no animation ticks fire after unmount
                const writeCountAfterUnmount = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.length;

                await vi.advanceTimersByTimeAsync(200);

                expect(stdout.write as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(writeCountAfterUnmount);
            } finally {
                mocks.restore();
            }
        });

        it("defaults to 100ms interval", async () => {
            expect.assertions(2);

            const DefaultInterval = () => {
                const { frame } = useAnimation();

                return <Text>{String(frame)}</Text>;
            };

            const stdout = createStdout();
            const { unmount } = render(<DefaultInterval />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(250);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            unmount();
        });

        it("treats NaN interval as the default interval", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={Number.NaN} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(250);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            unmount();
        });

        it("treats Infinity interval as the default interval", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={Number.POSITIVE_INFINITY} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(250);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            unmount();
        });

        it("treats negative Infinity interval as the default interval", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={Number.NEGATIVE_INFINITY} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(250);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            unmount();
        });

        it("clamps oversized finite interval to the timer maximum", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={Number.MAX_SAFE_INTEGER} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(1000);

            expect(stdout.get()).toBe("0");

            unmount();
        });

        it("clamps zero interval to 1ms", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={0} />, {
                debug: true,
                maxFps: 1000,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(5);

            expect(stdout.get()).toBe("5");

            unmount();
        });

        it("clamps negative interval to 1ms", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={-10} />, {
                debug: true,
                maxFps: 1000,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(5);

            expect(stdout.get()).toBe("5");

            unmount();
        });

        it("maxFps does not speed up animation state", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={8} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(25);

            expect(stdout.get()).toBe("3");

            unmount();
        });

        it("maxFps 0 does not affect animation cadence", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const { unmount } = render(<AnimatedCounter interval={8} />, {
                debug: true,
                maxFps: 0,
                stdout,
            });

            expect(stdout.get()).toBe("0");

            await vi.advanceTimersByTimeAsync(25);

            expect(stdout.get()).toBe("3");

            unmount();
        });

        it("time and delta reset to 0 when interval changes", async () => {
            expect.assertions(3);

            const DynamicInterval = ({ interval }: { readonly interval: number }) => {
                const { delta, frame, time } = useAnimation({ interval });

                return (
                    <Text>
                        {String(frame)},{String(Math.round(time))},{String(Math.round(delta))}
                    </Text>
                );
            };

            const stdout = createStdout();
            const { rerender, unmount } = render(<DynamicInterval interval={50} />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(200);
            const [frameBefore, timeBefore] = stdout.get().split(",").map(Number);

            expect(frameBefore!).toBeGreaterThanOrEqual(1);
            expect(timeBefore!).toBeGreaterThanOrEqual(50);

            // Changing interval should reset frame, time, and delta to 0
            rerender(<DynamicInterval interval={200} />);

            expect(stdout.get()).toBe("0,0,0");

            unmount();
        });

        it("time and delta reset to 0 when animation is resumed", async () => {
            expect.assertions(3);

            const ConditionalDisplay = ({ isActive }: { readonly isActive: boolean }) => {
                const { delta, frame, time } = useAnimation({ interval: 50, isActive });

                return (
                    <Text>
                        {String(frame)},{String(Math.round(time))},{String(Math.round(delta))}
                    </Text>
                );
            };

            const stdout = createStdout();
            const { rerender, unmount } = render(<ConditionalDisplay isActive />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(200);
            const [frameBefore, timeBefore] = stdout.get().split(",").map(Number);

            expect(frameBefore!).toBeGreaterThanOrEqual(1);
            expect(timeBefore!).toBeGreaterThanOrEqual(50);

            // Pause then resume - frame, time, and delta should all reset to 0
            rerender(<ConditionalDisplay isActive={false} />);
            rerender(<ConditionalDisplay isActive />);

            expect(stdout.get()).toBe("0,0,0");

            unmount();
        });

        it("reset() resets frame, time, and delta to 0", async () => {
            expect.assertions(7);

            let resetAnimation!: () => void;

            const ResettableAnimation = () => {
                const { delta, frame, reset, time } = useAnimation({ interval: 50 });

                resetAnimation = reset;

                return (
                    <Text>
                        {String(frame)},{String(Math.round(time))},{String(Math.round(delta))}
                    </Text>
                );
            };

            const stdout = createStdout();
            const { unmount } = render(<ResettableAnimation />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            await vi.advanceTimersByTimeAsync(200);
            const [frameBefore, timeBefore] = stdout.get().split(",").map(Number);

            expect(frameBefore!).toBeGreaterThanOrEqual(1);
            expect(timeBefore!).toBeGreaterThanOrEqual(100);

            resetAnimation();

            // Let React flush the state update from reset()
            await vi.advanceTimersByTimeAsync(1);

            expect(stdout.get()).toBe("0,0,0");

            // Confirm it advances again after reset
            await vi.advanceTimersByTimeAsync(100);
            const [frameAfter, timeAfter, deltaAfter] = stdout.get().split(",").map(Number);

            expect(frameAfter!).toBeGreaterThanOrEqual(1);
            expect(timeAfter!).toBeGreaterThanOrEqual(50);
            expect(deltaAfter!).toBeGreaterThanOrEqual(50);
            // Time should be much less than before reset
            expect(timeAfter!).toBeLessThan(timeBefore!);

            unmount();
        });

        it("reset() while paused takes effect when animation is resumed", async () => {
            expect.assertions(4);

            let resetAnimation!: () => void;

            const PausableAnimation = ({ isActive }: { readonly isActive: boolean }) => {
                const { frame, reset } = useAnimation({ interval: 50, isActive });

                resetAnimation = reset;

                return <Text>{String(frame)}</Text>;
            };

            const stdout = createStdout();
            const { rerender, unmount } = render(<PausableAnimation isActive />, {
                debug: true,
                maxFps: 120,
                stdout,
            });

            // Let a few frames accumulate
            await vi.advanceTimersByTimeAsync(200);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            // Pause the animation
            rerender(<PausableAnimation isActive={false} />);

            // Call reset while paused
            resetAnimation();
            await vi.advanceTimersByTimeAsync(1);

            expect(stdout.get()).not.toBe("-1");

            // Resume - the pending reset should now take effect and frame should be 0
            rerender(<PausableAnimation isActive />);

            expect(stdout.get()).toBe("0");

            // And then advance again to confirm animation restarts cleanly
            await vi.advanceTimersByTimeAsync(100);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);

            unmount();
        });

        it("low maxFps caps animation rerenders", async () => {
            expect.assertions(3);

            let renderCount = 0;

            const RenderCountingAnimation = () => {
                renderCount++;
                const { frame } = useAnimation({ interval: 10 });

                return <Text>{String(frame)}</Text>;
            };

            const stdout = createStdout();
            const { unmount } = render(<RenderCountingAnimation />, {
                maxFps: 1,
                stdout,
            });

            expect(renderCount).toBe(1);

            await vi.advanceTimersByTimeAsync(35);

            expect(renderCount).toBe(1);

            await vi.advanceTimersByTimeAsync(1000);

            expect(renderCount).toBeGreaterThanOrEqual(2);

            unmount();
        });
    });

    it("concurrent aborted renders do not suppress interval reset", async () => {
        expect.assertions(4);

        let resolveSuspense!: () => void;
        const suspendedRender = new Promise<void>((resolve) => {
            resolveSuspense = resolve;
        });

        const MaybeSuspendingAnimation = ({ interval, shouldSuspend }: { readonly interval: number; readonly shouldSuspend: boolean }) => {
            const { frame } = useAnimation({ interval });

            if (shouldSuspend) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw suspendedRender;
            }

            return <Text>{String(frame)}</Text>;
        };

        const stdout = createStdout();
        let instance: ReturnType<typeof render> | undefined;

        try {
            await act(async () => {
                instance = render(
                    <Suspense fallback={<Text>loading</Text>}>
                        <MaybeSuspendingAnimation interval={50} shouldSuspend={false} />
                    </Suspense>,
                    { concurrent: true, debug: true, stdout },
                );
            });

            await delay(130);

            const frameBefore = Number.parseInt(stdout.get(), 10);

            expect(frameBefore).toBeGreaterThanOrEqual(1);

            await act(async () => {
                instance!.rerender(
                    <Suspense fallback={<Text>loading</Text>}>
                        <MaybeSuspendingAnimation interval={200} shouldSuspend />
                    </Suspense>,
                );
            });

            expect(stdout.get()).toBe("loading");

            await act(async () => {
                instance!.rerender(
                    <Suspense fallback={<Text>loading</Text>}>
                        <MaybeSuspendingAnimation interval={200} shouldSuspend={false} />
                    </Suspense>,
                );
            });

            expect(stdout.get()).toBe("0");

            await delay(260);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThanOrEqual(1);
        } finally {
            resolveSuspense();
            instance?.unmount();
        }
    });

    it("suspended transitions do not reset the committed animation before commit", async () => {
        expect.assertions(3);

        let resolveSuspense!: () => void;
        const suspendedRender = new Promise<void>((resolve) => {
            resolveSuspense = resolve;
        });
        let suspendWithNewInterval!: () => void;

        const MaybeSuspendingAnimation = ({ interval, shouldSuspend }: { readonly interval: number; readonly shouldSuspend: boolean }) => {
            const { frame } = useAnimation({ interval });

            if (shouldSuspend) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw suspendedRender;
            }

            return <Text>{String(frame)}</Text>;
        };

        const TestCase = () => {
            const [interval, setInterval] = React.useState(50);
            const [shouldSuspend, setShouldSuspend] = React.useState(false);

            suspendWithNewInterval = () => {
                startTransition(() => {
                    setInterval(200);
                    setShouldSuspend(true);
                });
            };

            return (
                <Suspense fallback={<Text>loading</Text>}>
                    <MaybeSuspendingAnimation interval={interval} shouldSuspend={shouldSuspend} />
                </Suspense>
            );
        };

        const stdout = createStdout();
        let instance: ReturnType<typeof render> | undefined;

        try {
            instance = render(<TestCase />, {
                concurrent: true,
                debug: true,
                stdout,
            });

            await delay(130);
            const frameBeforeSuspend = Number.parseInt(stdout.get(), 10);

            expect(frameBeforeSuspend).toBeGreaterThanOrEqual(1);

            await act(async () => {
                suspendWithNewInterval();
            });

            expect(stdout.get()).toBe(String(frameBeforeSuspend));

            await delay(120);

            expect(Number.parseInt(stdout.get(), 10)).toBeGreaterThan(frameBeforeSuspend);
        } finally {
            resolveSuspense();
            instance?.unmount();
        }
    });

    it("cleans up on unmount", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const { unmount } = render(<AnimatedCounter interval={50} />, {
            debug: true,
            stdout,
        });

        await delay(80);
        unmount();

        const outputAfterUnmount = stdout.get();

        await delay(120);

        // No new writes should happen after unmount
        expect(stdout.get()).toBe(outputAfterUnmount);
    });

    it("resets frame when isActive toggles from false to true", async () => {
        expect.assertions(3);

        const stdout = createStdout();
        const { rerender, unmount } = render(<ConditionalAnimation interval={50} isActive />, { debug: true, stdout });

        await delay(130);
        const frameBeforePause = Number.parseInt(stdout.get(), 10);

        expect(frameBeforePause).toBeGreaterThanOrEqual(1);

        // Pause
        rerender(<ConditionalAnimation interval={50} isActive={false} />);
        await delay(50);

        // Resume - frame should reset to 0
        rerender(<ConditionalAnimation interval={50} isActive />);

        expect(stdout.get()).toBe("0");

        // Should start incrementing again
        await delay(120);
        const frameAfterResume = Number.parseInt(stdout.get(), 10);

        expect(frameAfterResume).toBeGreaterThanOrEqual(1);

        unmount();
    });

    it("resets frame when interval changes", async () => {
        expect.assertions(2);

        const DynamicInterval = ({ interval }: { readonly interval: number }) => {
            const { frame } = useAnimation({ interval });

            return <Text>{String(frame)}</Text>;
        };

        const stdout = createStdout();
        const { rerender, unmount } = render(<DynamicInterval interval={50} />, {
            debug: true,
            stdout,
        });

        await delay(130);
        const frameBefore = Number.parseInt(stdout.get(), 10);

        expect(frameBefore).toBeGreaterThanOrEqual(1);

        // Change interval - frame should reset to 0
        rerender(<DynamicInterval interval={200} />);

        expect(stdout.get()).toBe("0");

        unmount();
    });

    it("different intervals advance at different rates", async () => {
        expect.assertions(1);

        const DualAnimation = () => {
            const { frame: fast } = useAnimation({ interval: 50 });
            const { frame: slow } = useAnimation({ interval: 200 });

            return (
                <Text>
                    {String(fast)},{String(slow)}
                </Text>
            );
        };

        const stdout = createStdout();
        const { unmount } = render(<DualAnimation />, {
            debug: true,
            stdout,
        });

        await delay(300);
        const output = stdout.get();
        const [fast, slow] = output.split(",").map(Number);

        expect(fast!).toBeGreaterThan(slow!);

        unmount();
    });

    it("time increases with each tick", async () => {
        expect.assertions(3);

        const TimeDisplay = () => {
            const { time } = useAnimation({ interval: 50 });

            return <Text>{String(Math.round(time))}</Text>;
        };

        const stdout = createStdout();
        const { unmount } = render(<TimeDisplay />, { debug: true, stdout });

        expect(stdout.get()).toBe("0");

        await delay(80);
        const timeAfterOne = Number.parseInt(stdout.get(), 10);

        expect(timeAfterOne).toBeGreaterThanOrEqual(50);

        await delay(80);
        const timeAfterTwo = Number.parseInt(stdout.get(), 10);

        expect(timeAfterTwo).toBeGreaterThan(timeAfterOne);

        unmount();
    });

    it("delta approximates interval on each tick", async () => {
        expect.assertions(3);

        const DeltaDisplay = () => {
            const { delta } = useAnimation({ interval: 50 });

            return <Text>{String(Math.round(delta))}</Text>;
        };

        const stdout = createStdout();
        const { unmount } = render(<DeltaDisplay />, { debug: true, stdout });

        expect(stdout.get()).toBe("0");

        await delay(80);
        const deltaAfterFirst = Number.parseInt(stdout.get(), 10);

        // First delta should approximate the interval (allow small jitter)
        expect(deltaAfterFirst).toBeGreaterThanOrEqual(40);

        await delay(80);
        const deltaAfterSecond = Number.parseInt(stdout.get(), 10);

        // Subsequent deltas should also approximate the interval (allow small jitter)
        expect(deltaAfterSecond).toBeGreaterThanOrEqual(40);

        unmount();
    });

    it("delta accounts for throttled ticks", async () => {
        expect.assertions(2);

        let lastRenderedDelta = 0;

        const DeltaCapture = () => {
            const { delta } = useAnimation({ interval: 20 });

            // Captured in the render phase so we can verify the coalesced delta
            // value regardless of when Ink throttles its stdout write.
            lastRenderedDelta = delta;

            return <Text>x</Text>;
        };

        // Deliberately no debug: true - that forces renderThrottleMs = 0 and
        // would prevent the throttle code path from activating.
        // maxFps: 5 -> renderThrottleMs = 200ms.
        const stdout = createStdout();
        const { unmount } = render(<DeltaCapture />, { maxFps: 5, stdout });

        expect(lastRenderedDelta).toBe(0);

        // Wait well past one full 200ms throttle window.
        await delay(350);

        expect(lastRenderedDelta).toBeGreaterThanOrEqual(150);

        unmount();
    });

    it("reset is a stable function reference", () => {
        expect.assertions(2);

        const resets: (() => void)[] = [];

        const ResettableAnimation = () => {
            const { reset } = useAnimation({ interval: 50 });

            resets.push(reset);

            return <Text>x</Text>;
        };

        const stdout = createStdout();
        const { rerender, unmount } = render(<ResettableAnimation />, {
            debug: true,
            stdout,
        });

        rerender(<ResettableAnimation />);
        rerender(<ResettableAnimation />);

        expect(resets.length).toBeGreaterThanOrEqual(2);
        expect(resets[0]).toBe(resets.at(-1));

        unmount();
    });

    describe("non-interactive process exit", () => {
        it.skipIf(!ptyAvailable)("useAnimation can drive non-interactive process exit", async () => {
            expect.assertions(2);

            const { spawn: spawnProcess } = await import("node:child_process");

            const fixtureProcess = spawnProcess("node", ["--import=tsx", join(__dirname, "./fixtures/use-animation-non-interactive-exit.tsx")], {
                env: {
                    ...(process.env as Record<string, string>),
                    CI: "false",
                    NODE_NO_WARNINGS: "1",
                },
                stdio: ["ignore", "pipe", "pipe"],
            });

            let output = "";

            fixtureProcess.stdout.on("data", (data: Uint8Array | string) => {
                output += typeof data === "string" ? data : data.toString();
            });

            const exitCode = await new Promise<number>((resolve, reject) => {
                fixtureProcess.on("error", reject);
                fixtureProcess.on("close", (code) => {
                    resolve(code ?? 0);
                });
            });

            expect(exitCode).toBe(0);
            expect(stripAnsi(output)).toContain("exited");
        });

        it.skipIf(!ptyAvailable)("useAnimation can drive explicitly non-interactive process exit", async () => {
            expect.assertions(2);

            const { spawn: spawnProcess } = await import("node:child_process");

            const fixtureProcess = spawnProcess("node", ["--import=tsx", join(__dirname, "./fixtures/use-animation-interactive-false-exit.tsx")], {
                env: {
                    ...(process.env as Record<string, string>),
                    CI: "false",
                    NODE_NO_WARNINGS: "1",
                },
                stdio: ["ignore", "pipe", "pipe"],
            });

            let output = "";

            fixtureProcess.stdout.on("data", (data: Uint8Array | string) => {
                output += typeof data === "string" ? data : data.toString();
            });

            const exitCode = await new Promise<number>((resolve, reject) => {
                fixtureProcess.on("error", reject);
                fixtureProcess.on("close", (code) => {
                    resolve(code ?? 0);
                });
            });

            expect(exitCode).toBe(0);
            expect(stripAnsi(output)).toContain("exited");
        });
    });
});
