import { z } from "zod";

const pageThemeSchema = z.strictObject({
    breadcrumb: z.boolean(),
    collapsed: z.boolean(),
    footer: z.boolean(),
    layout: z.enum(["default", "full", "raw"]),
    navbar: z.boolean(),
    pagination: z.boolean(),
    sidebar: z.boolean(),
    timestamp: z.boolean(),
    toc: z.boolean(),
    typesetting: z.enum(["default", "article"]),
});

/**
 * An option to control how an item should be displayed in the sidebar:
 * - `normal`: the default behavior, item will be displayed
 * - `hidden`: the item will not be displayed in the sidebar entirely
 * - `children`: if the item is a folder, itself will be hidden but all its children will still be processed
 */
const displaySchema = z.enum(["normal", "hidden", "children"]);
const titleSchema = z.string();

const linkItemSchema = z.strictObject({
    href: z.string(),
    newWindow: z.boolean(),
    title: titleSchema,
});

const menuItemSchema = z.strictObject({
    display: displaySchema.optional(),
    items: z.record(linkItemSchema.partial({ href: true, newWindow: true })),
    title: titleSchema,
    type: z.literal("menu"),
});

const separatorItemSchema = z.strictObject({
    title: titleSchema,
    type: z.literal("separator"),
});

const itemSchema = linkItemSchema
    .extend({
        display: displaySchema,
        theme: pageThemeSchema,
        title: titleSchema,
        type: z.enum(["page", "doc"]),
    })
    .deepPartial();

export type Display = z.infer<typeof displaySchema>;
export type IMenuItem = z.infer<typeof menuItemSchema>;

export const metaSchema = z.string().or(menuItemSchema).or(separatorItemSchema).or(itemSchema);
