import { describe, expect, it } from "vitest";

import globToRegExp from "../../../src/utils/glob-to-regex";

describe("globToRegExp", () => {
    // https://en.wikipedia.org/wiki/Glob_(programming)
    it("matches any number of any characters including none", () => {
        expect.assertions(11);

        let regex = globToRegExp("Law*");

        expect(regex.test("Law")).toBeTruthy();
        expect(regex.test("Laws")).toBeTruthy();
        expect(regex.test("Lawyer")).toBeTruthy();
        expect(regex.test("GrokLaw")).toBeFalsy();
        expect(regex.test("La")).toBeFalsy();
        expect(regex.test("aw")).toBeFalsy();

        regex = globToRegExp("*Law*");

        expect(regex.test("Law")).toBeTruthy();
        expect(regex.test("GrokLaw")).toBeTruthy();
        expect(regex.test("Lawyer")).toBeTruthy();
        expect(regex.test("La")).toBeFalsy();
        expect(regex.test("aw")).toBeFalsy();
    });

    it("matches any single character", () => {
        expect.assertions(5);

        const regex = globToRegExp("?at");

        expect(regex.test("Cat")).toBeTruthy();
        expect(regex.test("cat")).toBeTruthy();
        expect(regex.test("Bat")).toBeTruthy();
        expect(regex.test("bat")).toBeTruthy();
        expect(regex.test("at")).toBeFalsy();
    });

    it("matches one character given in the bracket", () => {
        expect.assertions(5);

        const regex = globToRegExp("[CB]at");

        expect(regex.test("Cat")).toBeTruthy();
        expect(regex.test("Bat")).toBeTruthy();
        expect(regex.test("cat")).toBeFalsy();
        expect(regex.test("bat")).toBeFalsy();
        expect(regex.test("CBat")).toBeFalsy();
    });

    it("matches one character from the (locale-dependent) range given in the bracket", () => {
        expect.assertions(7);

        const regex = globToRegExp("Letter[0-9]");

        expect(regex.test("Letter0")).toBeTruthy();
        expect(regex.test("Letter2")).toBeTruthy();
        expect(regex.test("Letter3")).toBeTruthy();
        expect(regex.test("Letter9")).toBeTruthy();
        expect(regex.test("Letters")).toBeFalsy();
        expect(regex.test("Letter")).toBeFalsy();
        expect(regex.test("Letter10")).toBeFalsy();
    });

    it("unix Like: matches one character that is not given in the bracket", () => {
        expect.assertions(4);

        const regex = globToRegExp("[!C]at");

        expect(regex.test("Bat")).toBeTruthy();
        expect(regex.test("bat")).toBeTruthy();
        expect(regex.test("cat")).toBeTruthy();
        expect(regex.test("Cat")).toBeFalsy();
    });

    it("unix Like: matches one character that is not from the range given in the bracket", () => {
        expect.assertions(8);

        const regex = globToRegExp("Letter[!3-5]");

        expect(regex.test("Letter0")).toBeTruthy();
        expect(regex.test("Letter1")).toBeTruthy();
        expect(regex.test("Letter6")).toBeTruthy();
        expect(regex.test("Letter7")).toBeTruthy();
        expect(regex.test("Letter3")).toBeFalsy();
        expect(regex.test("Letter4")).toBeFalsy();
        expect(regex.test("Letter5")).toBeFalsy();
        expect(regex.test("Letterxx")).toBeFalsy();
    });

    it("range with a single character", () => {
        expect.assertions(6);

        const globPattern = "[abc].txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("a.txt")).toBeTruthy();
        expect(regex.test("b.txt")).toBeTruthy();
        expect(regex.test("c.txt")).toBeTruthy();
        expect(regex.test("foo.txt")).toBeFalsy();
        expect(regex.test("bar.txt")).toBeFalsy();
        expect(regex.test("cat.txt")).toBeFalsy();
    });

    it("range with a mutlpile character", () => {
        expect.assertions(6);

        const globPattern = "[a-c].txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("a.txt")).toBeTruthy();
        expect(regex.test("b.txt")).toBeTruthy();
        expect(regex.test("c.txt")).toBeTruthy();
        expect(regex.test("d.txt")).toBeFalsy();
        expect(regex.test("e.txt")).toBeFalsy();
        expect(regex.test("aaaa.txt")).toBeFalsy();
    });

    it("complex directory and file extension match", () => {
        expect.assertions(4);

        const globPattern = "**/backup/**/month/[0-9][0-9]/**/backup?.{json|bson}";
        const regex = globToRegExp(globPattern);

        expect(regex.test("a/d/c/d/backup/year/23/month/06/day/01/backup1.json")).toBeTruthy();
        expect(regex.test("a/d/c/d/backup/year/23/month/07/day/12/backup2.bson")).toBeTruthy();
        expect(regex.test("a/d/c/d/backup/year/23/month/07/day/12/backup99.json")).toBeFalsy();
        expect(regex.test("a/d/c/d/backup/year/23/month/07/day/12/backup99.bson")).toBeFalsy();
    });

    it("simple file extension match", () => {
        expect.assertions(3);

        const globPattern = "*.txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("file.txt")).toBeTruthy();
        expect(regex.test("file.doc")).toBeFalsy();
        expect(regex.test("dir/file.txt")).toBeFalsy();
    });

    it("match files with any extension", () => {
        expect.assertions(6);

        const globPattern = "file.*";
        const regex = globToRegExp(globPattern);

        expect(regex.test("file.txt")).toBeTruthy();
        expect(regex.test("file.doc")).toBeTruthy();
        expect(regex.test("file")).toBeFalsy();
        expect(regex.test("dir/file.txt")).toBeFalsy();
        expect(regex.test("foo.txt.bak")).toBeFalsy();
        expect(regex.test("foo.txt/bar.txt")).toBeFalsy();
    });

    it('match multiple characters with "?"', () => {
        expect.assertions(5);

        const globPattern = "fi?e.txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("file.txt")).toBeTruthy();
        expect(regex.test("five.txt")).toBeTruthy();
        expect(regex.test("fire.txt")).toBeTruthy();
        expect(regex.test("fi.txt")).toBeFalsy();
        expect(regex.test("dir/file.txt")).toBeFalsy();
    });

    it("escape special characters", () => {
        expect.assertions(6);
        let regex = globToRegExp("file?.txt");

        expect(regex.test("file?.txt")).toBeTruthy();
        expect(regex.test("file1.txt")).toBeTruthy();
        expect(regex.test("fileX.txt")).toBeTruthy();
        expect(regex.test("fileXX.txt")).toBeFalsy();

        regex = globToRegExp("?.txt");

        expect(regex.test("a.txt")).toBeTruthy();
        expect(regex.test("foo.txt")).toBeFalsy();
    });

    it("match directories", () => {
        expect.assertions(5);

        const globPattern = "dir/*";

        const regex = globToRegExp(globPattern);

        expect(regex.test("dir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/fileB.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/")).toBeFalsy();
        expect(regex.test("dir/subdir/file.txt")).toBeFalsy();
        expect(regex.test("file.txt")).toBeFalsy();
    });

    it("match sub directories", () => {
        expect.assertions(8);

        const globPattern = "dir/**";
        const regexPattern = globToRegExp(globPattern);
        // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
        const regex = new RegExp(regexPattern);

        expect(regex.test("dir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/fileB.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/fileB.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/fileB.txt")).toBeTruthy();
        expect(regex.test("fileA.txt")).toBeFalsy();
        expect(regex.test("fileB.txt")).toBeFalsy();
    });

    it("match sub directories with interruption in depth", () => {
        expect.assertions(18);

        const globPattern = "dir/**/[0-9][0-9][0-9]/**/*.txt";
        const regex = globToRegExp(globPattern);

        expect(regex.test("dir/fileA.txt")).toBeFalsy();
        expect(regex.test("dir/fileB.txt")).toBeFalsy();
        expect(regex.test("dir/subdir/000/fileA.txt")).toBeFalsy();
        expect(regex.test("dir/subdir/111/fileA.txt")).toBeFalsy();
        expect(regex.test("dir/subdir/999/fileA.txt")).toBeFalsy();
        expect(regex.test("dir/subdir/090/fileA.txt")).toBeFalsy();

        expect(regex.test("dir/subdir/000/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/111/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/999/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/090/subdir/fileA.txt")).toBeTruthy();

        expect(regex.test("dir/subdir/subdir/000/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/111/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/999/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/090/subdir/fileA.txt")).toBeTruthy();

        expect(regex.test("dir/subdir/subdir/000/subdir/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/111/subdir/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/999/subdir/subdir/fileA.txt")).toBeTruthy();
        expect(regex.test("dir/subdir/subdir/090/subdir/subdir/fileA.txt")).toBeTruthy();
        // expect(regex.test('dir/subdir/fileB.txt')).toBe(true);
        // expect(regex.test('dir/subdir/subdir/fileA.txt')).toBe(true);
        // expect(regex.test('dir/subdir/subdir/fileB.txt')).toBe(true);
        // expect(regex.test('fileA.txt')).toBe(false);
        // expect(regex.test('fileB.txt')).toBe(false);
    });

    it('should test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}', () => {
        expect.assertions(16);

        const globPattern = 'test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}';
        const regex = globToRegExp(globPattern);

        expect(regex.test('test.js')).toBeTruthy();
        expect(regex.test('test.cjs')).toBeTruthy();
        expect(regex.test('test.mjs')).toBeTruthy();
        expect(regex.test('test.ts')).toBeTruthy();
        expect(regex.test('test.tsx')).toBeTruthy();
        expect(regex.test('test.jsx')).toBeTruthy();
        expect(regex.test('test.yaml')).toBeTruthy();
        expect(regex.test('test.yml')).toBeTruthy();


        expect(regex.test('test-abc.js')).toBeTruthy();
        expect(regex.test('test-abc.cjs')).toBeTruthy();
        expect(regex.test('test-abc.mjs')).toBeTruthy();
        expect(regex.test('test-abc.ts')).toBeTruthy();
        expect(regex.test('test-abc.tsx')).toBeTruthy();
        expect(regex.test('test-abc.jsx')).toBeTruthy();
        expect(regex.test('test-abc.yaml')).toBeTruthy();
        expect(regex.test('test-abc.yml')).toBeTruthy();
    });
});
