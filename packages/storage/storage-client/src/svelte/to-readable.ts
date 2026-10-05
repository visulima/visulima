import type { Readable } from "svelte/store";
import { readable, toStore } from "svelte/store";

/**
 * Bridges a rune-reactive getter (svelte-query v6 results are plain reactive values, not stores)
 * to a `Readable`. A fresh `toStore` per subscription keeps `get()` and re-subscriptions current:
 * a single long-lived `toStore` keeps a stale value when the getter returns to its initial value
 * while nobody is subscribed.
 */
const toReadable = <T>(read: () => T): Readable<T> => readable(read(), (set) => toStore(read).subscribe(set));

export default toReadable;
