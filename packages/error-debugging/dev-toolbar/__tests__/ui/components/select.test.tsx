// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectOption } from "../../../src/ui/components/select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useSelectContext } from "../../../src/ui/components/select";

vi.mock(import("@floating-ui/dom"), () => {
    return {
        computePosition: vi.fn().mockResolvedValue({ x: 10, y: 20 }),
        flip: vi.fn(() => {
            return { name: "flip" };
        }),
        offset: vi.fn((n: number) => {
            return { name: "offset", options: n };
        }),
        shift: vi.fn(() => {
            return { name: "shift" };
        }),
    };
});

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

const FRUITS: SelectOption[] = [
    { label: "Apple", value: "apple" },
    { label: "Banana", value: "banana" },
    { label: "Cherry", value: "cherry" },
];

const BasicSelect = ({
    onValueChange,
    searchable = false,
    value = "",
}: {
    onValueChange?: (v: string) => void;
    searchable?: boolean;
    value?: string;
}): JSX.Element => (
    <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger>
            <SelectValue options={FRUITS} placeholder="Pick a fruit" />
        </SelectTrigger>
        <SelectContent searchable={searchable}>
            {FRUITS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
);

// ─── Rendering ──────────────────────────────────────────────────────────────────

describe("select", () => {
    describe("rendering", () => {
        it("renders the trigger button", () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            expect(screen.getByRole("button")).toBeInTheDocument();
        });

        it("displays placeholder when no value is selected", () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            expect(screen.getByText("Pick a fruit")).toBeInTheDocument();
        });

        it("displays the selected option label", () => {
            expect.hasAssertions();

            render(<BasicSelect value="banana" />);

            expect(screen.getByText("Banana")).toBeInTheDocument();
        });

        it("dropdown is not visible initially", () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });
    });

    // ─── Trigger ────────────────────────────────────────────────────────────────

    describe("trigger", () => {
        it("has aria-haspopup=listbox", () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "listbox");
        });

        it("has aria-expanded=false when closed", () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
        });

        it("has aria-expanded=true when open", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
        });

        it("opens dropdown on click", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("listbox")).toBeInTheDocument();
        });

        it("closes dropdown on second click", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);
            const trigger = screen.getByRole("button");

            await act(async () => {
                fireEvent.click(trigger);
            });

            expect(screen.getByRole("listbox")).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(trigger);
            });

            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });

        it("merges custom class", async () => {
            expect.hasAssertions();

            render(
                <Select value="">
                    <SelectTrigger class="my-trigger">
                        <SelectValue options={FRUITS} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="apple">Apple</SelectItem>
                    </SelectContent>
                </Select>,
            );

            expect(screen.getByRole("button")).toHaveClass("my-trigger");
        });
    });

    // ─── Options ────────────────────────────────────────────────────────────────

    describe("options", () => {
        it("renders all options with role=option", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getAllByRole("option")).toHaveLength(3);
        });

        it("options display correct text", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByText("Apple")).toBeInTheDocument();
            expect(screen.getByText("Banana")).toBeInTheDocument();
            expect(screen.getByText("Cherry")).toBeInTheDocument();
        });

        it("selected option has aria-selected=true", async () => {
            expect.hasAssertions();

            render(<BasicSelect value="banana" />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const options = screen.getAllByRole("option");
            const banana = options.find((o) => o.textContent?.includes("Banana"));

            expect(banana).toHaveAttribute("aria-selected", "true");
        });

        it("non-selected options have aria-selected=false", async () => {
            expect.hasAssertions();

            render(<BasicSelect value="banana" />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const options = screen.getAllByRole("option");
            const apple = options.find((o) => o.textContent?.includes("Apple"));

            expect(apple).toHaveAttribute("aria-selected", "false");
        });

        it("selected option has font-medium class", async () => {
            expect.hasAssertions();

            render(<BasicSelect value="cherry" />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const options = screen.getAllByRole("option");
            const cherry = options.find((o) => o.textContent?.includes("Cherry"));

            expect(cherry?.className).toContain("font-medium");
        });

        it("options have data-value attribute", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const options = screen.getAllByRole("option");

            expect(options[0]).toHaveAttribute("data-value", "apple");
            expect(options[1]).toHaveAttribute("data-value", "banana");
            expect(options[2]).toHaveAttribute("data-value", "cherry");
        });

        it("options have id attributes", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const options = screen.getAllByRole("option");

            for (const option of options) {
                expect(option.id.length).toBeGreaterThan(0);
            }
        });
    });

    // ─── Selection ──────────────────────────────────────────────────────────────

    describe("selection", () => {
        it("clicking an option calls onValueChange", async () => {
            expect.hasAssertions();

            const onValueChange = vi.fn();

            render(<BasicSelect onValueChange={onValueChange} />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                fireEvent.click(screen.getByText("Cherry"));
            });

            expect(onValueChange).toHaveBeenCalledWith("cherry");
        });

        it("clicking an option closes the dropdown", async () => {
            expect.hasAssertions();

            const onValueChange = vi.fn();

            render(<BasicSelect onValueChange={onValueChange} />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                fireEvent.click(screen.getByText("Apple"));
            });

            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });

        it("selecting the already-selected value still calls onValueChange", async () => {
            expect.hasAssertions();

            const onValueChange = vi.fn();

            render(<BasicSelect onValueChange={onValueChange} value="apple" />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const options = screen.getAllByRole("option");
            const appleOption = options.find((o) => o.dataset.value === "apple");

            await act(async () => {
                fireEvent.click(appleOption!);
            });

            expect(onValueChange).toHaveBeenCalledWith("apple");
        });
    });

    // ─── Click outside ──────────────────────────────────────────────────────────

    describe("click outside", () => {
        it("closes the dropdown on mousedown outside", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("listbox")).toBeInTheDocument();

            await act(async () => {
                fireEvent.mouseDown(document.body);
            });

            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });

        it("clicking inside the dropdown does not close it", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const listbox = screen.getByRole("listbox");

            await act(async () => {
                fireEvent.mouseDown(listbox);
            });

            expect(screen.getByRole("listbox")).toBeInTheDocument();
        });
    });

    // ─── Keyboard navigation ────────────────────────────────────────────────────

    describe("keyboard navigation", () => {
        it("arrowDown highlights next option", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                fireEvent.keyDown(document, { key: "ArrowDown" });
            });

            const options = screen.getAllByRole("option");

            expect(options[0]?.className).toContain("bg-accent");
        });

        it("arrowDown wraps from last to first", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            // Press down 3 times to reach end, then once more to wrap
            for (let index = 0; index < 4; index++) {
                // eslint-disable-next-line no-await-in-loop
                await act(async () => {
                    fireEvent.keyDown(document, { key: "ArrowDown" });
                });
            }

            const options = screen.getAllByRole("option");

            expect(options[0]?.className).toContain("bg-accent");
        });

        it("arrowUp wraps from first to last", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            // ArrowDown to first, then ArrowUp to wrap to last
            await act(async () => {
                fireEvent.keyDown(document, { key: "ArrowDown" });
            });
            await act(async () => {
                fireEvent.keyDown(document, { key: "ArrowUp" });
            });

            const options = screen.getAllByRole("option");

            expect(options[2]?.className).toContain("bg-accent");
        });

        it("enter selects the highlighted option", async () => {
            expect.hasAssertions();

            const onValueChange = vi.fn();

            render(<BasicSelect onValueChange={onValueChange} />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                fireEvent.keyDown(document, { key: "ArrowDown" });
            });

            await act(async () => {
                fireEvent.keyDown(document, { key: "Enter" });
            });

            expect(onValueChange).toHaveBeenCalledWith("apple");
        });

        it("enter on second option selects it", async () => {
            expect.hasAssertions();

            const onValueChange = vi.fn();

            render(<BasicSelect onValueChange={onValueChange} />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                fireEvent.keyDown(document, { key: "ArrowDown" });
            });
            await act(async () => {
                fireEvent.keyDown(document, { key: "ArrowDown" });
            });

            await act(async () => {
                fireEvent.keyDown(document, { key: "Enter" });
            });

            expect(onValueChange).toHaveBeenCalledWith("banana");
        });

        it("escape closes the dropdown", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("listbox")).toBeInTheDocument();

            await act(async () => {
                fireEvent.keyDown(document, { key: "Escape" });
            });

            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });

        it("tab closes the dropdown", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("listbox")).toBeInTheDocument();

            await act(async () => {
                fireEvent.keyDown(document, { key: "Tab" });
            });

            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });

        it("home highlights first option", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            // Navigate to last
            await act(async () => {
                fireEvent.keyDown(document, { key: "End" });
            });

            // Go to first
            await act(async () => {
                fireEvent.keyDown(document, { key: "Home" });
            });

            const options = screen.getAllByRole("option");

            expect(options[0]?.className).toContain("bg-accent");
        });

        it("end highlights last option", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                fireEvent.keyDown(document, { key: "End" });
            });

            const options = screen.getAllByRole("option");

            expect(options[2]?.className).toContain("bg-accent");
        });

        it("enter without highlight does nothing", async () => {
            expect.hasAssertions();

            const onValueChange = vi.fn();

            render(<BasicSelect onValueChange={onValueChange} />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                fireEvent.keyDown(document, { key: "Enter" });
            });

            expect(onValueChange).not.toHaveBeenCalled();
            // Dropdown should still be open
            expect(screen.getByRole("listbox")).toBeInTheDocument();
        });
    });

    // ─── Mouse highlight ────────────────────────────────────────────────────────

    describe("mouse highlight", () => {
        it("mouseEnter highlights the item", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const options = screen.getAllByRole("option");

            await act(async () => {
                fireEvent.mouseEnter(options[1]!);
            });

            expect(options[1]?.className).toContain("bg-accent");
        });
    });

    // ─── Search/filter ──────────────────────────────────────────────────────────

    describe("searchable", () => {
        it("renders search input when searchable=true", async () => {
            expect.hasAssertions();

            render(<BasicSelect searchable />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("combobox")).toBeInTheDocument();
        });

        it("does not render search input when searchable=false", async () => {
            expect.hasAssertions();

            render(<BasicSelect searchable={false} />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        });

        it("search input has aria-label", async () => {
            expect.hasAssertions();

            render(<BasicSelect searchable />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("combobox")).toHaveAttribute("aria-label", "Search options");
        });
    });

    // ─── Searchable filtering via useSelectContext ──────────────────────────────

    describe("search filtering with useSelectContext", () => {
        const FilteredItems = (): JSX.Element => {
            const { search } = useSelectContext();
            const query = search.toLowerCase();
            const filtered = query ? FRUITS.filter((opt) => opt.label.toLowerCase().includes(query)) : FRUITS;

            if (filtered.length === 0) {
                return <div data-testid="no-results">No results</div>;
            }

            return (
                <>
                    {filtered.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </>
            );
        };

        const SearchableSelect = ({ onValueChange }: { onValueChange?: (v: string) => void }): JSX.Element => (
            <Select onValueChange={onValueChange} value="">
                <SelectTrigger>
                    <SelectValue options={FRUITS} placeholder="Pick a fruit" />
                </SelectTrigger>
                <SelectContent searchable>
                    <FilteredItems />
                </SelectContent>
            </Select>
        );

        it("typing in search input filters items", async () => {
            expect.hasAssertions();

            render(<SearchableSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getAllByRole("option")).toHaveLength(3);

            const input = screen.getByRole("combobox");

            await act(async () => {
                fireEvent.input(input, { target: { value: "ban" } });
            });

            expect(screen.getAllByRole("option")).toHaveLength(1);
            expect(screen.getByText("Banana")).toBeInTheDocument();
        });

        it("search is case-insensitive", async () => {
            expect.hasAssertions();

            render(<SearchableSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const input = screen.getByRole("combobox");

            await act(async () => {
                fireEvent.input(input, { target: { value: "CHERRY" } });
            });

            expect(screen.getAllByRole("option")).toHaveLength(1);
            expect(screen.getByText("Cherry")).toBeInTheDocument();
        });

        it("shows no results message when search matches nothing", async () => {
            expect.hasAssertions();

            render(<SearchableSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const input = screen.getByRole("combobox");

            await act(async () => {
                fireEvent.input(input, { target: { value: "xyz" } });
            });

            expect(screen.queryAllByRole("option")).toHaveLength(0);
            expect(screen.getByTestId("no-results")).toBeInTheDocument();
        });

        it("search resets when dropdown closes", async () => {
            expect.hasAssertions();

            render(<SearchableSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const input = screen.getByRole("combobox");

            await act(async () => {
                fireEvent.input(input, { target: { value: "ban" } });
            });

            expect(screen.getAllByRole("option")).toHaveLength(1);

            // Close by clicking outside
            await act(async () => {
                fireEvent.mouseDown(document.body);
            });

            // Reopen
            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            // All items should be visible again
            expect(screen.getAllByRole("option")).toHaveLength(3);
        });

        it("selecting a filtered item calls onValueChange", async () => {
            expect.hasAssertions();

            const onValueChange = vi.fn();

            render(<SearchableSelect onValueChange={onValueChange} />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const input = screen.getByRole("combobox");

            await act(async () => {
                fireEvent.input(input, { target: { value: "cher" } });
            });

            await act(async () => {
                fireEvent.click(screen.getByText("Cherry"));
            });

            expect(onValueChange).toHaveBeenCalledWith("cherry");
        });
    });

    // ─── Accessibility ──────────────────────────────────────────────────────────

    describe("accessibility", () => {
        it("listbox has aria-activedescendant when an item is highlighted", async () => {
            expect.hasAssertions();

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            const listbox = screen.getByRole("listbox");

            // No highlight initially
            expect(listbox.getAttribute("aria-activedescendant")).toBeNull();

            // Highlight first
            await act(async () => {
                fireEvent.keyDown(document, { key: "ArrowDown" });
            });

            const activedescendant = listbox.getAttribute("aria-activedescendant");

            expect(activedescendant).not.toBeNull();

            // The id should match the first option's id
            const options = screen.getAllByRole("option");

            expect(activedescendant).toBe(options[0]?.id);
        });

        it("useSelectContext throws when used outside of Select", () => {
            expect.hasAssertions();

            const Bad = (): JSX.Element => {
                useSelectContext();

                return <div />;
            };

            expect(() => render(<Bad />)).toThrow("Select subcomponent must be used within <Select>");
        });
    });

    // ─── Positioning ────────────────────────────────────────────────────────────

    describe("positioning", () => {
        it("calls computePosition when opened", async () => {
            expect.hasAssertions();

            const { computePosition } = await import("@floating-ui/dom");

            render(<BasicSelect />);

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                await Promise.resolve();
            });

            expect(computePosition).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ placement: "bottom-start" }));
        });

        it("passes correct placement for align=end side=top", async () => {
            expect.hasAssertions();

            const { computePosition } = await import("@floating-ui/dom");

            render(
                <Select value="">
                    <SelectTrigger>
                        <SelectValue options={FRUITS} />
                    </SelectTrigger>
                    <SelectContent align="end" side="top">
                        <SelectItem value="apple">Apple</SelectItem>
                    </SelectContent>
                </Select>,
            );

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            await act(async () => {
                await Promise.resolve();
            });

            expect(computePosition).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ placement: "top-end" }));
        });
    });

    // ─── Custom class merging ───────────────────────────────────────────────────

    describe("custom classes", () => {
        it("merges custom class on SelectContent", async () => {
            expect.hasAssertions();

            render(
                <Select value="">
                    <SelectTrigger>
                        <SelectValue options={FRUITS} />
                    </SelectTrigger>
                    <SelectContent class="my-content">
                        <SelectItem value="apple">Apple</SelectItem>
                    </SelectContent>
                </Select>,
            );

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            // The content wrapper has the custom class
            const listbox = screen.getByRole("listbox");

            expect(listbox.parentElement).toHaveClass("my-content");
        });

        it("merges custom class on SelectItem", async () => {
            expect.hasAssertions();

            render(
                <Select value="">
                    <SelectTrigger>
                        <SelectValue options={FRUITS} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem class="my-item" value="apple">
                            Apple
                        </SelectItem>
                    </SelectContent>
                </Select>,
            );

            await act(async () => {
                fireEvent.click(screen.getByRole("button"));
            });

            expect(screen.getByRole("option")).toHaveClass("my-item");
        });
    });
});
