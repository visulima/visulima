import expect from "expect";
import { Toolbox } from "../../src/domain/toolbox";
import { Runtime } from "../../src/runtime/runtime";
import createExtension from "../../src/extensions/meta-extension";
import { Meta as IMeta } from "../../src/types";

test("has the proper interface", () => {
    const toolbox = new Toolbox();
    const fakeRuntime = { plugin: { directory: "/the/path" } } as Runtime;

    toolbox.runtime = fakeRuntime;

    createExtension(toolbox);

    const ext = toolbox.meta as IMeta;

    expect(ext).toBeTruthy();
    expect(ext.src).toEqual("/the/path");
    expect(typeof ext.version).toBe("function");
    expect(typeof ext.commandInfo).toBe("function");
    expect(typeof ext.checkForUpdate).toBe("function");
});
