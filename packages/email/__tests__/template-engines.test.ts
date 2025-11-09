import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailError } from "../src/errors/email-error.js";
// Import after mocking
import { registerHandlebarsHelper, registerHandlebarsPartial, renderHandlebars } from "../src/template-engines/handlebars.js";
import { htmlToText } from "../src/template-engines/html-to-text.js";
import { renderMjml } from "../src/template-engines/mjml.js";
import { renderReactEmail } from "../src/template-engines/react-email.js";
import { renderVueEmail } from "../src/template-engines/vue-email.js";

// Mock template engine dependencies
vi.mock(import("handlebars"), () => {
    return {
        default: {
            compile: vi.fn(),
            registerHelper: vi.fn(),
            registerPartial: vi.fn(),
        },
    };
});

vi.mock(import("mjml"), () => {
    return {
        default: vi.fn(),
    };
});

vi.mock(import("html-to-text"), () => {
    return {
        convert: vi.fn(),
    };
});

vi.mock(import("@vue-email/compiler"), () => {
    return {
        compileTemplate: vi.fn(),
    };
});

vi.mock(import("react"), () => {
    return {
        isValidElement: vi.fn(() => false),
    };
});

vi.mock(import("@react-email/render"), () => {
    return {
        render: vi.fn(),
    };
});

describe("template-engines", () => {
    describe("handlebars", () => {
        const mockHandlebars = await import("handlebars");

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe(renderHandlebars, () => {
            it("should render a simple Handlebars template", () => {
                const compiledTemplate = vi.fn().mockReturnValue("<h1>Hello World</h1>");

                mockHandlebars.default.compile.mockReturnValue(compiledTemplate);

                const result = renderHandlebars("<h1>{{title}}</h1>", { title: "Hello World" });

                expect(mockHandlebars.default.compile).toHaveBeenCalledWith("<h1>{{title}}</h1>", undefined);
                expect(compiledTemplate).toHaveBeenCalledWith({ title: "Hello World" });
                expect(result).toBe("<h1>Hello World</h1>");
            });

            it("should render template with options", () => {
                const compiledTemplate = vi.fn().mockReturnValue("<div>Result</div>");

                mockHandlebars.default.compile.mockReturnValue(compiledTemplate);
                const options = { strict: true };

                const result = renderHandlebars("{{value}}", { value: "test" }, options);

                expect(mockHandlebars.default.compile).toHaveBeenCalledWith("{{value}}", options);
                expect(result).toBe("<div>Result</div>");
            });

            it("should render template without data", () => {
                const compiledTemplate = vi.fn().mockReturnValue("<p>No data</p>");

                mockHandlebars.default.compile.mockReturnValue(compiledTemplate);

                const result = renderHandlebars("<p>No data</p>");

                expect(compiledTemplate).toHaveBeenCalledWith({});
                expect(result).toBe("<p>No data</p>");
            });

            it("should throw error for non-string template", () => {
                expect(() => renderHandlebars(123)).toThrow(TypeError);
                expect(() => renderHandlebars(123)).toThrow("Handlebars template must be a string");
            });

            it("should throw EmailError for Handlebars compilation errors", () => {
                const error = new Error("Invalid template syntax");

                mockHandlebars.default.compile.mockImplementation(() => {
                    throw error;
                });

                expect(() => renderHandlebars("{{invalid syntax", {})).toThrow(EmailError);
                expect(() => renderHandlebars("{{invalid syntax", {})).toThrow("Failed to render Handlebars template: Invalid template syntax");
            });

            it("should throw EmailError when Handlebars is not installed", () => {
                const error = new Error("Cannot find module 'handlebars'");

                mockHandlebars.default.compile.mockImplementation(() => {
                    throw error;
                });

                expect(() => renderHandlebars("template", {})).toThrow(EmailError);
                expect(() => renderHandlebars("template", {})).toThrow("Handlebars is not installed. Please install it: pnpm add handlebars");
            });
        });

        describe(registerHandlebarsHelper, () => {
            it("should register a helper function", () => {
                const helper = vi.fn();

                registerHandlebarsHelper("uppercase", helper);

                expect(mockHandlebars.default.registerHelper).toHaveBeenCalledWith("uppercase", helper);
            });

            it("should throw EmailError when Handlebars is not installed", () => {
                const error = new Error("Cannot find module 'handlebars'");

                mockHandlebars.default.registerHelper.mockImplementation(() => {
                    throw error;
                });

                expect(() => registerHandlebarsHelper("test", () => {})).toThrow(EmailError);
                expect(() => registerHandlebarsHelper("test", () => {})).toThrow("Handlebars is not installed. Please install it: pnpm add handlebars");
            });
        });

        describe(registerHandlebarsPartial, () => {
            it("should register a partial template", () => {
                const partial = "<div>Partial content</div>";

                registerHandlebarsPartial("header", partial);

                expect(mockHandlebars.default.registerPartial).toHaveBeenCalledWith("header", partial);
            });

            it("should throw EmailError when Handlebars is not installed", () => {
                const error = new Error("Cannot find module 'handlebars'");

                mockHandlebars.default.registerPartial.mockImplementation(() => {
                    throw error;
                });

                expect(() => registerHandlebarsPartial("test", "content")).toThrow(EmailError);
                expect(() => registerHandlebarsPartial("test", "content")).toThrow("Handlebars is not installed. Please install it: pnpm add handlebars");
            });
        });
    });

    describe("mJML", () => {
        const mockMjml = await import("mjml");

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe(renderMjml, () => {
            it("should render MJML to HTML", () => {
                const mjmlResult = {
                    errors: [],
                    html: "<div>Rendered HTML</div>",
                };

                mockMjml.default.mockReturnValue(mjmlResult);

                const result = renderMjml("<mjml><mj-body><mj-text>Hello</mj-text></mj-body></mjml>");

                expect(mockMjml.default).toHaveBeenCalledWith("<mjml><mj-body><mj-text>Hello</mj-text></mj-body></mjml>", {
                    beautify: false,
                    fonts: undefined,
                    keepComments: true,
                    minify: false,
                    validationLevel: "soft",
                });
                expect(result).toBe("<div>Rendered HTML</div>");
            });

            it("should render with custom options", () => {
                const mjmlResult = {
                    errors: [],
                    html: "<div>Custom HTML</div>",
                };

                mockMjml.default.mockReturnValue(mjmlResult);
                const options = {
                    beautify: true,
                    fonts: { "Open Sans": "https://fonts.googleapis.com/css?family=Open+Sans" },
                    minify: true,
                    validationLevel: "strict" as const,
                };

                const result = renderMjml("<mjml></mjml>", {}, options);

                expect(mockMjml.default).toHaveBeenCalledWith("<mjml></mjml>", {
                    beautify: true,
                    fonts: { "Open Sans": "https://fonts.googleapis.com/css?family=Open+Sans" },
                    keepComments: true,
                    minify: true,
                    validationLevel: "strict",
                });
                expect(result).toBe("<div>Custom HTML</div>");
            });

            it("should throw error for non-string template", () => {
                expect(() => renderMjml(null)).toThrow(TypeError);
                expect(() => renderMjml(null)).toThrow("MJML template must be a string");
            });

            it("should throw EmailError for MJML validation errors", () => {
                const mjmlResult = {
                    errors: [{ message: "Invalid tag" }, { message: "Missing attribute" }],
                    html: "<div>Error HTML</div>",
                };

                mockMjml.default.mockReturnValue(mjmlResult);

                expect(() => renderMjml("<invalid>")).toThrow(EmailError);
                expect(() => renderMjml("<invalid>")).toThrow("MJML validation errors: Invalid tag; Missing attribute");
            });

            it("should throw EmailError when MJML is not installed", () => {
                const error = new Error("Cannot find module 'mjml'");

                mockMjml.default.mockImplementation(() => {
                    throw error;
                });

                expect(() => renderMjml("<mjml></mjml>")).toThrow(EmailError);
                expect(() => renderMjml("<mjml></mjml>")).toThrow("MJML is not installed. Please install it: pnpm add mjml");
            });

            it("should re-throw EmailError instances", () => {
                const emailError = new EmailError("mjml", "Custom error");

                mockMjml.default.mockImplementation(() => {
                    throw emailError;
                });

                expect(() => renderMjml("<mjml></mjml>")).toThrow(emailError);
            });
        });
    });

    describe("hTML to Text", () => {
        const mockHtmlToText = await import("html-to-text");

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe(htmlToText, () => {
            it("should convert HTML to plain text", () => {
                mockHtmlToText.convert.mockReturnValue("Plain text content");

                const result = htmlToText("<h1>Title</h1><p>Content</p>");

                expect(mockHtmlToText.convert).toHaveBeenCalledWith("<h1>Title</h1><p>Content</p>", {
                    longWordSplit: undefined,
                    preserveNewlines: false,
                    selectors: undefined,
                    wordwrap: 80,
                });
                expect(result).toBe("Plain text content");
            });

            it("should convert with custom options", () => {
                mockHtmlToText.convert.mockReturnValue("Wrapped text");
                const options = {
                    longWordSplit: {
                        forceWrapOnLimit: true,
                        wrapCharacters: ["-", "/"],
                    },
                    preserveNewlines: true,
                    selectors: [
                        {
                            format: "heading",
                            options: { uppercase: true },
                            selector: "h1",
                        },
                    ],
                    wordwrap: 40,
                };

                const result = htmlToText("<h1>Title</h1><p>Content</p>", options);

                expect(mockHtmlToText.convert).toHaveBeenCalledWith("<h1>Title</h1><p>Content</p>", {
                    longWordSplit: {
                        forceWrapOnLimit: true,
                        wrapCharacters: ["-", "/"],
                    },
                    preserveNewlines: true,
                    selectors: [
                        {
                            format: "heading",
                            options: { uppercase: true },
                            selector: "h1",
                        },
                    ],
                    wordwrap: 40,
                });
                expect(result).toBe("Wrapped text");
            });

            it("should throw EmailError when html-to-text is not installed", () => {
                const error = new Error("Cannot find module 'html-to-text'");

                mockHtmlToText.convert.mockImplementation(() => {
                    throw error;
                });

                expect(() => htmlToText("<p>test</p>")).toThrow(EmailError);
                expect(() => htmlToText("<p>test</p>")).toThrow("html-to-text is not installed. Please install it: pnpm add html-to-text");
            });

            it("should throw EmailError for conversion errors", () => {
                const error = new Error("Conversion failed");

                mockHtmlToText.convert.mockImplementation(() => {
                    throw error;
                });

                expect(() => htmlToText("<invalid>")).toThrow(EmailError);
                expect(() => htmlToText("<invalid>")).toThrow("Failed to convert HTML to text: Conversion failed");
            });
        });
    });

    describe("vue Email", () => {
        const mockVueCompiler = await import("@vue-email/compiler");

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe(renderVueEmail, () => {
            it("should render Vue template", () => {
                mockVueCompiler.compileTemplate.mockReturnValue("<div>Rendered Vue</div>");

                const result = renderVueEmail("<template><div>{{message}}</div></template>", { message: "Hello" });

                expect(mockVueCompiler.compileTemplate).toHaveBeenCalledWith("<template><div>{{message}}</div></template>", { message: "Hello" }, undefined);
                expect(result).toBe("<div>Rendered Vue</div>");
            });

            it("should render with options", () => {
                mockVueCompiler.compileTemplate.mockReturnValue("<div>With options</div>");
                const options = { minify: true };

                const result = renderVueEmail("<template></template>", {}, options);

                expect(mockVueCompiler.compileTemplate).toHaveBeenCalledWith("<template></template>", {}, options);
                expect(result).toBe("<div>With options</div>");
            });

            it("should throw EmailError for compilation errors", () => {
                const error = new Error("Vue compilation failed");

                mockVueCompiler.compileTemplate.mockImplementation(() => {
                    throw error;
                });

                expect(() => renderVueEmail("<invalid>", {})).toThrow(EmailError);
                expect(() => renderVueEmail("<invalid>", {})).toThrow("Failed to render Vue email template: Vue compilation failed");
            });

            it("should throw EmailError when Vue Email is not installed", () => {
                const error = new Error("Cannot find module '@vue-email/compiler'");

                mockVueCompiler.compileTemplate.mockImplementation(() => {
                    throw error;
                });

                expect(() => renderVueEmail("<template></template>", {})).toThrow(EmailError);
                expect(() => renderVueEmail("<template></template>", {})).toThrow(
                    "Vue Email is not installed. Please install it: pnpm add @vue-email/compiler",
                );
            });
        });
    });

    describe("react Email", () => {
        const mockReactRender = await import("@react-email/render");
        const mockReact = await import("react");

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe(renderReactEmail, () => {
            it("should render React component", () => {
                mockReact.isValidElement.mockReturnValue(true);
                mockReactRender.render.mockReturnValue("<div>Rendered React</div>");

                const component = { props: {}, type: "div" };
                const result = renderReactEmail(component, { message: "Hello" });

                expect(mockReact.isValidElement).toHaveBeenCalledWith(component);
                expect(mockReactRender.render).toHaveBeenCalledWith(component, { message: "Hello" });
                expect(result).toBe("<div>Rendered React</div>");
            });

            it("should throw error for non-React element", () => {
                mockReact.isValidElement.mockReturnValue(false);

                expect(() => renderReactEmail("not a component", {})).toThrow(TypeError);
                expect(() => renderReactEmail("not a component", {})).toThrow("React Email template must be a valid React element");
            });

            it("should throw EmailError for rendering errors", () => {
                mockReact.isValidElement.mockReturnValue(true);
                const error = new Error("React rendering failed");

                mockReactRender.render.mockImplementation(() => {
                    throw error;
                });

                const component = { props: {}, type: "div" };

                expect(() => renderReactEmail(component, {})).toThrow(EmailError);
                expect(() => renderReactEmail(component, {})).toThrow("Failed to render React email template: React rendering failed");
            });

            it("should throw EmailError when React Email is not installed", () => {
                mockReact.isValidElement.mockReturnValue(true);
                const error = new Error("Cannot find module '@react-email/render'");

                mockReactRender.render.mockImplementation(() => {
                    throw error;
                });

                const component = { props: {}, type: "div" };

                expect(() => renderReactEmail(component, {})).toThrow(EmailError);
                expect(() => renderReactEmail(component, {})).toThrow("React Email is not installed. Please install it: pnpm add @react-email/render");
            });
        });
    });
});
