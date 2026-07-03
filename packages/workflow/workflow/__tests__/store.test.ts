import { createStorage } from "unstorage";
import { describe, expect, it } from "vitest";

import MemoryStore from "../src/store/memory-store";
import UnstorageStore from "../src/store/unstorage-store";
import { runStoreContract } from "./_helpers/store-contract";

runStoreContract("MemoryStore", () => Promise.resolve({ store: new MemoryStore() }));
runStoreContract("UnstorageStore", () => Promise.resolve({ store: new UnstorageStore(createStorage()) }));

describe("store constructors", () => {
    it("creates a MemoryStore instance", () => {
        expect.assertions(1);

        expect(new MemoryStore()).toBeInstanceOf(MemoryStore);
    });
});
