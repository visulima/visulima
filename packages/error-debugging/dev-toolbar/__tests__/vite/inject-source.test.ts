// @vitest-environment node
import { describe, expect, it } from "vitest";

import { addSourceToJsx } from "../../src/vite/inject-source";

const removeEmptySpace = (string_: string): string => string_.replaceAll(/\s/g, "").trim();

describe("inject source", () => {
    it("shouldn't augment react fragments", () => {
        expect.hasAssertions();

        const output = addSourceToJsx(
            `
      export const Route = createFileRoute("/test")({
      component: function() { return <>Hello World</> },
      })
        `,
            "test.jsx",
        );

        expect(output).toBeUndefined();
    });

    it("shouldn't augment react fragments if they start with Fragment", () => {
        expect.hasAssertions();

        const output = addSourceToJsx(
            `
      export const Route = createFileRoute("/test")({
      component: function() { return <Fragment>Hello World</Fragment> },
      })
        `,
            "test.jsx",
        );

        expect(output).toBeUndefined();
    });

    it("shouldn't augment react fragments if they start with React.Fragment", () => {
        expect.hasAssertions();

        const output = addSourceToJsx(
            `
      export const Route = createFileRoute("/test")({
      component: function() { return <React.Fragment>Hello World</React.Fragment> },
      })
        `,
            "test.jsx",
        );

        expect(output).toBeUndefined();
    });

    describe("functionExpression", () => {
        it("should work with deeply nested custom JSX syntax", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
      export const Route = createFileRoute("/test")({
      component: function() { return <div>Hello World</div> },
      })
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
            export const Route = createFileRoute("/test")({
      component: function() { return <div data-vdt-source="test.jsx:3:38">Hello World</div>; }
      });
        `),
            );
        });

        it("should work with props not destructured and spread", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
      export const Route = createFileRoute("/test")({
      component: function(props) { return <div {...props}>Hello World</div> },
      })
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });

        it("should work with props destructured and spread", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
      export const Route = createFileRoute("/test")({
      component: function({...props}) { return <div {...props}>Hello World</div> },
      })
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });

        it("should work with props spread and other normal elements", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
      export const Route = createFileRoute("/test")({
      component: function({...rest}) { return <div><div {...rest}>Hello World</div></div> }
      })
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
            export const Route = createFileRoute("/test")({
      component: function({...rest}) { return <div data-vdt-source="test.jsx:3:47"><div {...rest}>Hello World</div></div>; }
      });
        `),
            );
        });
    });

    describe("arrowFunctionExpression", () => {
        it("should work with deeply nested custom JSX syntax", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
      export const Route = createFileRoute("/test")({
      component: () => <div>Hello World</div>,
      })
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
            export const Route = createFileRoute("/test")({
      component: () => <div data-vdt-source="test.jsx:3:24">Hello World</div>
      });
        `),
            );
        });

        it("should work with props not destructured and spread", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
      export const Route = createFileRoute("/test")({
      component: (props) => <div {...props}>Hello World</div>,
      })
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });

        it("should work with props spread and other normal elements", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
      export const Route = createFileRoute("/test")({
      component: ({...rest}) => <div><div {...rest}>Hello World</div></div>,
      })
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
            export const Route = createFileRoute("/test")({
      component: ({...rest}) => <div data-vdt-source="test.jsx:3:33"><div {...rest}>Hello World</div></div>
      });
        `),
            );
        });
    });

    describe("function declarations", () => {
        it("scopes propsName to the nearest enclosing function — inner spread isn't matched against outer propsName", () => {
            expect.hasAssertions();

            // Outer function destructures into `outer`; inner arrow uses `inner`.
            // `<button {...inner} />` must be skipped because inner's own props are
            // spread onto it — not because of any relationship to `outer`. And
            // `<Child {...outer} />` is skipped because outer's props spread.
            // Both elements skipped ⇒ no transform ⇒ undefined return.
            const output = addSourceToJsx(
                `
function Parent({ ...outer }) {
    const Child = (inner) => <button {...inner} />;
    return <Child {...outer} />;
}
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });

        it("should not duplicate the same property if there are nested functions", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
      function Parent({ ...props }) {
        function Child({ ...props }) {
          return <div   />
        }
        return <Child {...props} />
      }
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
          function Parent({ ...props }) {
            function Child({ ...props }) {
              return <div data-vdt-source="test.jsx:4:18" />;
            }
            return <Child {...props} />;
          }
        `),
            );
        });

        it("props not destructured", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
    function test(props){
        return <button children={props.children} />
      }
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
function test(props) {
        return <button  children={props.children} data-vdt-source="test.jsx:3:16" />;
      }
`),
            );
        });

        it("doesn't transform when props are spread across the element", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
    function test(props) {
        return <button {...props} />
      }
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });

        it("doesn't transform when props are spread but applies to other elements without spread", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
    function test(props) {
        return (<div>
         <button {...props} />
         </div>)
      }
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
function test(props) {
        return  <div data-vdt-source="test.jsx:3:17">
        <button {...props}  />
        </div>;
      }
`),
            );
        });

        it("props destructured and collected", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
    function test({ ...props }) {
        return <button children={props.children} />
      }
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
    function test({ ...props }) {
        return <button  children={props.children} data-vdt-source="test.jsx:3:16" />;
      }
`),
            );
        });

        it("props destructured and collected with different name — spread on element", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
    function test({ children, ...rest }) {
        return <button children={children} {...rest} />
      }
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });
    });

    describe("arrow functions", () => {
        it("works with arrow function and props not destructured", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
      const ButtonWithProps = (props) => {
        return <button children={props.children} />
      }
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
  const ButtonWithProps = (props) => {
        return <button  children={props.children} data-vdt-source="test.jsx:3:16" />;
      };
`),
            );
        });

        it("doesn't transform when props are spread across the element", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
      const ButtonWithProps = (props) => {
        return <button {...props} />
      }
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });

        it("works with props destructured and collected even on custom components", () => {
            expect.hasAssertions();

            const output = removeEmptySpace(
                addSourceToJsx(
                    `
      const ButtonWithProps = ({ ...props }) => {
        return <CustomButton children={props.children} />
      }
        `,
                    "test.jsx",
                )!.code,
            );

            expect(output).toBe(
                removeEmptySpace(`
      const ButtonWithProps = ({ ...props }) => {
        return <CustomButton  children={props.children} data-vdt-source="test.jsx:3:16" />;
      };
`),
            );
        });

        it("works with arrow function and props destructured with different name — skips spread", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
      const ButtonWithProps = ({ children, ...rest }) => {
        return <CustomButton children={children} {...rest} />
      }
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });
    });

    describe("structural HTML document elements", () => {
        it("shouldn't augment <html> elements", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
    function RootLayout() {
        return <html lang="en"><body>hello</body></html>
    }
        `,
                "test.jsx",
            );

            expect(output).toBeUndefined();
        });

        it("shouldn't augment <head> elements but still annotates children", () => {
            expect.hasAssertions();

            const code = addSourceToJsx(
                `
    function RootLayout() {
        return <html><head><title>Test</title></head><body>hello</body></html>
    }
        `,
                "test.jsx",
            )?.code;

            // html/head/body are skipped; <title> inside head can still be annotated
            expect(code).not.toContain("html data-vdt-source");
            expect(code).not.toContain("head data-vdt-source");
            expect(code).not.toContain("body data-vdt-source");
            expect(code).toContain(`title data-vdt-source`);
        });

        it("shouldn't augment <body> elements", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
    function RootLayout() {
        return <html><body><div>hello</div></body></html>
    }
        `,
                "test.jsx",
            );

            // Only the inner <div> should be transformed; html/head/body skipped
            const code = output?.code ?? "";

            expect(code).not.toContain("html data-vdt-source");
            expect(code).not.toContain("body data-vdt-source");
            expect(code).toContain(`div data-vdt-source`);
        });
    });

    describe("ignore patterns", () => {
        it("should skip injection for ignored component names (string)", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
    function test() {
        return <Button />
      }
        `,
                "test.jsx",
                { components: ["Button"] },
            );

            expect(output).toBeUndefined();
        });

        it("should skip injection for ignored file paths (glob)", () => {
            expect.hasAssertions();

            const output = addSourceToJsx(
                `
    function test() {
        return <div />
      }
        `,
                "src/components/ignored-file.jsx",
                { files: ["**/ignored-file.jsx"] },
            );

            expect(output).toBeUndefined();
        });
    });

    describe("sSR position map (originalCode)", () => {
        it("uses original file line numbers when the received code has prepended imports", () => {
            expect.hasAssertions();

            // Simulates what TanStack Start / Vinxi does: prepend server imports
            // to the file, shifting JSX line numbers in the received code.
            const original = `
function Home() {
    return <div>Hello</div>
}
            `;

            // SSR pipeline prepends 5 lines of server imports
            const ssrCode = `import "server-only";
import { createServerFn } from "@tanstack/start";
import { createMiddleware } from "@tanstack/start";
import { headers } from "@tanstack/start/server";
import { getEvent } from "@tanstack/start/server";
function Home() {
    return <div>Hello</div>
}
            `;

            const clientResult = addSourceToJsx(original, "test.jsx");
            const ssrResult = addSourceToJsx(ssrCode, "test.jsx", {}, original);

            // Both should produce the same line number (from the original file)
            expect(clientResult?.code).toContain(`data-vdt-source="test.jsx:3:`);
            expect(ssrResult?.code).toContain(`data-vdt-source="test.jsx:3:`);

            const clientLine = clientResult?.code?.match(/data-vdt-source="test\.jsx:(\d+):/)?.[1];
            const ssrLine = ssrResult?.code?.match(/data-vdt-source="test\.jsx:(\d+):/)?.[1];

            expect(clientLine).toBe(ssrLine);
        });
    });
});
