import { describe, expect, it } from "vitest";

import globToRegExp from "../../../../src/find/utils/glob-to-regexp";

describe(globToRegExp, () => {
    // https://en.wikipedia.org/wiki/Glob_(programming)
    it("matches any number of any characters including none", () => {
        expect.assertions(11);

        let regex = globToRegExp("Law*");

        expect(regex.test("Law")).toBe(true);
        expect(regex.test("Laws")).toBe(true);
        expect(regex.test("Lawyer")).toBe(true);
        expect(regex.test("GrokLaw")).toBe(false);
        expect(regex.test("La")).toBe(false);
        expect(regex.test("aw")).toBe(false);

        regex = globToRegExp("*Law*");

        expect(regex.test("Law")).toBe(true);
        expect(regex.test("GrokLaw")).toBe(true);
        expect(regex.test("Lawyer")).toBe(true);
        expect(regex.test("La")).toBe(false);
        expect(regex.test("aw")).toBe(false);
    });

    it("matches any single character", () => {
        expect.assertions(5);

        const regex = globToRegExp("?at");

        expect(regex.test("Cat")).toBe(true);
        expect(regex.test("cat")).toBe(true);
        expect(regex.test("Bat")).toBe(true);
        expect(regex.test("bat")).toBe(true);
        expect(regex.test("at")).toBe(false);
    });

    it("matches one character given in the bracket", () => {
        expect.assertions(5);

        const regex = globToRegExp("[CB]at");

        expect(regex.test("Cat")).toBe(true);
        expect(regex.test("Bat")).toBe(true);
        expect(regex.test("cat")).toBe(false);
        expect(regex.test("bat")).toBe(false);
        expect(regex.test("CBat")).toBe(false);
    });

    it("matches one character from the (locale-dependent) range given in the bracket", () => {
        expect.assertions(7);

        const regex = globToRegExp("Letter[0-9]");

        expect(regex.test("Letter0")).toBe(true);
        expect(regex.test("Letter2")).toBe(true);
        expect(regex.test("Letter3")).toBe(true);
        expect(regex.test("Letter9")).toBe(true);
        expect(regex.test("Letters")).toBe(false);
        expect(regex.test("Letter")).toBe(false);
        expect(regex.test("Letter10")).toBe(false);
    });

    it("unix Like: matches one character that is not given in the bracket", () => {
        expect.assertions(4);

        const regex = globToRegExp("[!C]at");

        expect(regex.test("Bat")).toBe(true);
        expect(regex.test("bat")).toBe(true);
        expect(regex.test("cat")).toBe(true);
        expect(regex.test("Cat")).toBe(false);
    });

    it("unix Like: matches one character that is not from the range given in the bracket", () => {
        expect.assertions(8);

        const regex = globToRegExp("Letter[!3-5]");

        expect(regex.test("Letter0")).toBe(true);
        expect(regex.test("Letter1")).toBe(true);
        expect(regex.test("Letter6")).toBe(true);
        expect(regex.test("Letter7")).toBe(true);
        expect(regex.test("Letter3")).toBe(false);
        expect(regex.test("Letter4")).toBe(false);
        expect(regex.test("Letter5")).toBe(false);
        expect(regex.test("Letterxx")).toBe(false);
    });

    it("range with a single character", () => {
        expect.assertions(6);

        const globPattern = "[abc].txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("a.txt")).toBe(true);
        expect(regex.test("b.txt")).toBe(true);
        expect(regex.test("c.txt")).toBe(true);
        expect(regex.test("foo.txt")).toBe(false);
        expect(regex.test("bar.txt")).toBe(false);
        expect(regex.test("cat.txt")).toBe(false);
    });

    it("range with a mutlpile character", () => {
        expect.assertions(6);

        const globPattern = "[a-c].txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("a.txt")).toBe(true);
        expect(regex.test("b.txt")).toBe(true);
        expect(regex.test("c.txt")).toBe(true);
        expect(regex.test("d.txt")).toBe(false);
        expect(regex.test("e.txt")).toBe(false);
        expect(regex.test("aaaa.txt")).toBe(false);
    });

    it("complex directory and file extension match", () => {
        expect.assertions(4);

        const globPattern = "**/backup/**/month/[0-9][0-9]/**/backup?.{json|bson}";
        const regex = globToRegExp(globPattern);

        expect(regex.test("a/d/c/d/backup/year/23/month/06/day/01/backup1.json")).toBe(true);
        expect(regex.test("a/d/c/d/backup/year/23/month/07/day/12/backup2.bson")).toBe(true);
        expect(regex.test("a/d/c/d/backup/year/23/month/07/day/12/backup99.json")).toBe(false);
        expect(regex.test("a/d/c/d/backup/year/23/month/07/day/12/backup99.bson")).toBe(false);
    });

    it("simple file extension match", () => {
        expect.assertions(3);

        const globPattern = "*.txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("file.txt")).toBe(true);
        expect(regex.test("file.doc")).toBe(false);
        expect(regex.test("dir/file.txt")).toBe(false);
    });

    it("match files with any extension", () => {
        expect.assertions(6);

        const globPattern = "file.*";
        const regex = globToRegExp(globPattern);

        expect(regex.test("file.txt")).toBe(true);
        expect(regex.test("file.doc")).toBe(true);
        expect(regex.test("file")).toBe(false);
        expect(regex.test("dir/file.txt")).toBe(false);
        expect(regex.test("foo.txt.bak")).toBe(false);
        expect(regex.test("foo.txt/bar.txt")).toBe(false);
    });

    it("match multiple characters with \"?\"", () => {
        expect.assertions(5);

        const globPattern = "fi?e.txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("file.txt")).toBe(true);
        expect(regex.test("five.txt")).toBe(true);
        expect(regex.test("fire.txt")).toBe(true);
        expect(regex.test("fi.txt")).toBe(false);
        expect(regex.test("dir/file.txt")).toBe(false);
    });

    it("escape special characters", () => {
        expect.assertions(6);

        let regex = globToRegExp("file?.txt");

        expect(regex.test("file?.txt")).toBe(true);
        expect(regex.test("file1.txt")).toBe(true);
        expect(regex.test("fileX.txt")).toBe(true);
        expect(regex.test("fileXX.txt")).toBe(false);

        regex = globToRegExp("?.txt");

        expect(regex.test("a.txt")).toBe(true);
        expect(regex.test("foo.txt")).toBe(false);
    });

    it("match directories", () => {
        expect.assertions(5);

        const globPattern = "dir/*";

        const regex = globToRegExp(globPattern);

        expect(regex.test("dir/fileA.txt")).toBe(true);
        expect(regex.test("dir/fileB.txt")).toBe(true);
        expect(regex.test("dir/subdir/")).toBe(false);
        expect(regex.test("dir/subdir/file.txt")).toBe(false);
        expect(regex.test("file.txt")).toBe(false);
    });

    it("match sub directories", () => {
        expect.assertions(8);

        const globPattern = "dir/**";
        const regexPattern = globToRegExp(globPattern);

        const regex = new RegExp(regexPattern);

        expect(regex.test("dir/fileA.txt")).toBe(true);
        expect(regex.test("dir/fileB.txt")).toBe(true);
        expect(regex.test("dir/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/fileB.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/fileB.txt")).toBe(true);
        expect(regex.test("fileA.txt")).toBe(false);
        expect(regex.test("fileB.txt")).toBe(false);
    });

    it("match sub directories with interruption in depth", () => {
        expect.assertions(18);

        const globPattern = "dir/**/[0-9][0-9][0-9]/**/*.txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("dir/fileA.txt")).toBe(false);
        expect(regex.test("dir/fileB.txt")).toBe(false);
        expect(regex.test("dir/subdir/000/fileA.txt")).toBe(false);
        expect(regex.test("dir/subdir/111/fileA.txt")).toBe(false);
        expect(regex.test("dir/subdir/999/fileA.txt")).toBe(false);
        expect(regex.test("dir/subdir/090/fileA.txt")).toBe(false);

        expect(regex.test("dir/subdir/000/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/111/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/999/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/090/subdir/fileA.txt")).toBe(true);

        expect(regex.test("dir/subdir/subdir/000/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/111/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/999/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/090/subdir/fileA.txt")).toBe(true);

        expect(regex.test("dir/subdir/subdir/000/subdir/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/111/subdir/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/999/subdir/subdir/fileA.txt")).toBe(true);
        expect(regex.test("dir/subdir/subdir/090/subdir/subdir/fileA.txt")).toBe(true);
        // expect(regex.test('dir/subdir/fileB.txt')).toBe(true);
        // expect(regex.test('dir/subdir/subdir/fileA.txt')).toBe(true);
        // expect(regex.test('dir/subdir/subdir/fileB.txt')).toBe(true);
        // expect(regex.test('fileA.txt')).toBe(false);
        // expect(regex.test('fileB.txt')).toBe(false);
    });

    it("should test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}", () => {
        expect.assertions(16);

        const globPattern = "test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}";
        const regex = globToRegExp(globPattern);

        expect(regex.test("test.js")).toBe(true);
        expect(regex.test("test.cjs")).toBe(true);
        expect(regex.test("test.mjs")).toBe(true);
        expect(regex.test("test.ts")).toBe(true);
        expect(regex.test("test.tsx")).toBe(true);
        expect(regex.test("test.jsx")).toBe(true);
        expect(regex.test("test.yaml")).toBe(true);
        expect(regex.test("test.yml")).toBe(true);

        expect(regex.test("test-abc.js")).toBe(true);
        expect(regex.test("test-abc.cjs")).toBe(true);
        expect(regex.test("test-abc.mjs")).toBe(true);
        expect(regex.test("test-abc.ts")).toBe(true);
        expect(regex.test("test-abc.tsx")).toBe(true);
        expect(regex.test("test-abc.jsx")).toBe(true);
        expect(regex.test("test-abc.yaml")).toBe(true);
        expect(regex.test("test-abc.yml")).toBe(true);
    });
});
