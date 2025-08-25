# Preline UI Integration with Flame Template

This document explains how Preline UI has been integrated into the Flame error template to reduce custom JavaScript code and provide better UI components.

## What is Preline UI?

Preline UI is an open-source set of prebuilt UI components based on the utility-first Tailwind CSS framework. It provides interactive components like tabs, collapsible sections, and other UI elements that reduce the need for custom JavaScript.

## Integration Benefits

- **Reduced JavaScript Code**: Replaced custom tab switching, collapse functionality, and other interactive elements with Preline UI components
- **Better Accessibility**: Preline UI components come with built-in accessibility features
- **Consistent Behavior**: Standardized component behavior across the error template
- **Easier Maintenance**: Less custom code to maintain and debug

## Components Replaced

### 1. Tabs System

- **Before**: Custom JavaScript for tab switching with manual state management
- **After**: Preline UI tabs using `data-hs-tabs` attributes
- **Classes**: `hs-tab-active:bg-gray-200 hs-tab-active:dark:bg-gray-700`

### 2. Collapsible Sections

- **Before**: Custom JavaScript for expanding/collapsing sections
- **After**: Preline UI collapse using `data-hs-collapse` attributes
- **Usage**: Checkboxes and details elements now use Preline UI collapse

### 3. Stack Trace Viewer

- **Before**: Custom tab management and group toggles
- **After**: Preline UI tabs and collapse components
- **Benefits**: Automatic state management and better accessibility

## CSS Integration via PostCSS

The template uses PostCSS to properly import and process Preline UI CSS:

### PostCSS Configuration

```javascript
// postcss.config.cjs
module.exports = {
    plugins: {
        "@tailwindcss/postcss": {},
        "postcss-focus-visible": {
            replaceWith: "[data-focus-visible-added]",
        },
        // Preline UI CSS imports
        "postcss-import": {
            path: ["node_modules"],
        },
    },
};
```

### CSS Structure

```css
// src/template/index.css
@import "tailwindcss";
@import "./preline.css";  // Preline UI imports

// ... rest of custom styles
```

```css
// src/template/preline.css
/* Preline UI imports */
@import "preline/dist/preline.css";
@import "preline/variants.css";
```

## JavaScript Changes

### Initialization

All Preline UI components are automatically initialized:

```javascript
// Initialize Preline UI components
if (typeof HSStaticMethods !== "undefined") {
    HSStaticMethods.autoInit();
}
```

### Component Usage

#### Tabs

```html
<button type="button" data-hs-tabs="#flame-section-stack" class="hs-tab-active:bg-gray-200">Stack</button>
<div id="flame-section-stack">
    <!-- Tab content -->
</div>
```

#### Collapse

```html
<input type="checkbox" data-hs-collapse="#details-section" />
<details id="details-section">
    <!-- Collapsible content -->
</details>
```

## Dependencies

Preline UI and PostCSS import plugin have been added as dependencies:

```json
{
    "dependencies": {
        "preline": "^2.0.3"
    },
    "devDependencies": {
        "postcss-import": "^16.1.0"
    }
}
```

## Installation

When using the Flame template, Preline UI will be automatically included. The template includes:

1. **PostCSS Processing**: Proper CSS import handling via PostCSS
2. **CSS Variants**: Imported through PostCSS pipeline
3. **JavaScript**: Included in the HTML layout
4. **Component Initialization**: Automatic setup on DOM ready

## Migration Notes

### For Existing Users

- No breaking changes to the template API
- All existing functionality preserved
- Better performance and accessibility out of the box

### For Developers

- Reduced JavaScript bundle size
- Easier to customize using Preline UI classes
- Better component consistency
- Proper PostCSS integration for CSS imports

## Browser Support

Preline UI supports all modern browsers and maintains the same browser compatibility as the original template.

## Troubleshooting

If Preline UI components don't work:

1. Check that the Preline JavaScript is loaded
2. Verify `HSStaticMethods.autoInit()` is called
3. Ensure proper `data-*` attributes are set
4. Check browser console for any errors
5. Verify PostCSS is processing the CSS imports correctly

## Future Enhancements

With Preline UI integration, we can easily add more interactive components:

- Modal dialogs
- Dropdown menus
- Tooltips
- Form validation
- And more...

## Resources

- [Preline UI Documentation](https://preline.co/docs/index.html)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Flame Template Documentation](https://www.visulima.com/docs/package/flame)
