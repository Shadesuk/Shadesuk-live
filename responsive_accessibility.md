# SHADESUK — Responsive System + Accessibility Specification

**Document:** Responsive System + Accessibility  
**Project:** SHADESUK  
**Scope:** Frontend / UI / UX / Accessibility / Responsive Behaviour  
**Status:** LOCKED  
**Purpose:** Single source of truth for responsive layouts and accessibility standards

---

# 1. Purpose

This document defines how the SHADESUK frontend behaves across mobile, tablet, desktop, and large desktop screens.

The core rule is:

> **Responsive design changes hierarchy and interaction — it does not simply shrink desktop layouts.**

Accessibility is a first-class requirement and must be implemented at component level rather than added at the end.

---

# 2. Breakpoint System

Use content-driven breakpoints rather than designing around individual devices.

```text
< 768px       Mobile
768–1199px    Tablet
1200px+       Desktop
1440px+       Large Desktop refinement
```

These are implementation guides, not rigid device assumptions.

Layouts should respond intelligently to available space.

---

# 3. Product Grid

Locked grid direction:

```text
Mobile       2 columns
Tablet       3 columns
Desktop      4 columns
Large        4 columns
```

Large desktop must not automatically become a 5–6 column catalogue.

At larger widths, increase whitespace and content breathing room instead.

---

# 4. Mobile Is Purpose-Built

Mobile layouts must not be desktop layouts compressed into a narrow viewport.

Information hierarchy may change.

For example, PDP desktop:

```text
Gallery              Product Information
                      Brand
                      Model
                      Price
                      Colour
                      Size
                      Find Your Fit
                      Add to Bag
```

Mobile:

```text
Header
Gallery
Brand
Model
Price
Colour
Size / Fit
Find Your Fit
Quantity
Add to Bag
Shipping
Payment
Details
```

The customer journey remains clear and conversion-focused.

---

# 5. Mobile Header

Recommended structure:

```text
[Menu] [SHADESUK] [Search] [Bag]
```

Keep the header compact.

Account remains accessible through the navigation system.

---

# 6. Mobile Navigation — Locked Direction

Use a **slide-in hierarchical navigation drawer**.

First level:

```text
SHOP                         >
NEW ARRIVALS
BEST SELLERS
COLLECTIONS                  >
ABOUT
ACCOUNT
```

Opening SHOP:

```text
← SHOP

MEN
WOMEN
UNISEX

BRANDS                       >
SHAPES                       >
STYLES                       >
```

This approach is locked because it scales better as Brands, Gender, Shape, and Style expand.

Do not make the first mobile menu an overwhelming list of every catalogue category.

---

# 7. Mobile Navigation Behaviour

Requirements:

- Full-height or near-full-height drawer
- Clear back control
- Clear close control
- Hierarchical navigation
- Predictable transitions
- Focus management
- Escape to close
- Scroll handling
- No background interaction while the drawer is active

The user should always know which navigation level they are currently viewing.

---

# 8. Mobile Product Grid

Two-column grid is locked.

Products should have sufficient image area and readable metadata.

Example:

```text
┌───────────┐ ┌───────────┐
│           │ │           │
│  PRODUCT  │ │  PRODUCT  │
│           │ │           │
├───────────┤ ├───────────┤
│ BRAND     │ │ BRAND     │
│ MODEL     │ │ MODEL     │
│ £49       │ │ £55       │
│ 4 COLOURS │ │ 2 COLOURS │
└───────────┘ └───────────┘
```

No card backgrounds are required.

---

# 9. Mobile Filters

Mobile filtering uses a dedicated drawer or bottom sheet.

Structure:

```text
FILTERS

Gender
Brand
Shape
Colour
Price
Availability

CLEAR ALL

APPLY
```

The Apply control should remain accessible, preferably sticky at the bottom of the drawer.

---

# 10. Mobile PDP Sticky Purchase Bar

The mobile PDP should use a sticky purchase bar only after the primary Add to Bag CTA has scrolled out of view.

Example:

```text
────────────────────────
£49              ADD TO BAG
────────────────────────
```

Do not show it immediately on page load.

It should support safe-area spacing on devices with a home indicator.

---

# 11. Tablet System

Tablet should use adaptive layouts rather than a separate design for every page.

## Navigation

Desktop navigation may collapse earlier when available width becomes insufficient.

## PLP

Use approximately 3 columns.

## PDP

If a two-column layout becomes cramped, transition to a more vertical structure:

```text
Gallery
────────────
Product Information
```

## Checkout

Use one or two columns depending on available space.

The layout must respond to content width, not simply device labels.

---

# 12. Large Desktop

At 1440px+:

- Maintain controlled content width
- Increase outer margins
- Preserve editorial whitespace
- Avoid excessive product density
- Keep text lines readable

Do not stretch the interface edge-to-edge simply because the viewport is wide.

A large monitor should make SHADESUK feel more spacious, not more crowded.

---

# 13. Typography

Use a defined responsive typography scale.

Core levels:

```text
Display
H1
H2
H3
Body
Small
Micro
```

Each level receives controlled desktop and mobile sizing.

Avoid arbitrary page-by-page font overrides.

Hero typography should scale down deliberately while maintaining hierarchy.

---

# 14. Spacing System

Use a controlled spacing vocabulary.

Recommended base scale:

```text
4
8
12
16
24
32
48
64
80
96
120
```

Not every component must use every value.

The purpose is consistency and predictable rhythm.

Avoid unexplained values such as random 73px or 91px margins unless there is a clear layout reason.

---

# 15. Mobile Safe Areas

Account for device safe areas where necessary.

Especially:

- Sticky Add to Bag
- Bottom drawers
- Mobile navigation
- Checkout controls
- Fixed UI elements

Use appropriate safe-area handling so controls are not obscured by device UI.

---

# 16. Accessibility Standard

Target:

> **WCAG 2.2 AA**

Accessibility is not optional.

Requirements include:

- Keyboard access
- Screen-reader compatibility
- Sufficient contrast
- Visible focus
- Logical headings
- Accessible forms
- Accessible errors
- Accessible dialogs
- Accessible drawers
- Accessible navigation
- Reduced-motion support

---

# 17. Colour Contrast

Do not assume that the palette automatically passes accessibility requirements.

Test actual combinations, especially:

- Small text
- Secondary text
- Footer text
- Disabled states
- Button text
- Metadata

The SHADESUK palette should remain premium without sacrificing readability.

---

# 18. Focus States

Every interactive element must have a clearly visible focus state.

Includes:

- Buttons
- Links
- Inputs
- Product cards
- Navigation
- Filters
- Selects
- Quantity controls

Do not remove browser focus indicators without providing an equally or more accessible replacement.

The final focus treatment should be visually restrained and consistent with the SHADESUK identity.

---

# 19. Keyboard Navigation

Support:

```text
Tab
Shift + Tab
Enter
Space
Arrow keys where applicable
Escape
```

Examples:

### Search

```text
Type
↓
Arrow through suggestions
↓
Enter
```

### Navigation

```text
Tab
↓
SHOP
↓
Open
↓
Navigate
```

### Filters

```text
Open
↓
Navigate
↓
Select
↓
Apply
```

### Modal / Drawer

Focus enters the active component and does not escape behind it.

---

# 20. Screen Readers

Components must communicate meaningful information.

Avoid generic labels such as:

```text
button
image
link
```

where a more descriptive accessible name is possible.

Examples:

```text
Add Aviator Black to bag
```

Product imagery should receive meaningful alternative text where informative.

Decorative imagery should be excluded from the accessibility tree where appropriate.

---

# 21. Product Card Accessibility

Product cards should expose a coherent product destination.

The semantic experience should not become a confusing sequence of:

```text
Image
Brand
Model
Price
Button
Button
Link
```

The implementation should provide a natural, predictable way to discover and open the product.

Interactive controls inside cards, such as swatches, must remain independently accessible where they exist.

---

# 22. Forms

All account and checkout forms require:

- Explicit labels
- Required-field indication
- Inline validation
- Programmatically associated errors
- Correct autocomplete attributes
- Keyboard support
- Logical tab order

Placeholder text must never replace a proper field label.

---

# 23. Address Form Accessibility

Address fields should use appropriate browser autocomplete semantics.

Example:

```text
Name
Address
City
Postcode
Country
```

Address autocomplete suggestions must be keyboard accessible and touch friendly.

Manual entry must remain available.

---

# 24. Error Accessibility

Errors must not rely only on red colour.

Example:

```text
Postcode

[             ]

Please enter a valid UK postcode.
```

The message should be programmatically associated with the relevant field.

Checkout errors should focus the user's attention intelligently without destroying entered information.

---

# 25. Touch Targets

Interactive mobile controls must be comfortably tappable.

Especially:

- Close buttons
- Filter controls
- Quantity controls
- Product cards
- Navigation
- Bag
- Sticky CTA

Avoid tiny interaction targets and tightly packed controls.

---

# 26. Orientation

The site must remain usable in:

- Portrait
- Landscape

This is especially important for:

- Mobile
- Tablets
- Checkout
- PDP gallery
- Navigation

Do not assume portrait orientation.

---

# 27. Browser Support

Test current versions of:

- Chrome
- Safari
- Edge
- Firefox
- iOS Safari
- Android Chrome

The same design system should be maintained across browsers.

Do not create browser-specific visual systems unless a technical limitation requires one.

---

# 28. Responsive Images

Responsive behaviour includes image delivery, not only layout.

Use:

- Responsive image sources
- Correct intrinsic dimensions
- Lazy loading below the fold
- Appropriate image formats
- Compression
- Reserved image space

A mobile user should not unnecessarily download a large desktop asset.

This is particularly important because SHADESUK is an image-heavy ecommerce experience.

---

# 29. Layout Stability

Avoid cumulative layout shift.

Reserve dimensions for:

- Product images
- PDP gallery
- Product cards
- Fonts where possible
- Dynamic UI elements

Loading content should not unexpectedly push the page around.

---

# 30. Reduced Motion

Respect:

```text
prefers-reduced-motion: reduce
```

Reduce or remove:

- Page transitions
- Drawer animation
- Hover movement
- Image movement
- Decorative motion

The interface must remain completely functional without animation.

---

# 31. Mobile Performance

Mobile layouts should prioritise:

- Fast first render
- Optimised imagery
- Minimal blocking JavaScript
- Progressive loading
- Efficient interactions
- Stable layout
- Minimal unnecessary animation

Do not sacrifice performance for visual effects.

---

# 32. Responsive Component Rules

Every reusable component must define behaviour for:

```text
Mobile
Tablet
Desktop
Large Desktop
```

Where a component does not require a unique layout at a breakpoint, it should simply scale/adapt naturally.

Do not create breakpoint-specific code without a real UX reason.

---

# 33. Content Behaviour

Responsive design must account for real content.

Components must survive:

- Long brand names
- Long product names
- Larger prices
- Different colour counts
- Longer error messages
- Multiple filter selections
- Larger text settings
- Translation expansion if introduced later

Do not design only around ideal short strings.

---

# 34. Zoom / Text Scaling

The site should remain usable when users increase browser zoom or text size.

Do not rely on fixed pixel positioning that breaks when content grows.

Important areas:

- Header
- Navigation
- Product cards
- PDP
- Checkout
- Forms
- Order tracking

---

# 35. Accessibility of Drawers

Every drawer must:

- Announce an appropriate accessible name
- Move focus into the drawer
- Keep focus inside while active
- Provide close control
- Support Escape
- Restore focus to the trigger after closing

Background content must not remain interactable while the drawer is active.

---

# 36. Accessibility of Modals

Every modal must:

- Have a clear title
- Have an accessible name
- Trap focus appropriately
- Support Escape where appropriate
- Restore focus
- Prevent accidental background interaction
- Remain usable on mobile

---

# 37. Accessibility of Search

Search must support:

- Keyboard input
- Suggestion navigation
- Screen-reader announcement where appropriate
- Escape
- Clear action
- Touch interaction
- Focus restoration

Users should be able to complete search without a mouse.

---

# 38. Accessibility of Filters

Filters must expose:

- Current selected state
- Filter labels
- Expand/collapse state
- Result changes where appropriate
- Clear All
- Apply
- Keyboard access

Do not communicate selected filters only through colour.

---

# 39. Responsive QA Checklist

Before release, test:

### Mobile

- 320px
- 360px
- 390px
- 430px

### Tablet

- 768px
- 834px
- 1024px
- 1199px

### Desktop

- 1200px
- 1280px
- 1440px
- 1600px+

Exact QA devices may vary, but these widths should be represented during testing.

---

# 40. Accessibility QA Checklist

Test:

- Keyboard-only navigation
- Screen reader
- Focus visibility
- Contrast
- Form errors
- Modal focus
- Drawer focus
- Search suggestions
- Filter controls
- Quantity controls
- Checkout flow
- Reduced motion
- Zoom/text scaling
- Touch interaction

---

# 41. Locked Decisions

### Breakpoints

```text
<768       Mobile
768–1199   Tablet
1200+      Desktop
1440+      Large Desktop refinement
```

### Product grid

```text
Mobile   2
Tablet   3
Desktop  4
Large    4
```

### Mobile navigation

**B — Hierarchical slide-in navigation drawer**

```text
SHOP >
NEW ARRIVALS
BEST SELLERS
COLLECTIONS >
ABOUT
ACCOUNT
```

Then:

```text
← SHOP

MEN
WOMEN
UNISEX
BRANDS >
SHAPES >
STYLES >
```

### Accessibility

**WCAG 2.2 AA**

### Motion

Subtle, functional, and reduced-motion aware.

### Layout

Content-driven rather than device-specific.

### Typography

Defined responsive scale.

### Spacing

Controlled spacing tokens.

---

# 42. Final Principle

SHADESUK should feel premium at every viewport.

A customer using a phone should not feel like they are using a reduced version of the desktop website.

They should feel that the site was intentionally designed for the device in their hand.

The implementation priority is:

**Clarity → Accessibility → Performance → Responsiveness → Visual polish**

**This specification is locked for Responsive System + Accessibility.**
