import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Text } from "../../src/components/index";
import { useHotkey } from "../../src/ink/hooks/use-hotkey";
import { useInterval } from "../../src/ink/hooks/use-interval";
import { useKeyChord } from "../../src/ink/hooks/use-key-chord";
import { createFileStorage, createMemoryStorage, usePersistentState } from "../../src/ink/hooks/use-persistent-state";
import { useTimeout } from "../../src/ink/hooks/use-timeout";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

let currentUnmount: (() => void) | undefined;

const mount = (jsx: React.JSX.Element) => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { unmount } = render(jsx, { debug: true, stdin, stdout });

    currentUnmount = unmount;

    return { stdin };
};

afterEach(async () => {
    currentUnmount?.();
    currentUnmount = undefined;
    await delay(10);
});

describe(useInterval, () => {
    const Harness = ({ callback, interval }: { callback: () => void; interval: number }) => {
        useInterval(callback, interval);

        return <Text>t</Text>;
    };

    it("should fire the callback repeatedly", async () => {
        expect.assertions(1);

        const spy = vi.fn();

        mount(<Harness callback={spy} interval={15} />);
        await delay(80);

        expect(spy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("should stop when isActive flips to false", async () => {
        expect.assertions(1);

        const spy = vi.fn();

        const Wrapper = ({ active }: { active: boolean }) => {
            useInterval(spy, 10, { isActive: active });

            return <Text>t</Text>;
        };

        mount(<Wrapper active={false} />);
        await delay(60);

        expect(spy).not.toHaveBeenCalled();
    });
});

describe(useTimeout, () => {
    const Harness = ({ callback, delay: ms }: { callback: () => void; delay: number }) => {
        useTimeout(callback, ms);

        return <Text>t</Text>;
    };

    it("should fire once after the delay", async () => {
        expect.assertions(1);

        const spy = vi.fn();

        mount(<Harness callback={spy} delay={30} />);
        await delay(80);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should not fire when isActive is false", async () => {
        expect.assertions(1);

        const spy = vi.fn();

        const Wrapper = () => {
            useTimeout(spy, 20, { isActive: false });

            return <Text>t</Text>;
        };

        mount(<Wrapper />);
        await delay(60);

        expect(spy).not.toHaveBeenCalled();
    });
});

describe(useHotkey, () => {
    const Harness = ({ callback, shortcut }: { callback: () => void; shortcut: Parameters<typeof useHotkey>[0] }) => {
        useHotkey(shortcut, callback);

        return <Text>t</Text>;
    };

    it("should fire on a matching character shortcut", async () => {
        expect.assertions(1);

        const spy = vi.fn();
        const { stdin } = mount(<Harness callback={spy} shortcut="?" />);

        await delay(20);
        emitReadable(stdin, "?");
        await delay(30);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should fire on a named key shortcut", async () => {
        expect.assertions(1);

        const spy = vi.fn();
        const { stdin } = mount(<Harness callback={spy} shortcut="escape" />);

        await delay(20);
        emitReadable(stdin, "\u001B");
        await delay(30);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should not fire on unrelated input", async () => {
        expect.assertions(1);

        const spy = vi.fn();
        const { stdin } = mount(<Harness callback={spy} shortcut="q" />);

        await delay(20);
        emitReadable(stdin, "a");
        await delay(30);

        expect(spy).not.toHaveBeenCalled();
    });
});

describe(useKeyChord, () => {
    const Harness = ({ callback, resetAfter, sequence }: { callback: () => void; resetAfter?: number; sequence: ReadonlyArray<string> }) => {
        useKeyChord(sequence, callback, { resetAfter });

        return <Text>t</Text>;
    };

    it("should fire after the full sequence is typed", async () => {
        expect.assertions(1);

        const spy = vi.fn();
        const { stdin } = mount(<Harness callback={spy} sequence={["g", "d"]} />);

        await delay(20);
        emitReadable(stdin, "g");
        await delay(10);
        emitReadable(stdin, "d");
        await delay(30);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should reset on a non-matching key", async () => {
        expect.assertions(1);

        const spy = vi.fn();
        const { stdin } = mount(<Harness callback={spy} sequence={["g", "d"]} />);

        await delay(20);
        emitReadable(stdin, "g");
        await delay(10);
        emitReadable(stdin, "x");
        await delay(10);
        emitReadable(stdin, "d");
        await delay(30);

        expect(spy).not.toHaveBeenCalled();
    });

    it("should reset after the configured timeout", async () => {
        expect.assertions(1);

        const spy = vi.fn();
        const { stdin } = mount(<Harness callback={spy} resetAfter={30} sequence={["g", "d"]} />);

        await delay(20);
        emitReadable(stdin, "g");
        await delay(60);
        emitReadable(stdin, "d");
        await delay(30);

        expect(spy).not.toHaveBeenCalled();
    });
});

describe(usePersistentState, () => {
    const Harness = ({
        initial,
        onExposeSet,
        storage,
        storageKey,
    }: {
        initial: string;
        onExposeSet: (setter: (v: string) => void, read: () => string) => void;
        storage: ReturnType<typeof createMemoryStorage>;
        storageKey: string;
    }) => {
        const [value, setValue] = usePersistentState(storageKey, initial, { storage });

        onExposeSet(setValue, () => value);

        return <Text>{value}</Text>;
    };

    it("should initialise from the storage when a value is present", () => {
        expect.assertions(1);

        const storage = createMemoryStorage();

        storage.write("prefs", JSON.stringify("dark"));

        let readValue: string | undefined;

        mount(
            <Harness
                initial="light"
                onExposeSet={(_set, read) => {
                    readValue = read();
                }}
                storage={storage}
                storageKey="prefs"
            />,
        );

        expect(readValue).toBe("dark");
    });

    it("should persist new values through setValue", async () => {
        expect.assertions(1);

        const storage = createMemoryStorage();
        let setter: ((value: string) => void) | undefined;

        mount(
            <Harness
                initial="light"
                onExposeSet={(set) => {
                    setter = set;
                }}
                storage={storage}
                storageKey="prefs"
            />,
        );

        setter?.("dark");
        // Persistence runs in a post-commit effect; wait for the write to land
        // rather than racing a fixed delay (the effect can take >30ms to flush
        // on loaded CI runners).
        await vi.waitUntil(() => storage.read("prefs") !== undefined, { interval: 10, timeout: 1000 });

        expect(storage.read("prefs")).toBe(JSON.stringify("dark"));
    });

    it("should write each committed value exactly once (no write inside the updater)", async () => {
        expect.assertions(2);

        const writes: [string, string][] = [];
        const backing = createMemoryStorage();
        const storage = {
            read: backing.read,
            write: (key: string, value: string) => {
                writes.push([key, value]);
                backing.write(key, value);
            },
        };

        let setter: ((value: string) => void) | undefined;

        mount(
            <Harness
                initial="light"
                onExposeSet={(set) => {
                    setter = set;
                }}
                storage={storage}
                storageKey="prefs"
            />,
        );

        setter?.("dark");
        // Wait for the post-commit persistence effect to flush instead of
        // racing a fixed delay (the effect can take >30ms on loaded CI runners).
        await vi.waitUntil(() => writes.length > 0, { interval: 10, timeout: 1000 });

        // The committed value should be persisted exactly once. The initial
        // value matches storage (undefined -> fallback) so it is not re-written.
        expect(writes).toStrictEqual([["prefs", JSON.stringify("dark")]]);
        expect(storage.read("prefs")).toBe(JSON.stringify("dark"));
    });
});

describe(createFileStorage, () => {
    it("should reject namespaces that contain a path separator", () => {
        expect.assertions(3);

        expect(() => createFileStorage("../escape")).toThrow(/invalid namespace/);
        expect(() => createFileStorage("nested/name")).toThrow(/invalid namespace/);
        expect(() => createFileStorage("")).toThrow(/invalid namespace/);
    });

    it("should accept a plain namespace", () => {
        expect.assertions(1);

        expect(() => createFileStorage("my-app")).not.toThrow();
    });
});
