// =============================================================================
// Layout Mode Types
// =============================================================================

export type ComponentType
    = | "navigation"
        | "hero"
        | "card"
        | "button"
        | "sidebar"
        | "table"
        | "form"
        | "input"
        | "modal"
        | "footer"
        | "avatar"
        | "badge"
        | "text"
        | "image"
        | "list"
        | "tabs"
        | "header"
        | "section"
        | "grid"
        | "dropdown"
        | "toggle"
        | "breadcrumb"
        | "pagination"
        | "progress"
        | "divider"
        | "accordion"
        | "carousel"
        | "chart"
        | "video"
        | "search"
        | "toast"
        | "tooltip"
        | "pricing"
        | "testimonial"
        | "cta"
        | "alert"
        | "banner"
        | "stat"
        | "stepper"
        | "tag"
        | "rating"
        | "map"
        | "timeline"
        | "fileUpload"
        | "codeBlock"
        | "calendar"
        | "notification"
        | "productCard"
        | "profile"
        | "drawer"
        | "popover"
        | "logo"
        | "faq"
        | "gallery"
        | "checkbox"
        | "radio"
        | "slider"
        | "datePicker"
        | "skeleton"
        | "chip"
        | "icon"
        | "spinner"
        | "feature"
        | "team"
        | "login"
        | "contact";

export type DesignPlacement = {
    height: number;
    id: string;
    scrollY: number;
    text?: string;
    timestamp: number;
    type: ComponentType;
    width: number;
    x: number;
    y: number;
};

export type ComponentDefinition = {
    height: number;
    label: string;
    type: ComponentType;
    width: number;
};

export type ComponentSection = {
    items: ComponentDefinition[];
    section: string;
};

// Default sizes for each component type
export const DEFAULT_SIZES: Record<ComponentType, { height: number; width: number }> = {
    accordion: { height: 200, width: 400 },
    alert: { height: 56, width: 400 },
    avatar: { height: 48, width: 48 },
    badge: { height: 28, width: 80 },
    banner: { height: 48, width: 800 },
    breadcrumb: { height: 24, width: 300 },
    button: { height: 40, width: 140 },
    calendar: { height: 300, width: 300 },
    card: { height: 240, width: 280 },
    carousel: { height: 300, width: 600 },
    chart: { height: 240, width: 400 },
    checkbox: { height: 20, width: 20 },
    chip: { height: 32, width: 96 },
    codeBlock: { height: 200, width: 480 },
    contact: { height: 320, width: 400 },
    cta: { height: 160, width: 600 },
    datePicker: { height: 320, width: 300 },
    divider: { height: 1, width: 600 },
    drawer: { height: 400, width: 320 },
    dropdown: { height: 200, width: 200 },
    faq: { height: 320, width: 560 },
    feature: { height: 200, width: 360 },
    fileUpload: { height: 180, width: 360 },
    footer: { height: 160, width: 800 },
    form: { height: 320, width: 360 },
    gallery: { height: 360, width: 560 },
    grid: { height: 300, width: 600 },
    header: { height: 80, width: 800 },
    hero: { height: 320, width: 800 },
    icon: { height: 24, width: 24 },
    image: { height: 200, width: 320 },
    input: { height: 56, width: 280 },
    list: { height: 180, width: 300 },
    login: { height: 360, width: 360 },
    logo: { height: 40, width: 120 },
    map: { height: 300, width: 480 },
    modal: { height: 300, width: 480 },
    navigation: { height: 56, width: 800 },
    notification: { height: 72, width: 360 },
    pagination: { height: 36, width: 300 },
    popover: { height: 160, width: 240 },
    pricing: { height: 360, width: 300 },
    productCard: { height: 360, width: 280 },
    profile: { height: 200, width: 280 },
    progress: { height: 8, width: 240 },
    radio: { height: 20, width: 20 },
    rating: { height: 28, width: 160 },
    search: { height: 44, width: 320 },
    section: { height: 400, width: 800 },
    sidebar: { height: 400, width: 240 },
    skeleton: { height: 120, width: 320 },
    slider: { height: 32, width: 240 },
    spinner: { height: 32, width: 32 },
    stat: { height: 120, width: 200 },
    stepper: { height: 48, width: 480 },
    table: { height: 220, width: 560 },
    tabs: { height: 240, width: 480 },
    tag: { height: 28, width: 72 },
    team: { height: 280, width: 560 },
    testimonial: { height: 200, width: 360 },
    text: { height: 120, width: 400 },
    timeline: { height: 320, width: 360 },
    toast: { height: 64, width: 320 },
    toggle: { height: 24, width: 44 },
    tooltip: { height: 40, width: 180 },
    video: { height: 270, width: 480 },
};

// Component registry with sections and labels
export const COMPONENT_REGISTRY: ComponentSection[] = [
    {
        items: [
            { label: "Navigation", type: "navigation", ...DEFAULT_SIZES.navigation },
            { label: "Header", type: "header", ...DEFAULT_SIZES.header },
            { label: "Hero", type: "hero", ...DEFAULT_SIZES.hero },
            { label: "Section", type: "section", ...DEFAULT_SIZES.section },
            { label: "Sidebar", type: "sidebar", ...DEFAULT_SIZES.sidebar },
            { label: "Footer", type: "footer", ...DEFAULT_SIZES.footer },
            { label: "Modal", type: "modal", ...DEFAULT_SIZES.modal },
            { label: "Banner", type: "banner", ...DEFAULT_SIZES.banner },
            { label: "Drawer", type: "drawer", ...DEFAULT_SIZES.drawer },
            { label: "Popover", type: "popover", ...DEFAULT_SIZES.popover },
            { label: "Divider", type: "divider", ...DEFAULT_SIZES.divider },
        ],
        section: "Layout",
    },
    {
        items: [
            { label: "Card", type: "card", ...DEFAULT_SIZES.card },
            { label: "Text", type: "text", ...DEFAULT_SIZES.text },
            { label: "Image", type: "image", ...DEFAULT_SIZES.image },
            { label: "Video", type: "video", ...DEFAULT_SIZES.video },
            { label: "Table", type: "table", ...DEFAULT_SIZES.table },
            { label: "Grid", type: "grid", ...DEFAULT_SIZES.grid },
            { label: "List", type: "list", ...DEFAULT_SIZES.list },
            { label: "Chart", type: "chart", ...DEFAULT_SIZES.chart },
            { label: "Code Block", type: "codeBlock", ...DEFAULT_SIZES.codeBlock },
            { label: "Map", type: "map", ...DEFAULT_SIZES.map },
            { label: "Timeline", type: "timeline", ...DEFAULT_SIZES.timeline },
            { label: "Calendar", type: "calendar", ...DEFAULT_SIZES.calendar },
            { label: "Accordion", type: "accordion", ...DEFAULT_SIZES.accordion },
            { label: "Carousel", type: "carousel", ...DEFAULT_SIZES.carousel },
            { label: "Logo", type: "logo", ...DEFAULT_SIZES.logo },
            { label: "FAQ", type: "faq", ...DEFAULT_SIZES.faq },
            { label: "Gallery", type: "gallery", ...DEFAULT_SIZES.gallery },
        ],
        section: "Content",
    },
    {
        items: [
            { label: "Button", type: "button", ...DEFAULT_SIZES.button },
            { label: "Input", type: "input", ...DEFAULT_SIZES.input },
            { label: "Search", type: "search", ...DEFAULT_SIZES.search },
            { label: "Form", type: "form", ...DEFAULT_SIZES.form },
            { label: "Tabs", type: "tabs", ...DEFAULT_SIZES.tabs },
            { label: "Dropdown", type: "dropdown", ...DEFAULT_SIZES.dropdown },
            { label: "Toggle", type: "toggle", ...DEFAULT_SIZES.toggle },
            { label: "Stepper", type: "stepper", ...DEFAULT_SIZES.stepper },
            { label: "Rating", type: "rating", ...DEFAULT_SIZES.rating },
            { label: "File Upload", type: "fileUpload", ...DEFAULT_SIZES.fileUpload },
            { label: "Checkbox", type: "checkbox", ...DEFAULT_SIZES.checkbox },
            { label: "Radio", type: "radio", ...DEFAULT_SIZES.radio },
            { label: "Slider", type: "slider", ...DEFAULT_SIZES.slider },
            { label: "Date Picker", type: "datePicker", ...DEFAULT_SIZES.datePicker },
        ],
        section: "Controls",
    },
    {
        items: [
            { label: "Avatar", type: "avatar", ...DEFAULT_SIZES.avatar },
            { label: "Badge", type: "badge", ...DEFAULT_SIZES.badge },
            { label: "Tag", type: "tag", ...DEFAULT_SIZES.tag },
            { label: "Breadcrumb", type: "breadcrumb", ...DEFAULT_SIZES.breadcrumb },
            { label: "Pagination", type: "pagination", ...DEFAULT_SIZES.pagination },
            { label: "Progress", type: "progress", ...DEFAULT_SIZES.progress },
            { label: "Alert", type: "alert", ...DEFAULT_SIZES.alert },
            { label: "Toast", type: "toast", ...DEFAULT_SIZES.toast },
            { label: "Notification", type: "notification", ...DEFAULT_SIZES.notification },
            { label: "Tooltip", type: "tooltip", ...DEFAULT_SIZES.tooltip },
            { label: "Stat", type: "stat", ...DEFAULT_SIZES.stat },
            { label: "Skeleton", type: "skeleton", ...DEFAULT_SIZES.skeleton },
            { label: "Chip", type: "chip", ...DEFAULT_SIZES.chip },
            { label: "Icon", type: "icon", ...DEFAULT_SIZES.icon },
            { label: "Spinner", type: "spinner", ...DEFAULT_SIZES.spinner },
        ],
        section: "Elements",
    },
    {
        items: [
            { label: "Pricing", type: "pricing", ...DEFAULT_SIZES.pricing },
            { label: "Testimonial", type: "testimonial", ...DEFAULT_SIZES.testimonial },
            { label: "CTA", type: "cta", ...DEFAULT_SIZES.cta },
            { label: "Product Card", type: "productCard", ...DEFAULT_SIZES.productCard },
            { label: "Profile", type: "profile", ...DEFAULT_SIZES.profile },
            { label: "Feature", type: "feature", ...DEFAULT_SIZES.feature },
            { label: "Team", type: "team", ...DEFAULT_SIZES.team },
            { label: "Login", type: "login", ...DEFAULT_SIZES.login },
            { label: "Contact", type: "contact", ...DEFAULT_SIZES.contact },
        ],
        section: "Blocks",
    },
];

// Flat lookup map
export const COMPONENT_MAP: Record<string, ComponentDefinition> = {};

for (const section of COMPONENT_REGISTRY) {
    for (const item of section.items) {
        COMPONENT_MAP[item.type] = item;
    }
}

// =============================================================================
// Blank Canvas Types
// =============================================================================

export type CanvasPurpose = "new-page" | "replace-current";

export type WireframeOptions = {
    wireframePurpose?: string;
};

// =============================================================================
// Rearrange Mode Types
// =============================================================================

export type SectionRect = { height: number; width: number; x: number; y: number };

export type DetectedSection = {
    className: string | null;
    currentRect: SectionRect;
    id: string;
    isFixed?: boolean;
    label: string;
    note?: string;
    originalIndex: number;
    originalRect: SectionRect;
    role: string | null;
    selector: string;
    tagName: string;
    textSnippet: string | null;
};

export type RearrangeState = {
    detectedAt: number;
    originalOrder: string[];
    sections: DetectedSection[];
};
