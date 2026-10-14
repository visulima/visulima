// Child-process driver for __tests__/integration/import-safety.test.ts.
// Usage: node scenario.mjs <entry> <inject|lazy> [--no-builtins]
// Prints one JSON line describing what the built entry did.
const [entry, scenario, flag] = process.argv.slice(2);

let warnings = 0;

console.warn = () => {
    warnings += 1;
};

if (flag === "--no-builtins") {
    delete process.getBuiltinModule;
}

const api = await import(entry);

// "lazy" injects nothing, so the first lookup below is what triggers the disk read.
if (scenario === "inject") {
    api.setDomains(["gmail.com"]);
}

// Two separate calls (not `a && b`, which short-circuits on false), so a repeated warning shows up in the count.
const first = api.isFreeDomain("sub.gmail.com");
const second = api.isFreeDomain("sub.gmail.com");
const matched = first && second;

process.stdout.write(JSON.stringify({ listLoaded: api.isListLoaded(), matched, otherMatched: api.isFreeEmail("a@example.com"), warnings }));
