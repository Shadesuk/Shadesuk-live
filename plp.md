# SHADESUK --- Product Listing / Collection Page

**Status:** Approved\
**Direction:** Product-first / editorial commerce / premium restraint\
**Primary objective:** Make product discovery immediate, fast and
visually premium while continuously increasing shopping intent.

------------------------------------------------------------------------

## 1. PLP North Star

The Product Listing Page should feel like a curated eyewear catalogue,
not a marketplace or generic ecommerce template.

The customer should be able to:

-   See products immediately
-   Understand important product information without opening the PDP
-   Compare products quickly
-   Filter efficiently
-   Discover additional products naturally
-   Enter a PDP when they want deeper information

Core principle:

> **Don't make the customer work to find the sunglasses.**

------------------------------------------------------------------------

# 2. Collection Header

The collection should begin with a restrained header.

Example:

**WOMEN'S SHADES**

A short supporting line may be used where useful.

Then:

**48 SHADES**

`FILTER` `SORT BY`

Do not use a large collection hero by default.

If the customer selected a collection, show the products quickly.

------------------------------------------------------------------------

# 3. Product Grid

### Desktop

Default:

**4-column grid**

The image area should dominate the card.

### Tablet

Adapt between 2--3 columns depending on available width.

### Mobile

Default:

**2-column grid**

Eyewear is highly visual and benefits from side-by-side comparison.

------------------------------------------------------------------------

# 4. Product Card

The product card is one of the most important reusable frontend
components.

### Required hierarchy

1.  Product image
2.  Product name
3.  Price
4.  **Available colour count**

Example:

**SHADES MODEL X**\
**£49**\
**4 COLOURS**

The number of available colour/variant options must be **visible
directly on the PLP**.

This information should not require the customer to open the PDP to
discover it.

### Why

Colour availability is a meaningful purchase consideration for eyewear.

Showing it directly:

-   Reduces unnecessary clicks
-   Improves product comparison
-   Communicates catalogue depth
-   Increases perceived choice
-   Helps customers identify products worth opening

### Colour presentation

The default PLP card should show a concise count such as:

**4 COLOURS**

Where appropriate, the count can be paired with small colour swatches,
but the numerical information should remain explicit.

Do not rely only on visual swatches to communicate the number of
options.

------------------------------------------------------------------------

# 5. Product Card Visual Treatment

Do not use conventional boxed cards.

Avoid:

-   Shadows
-   Large rounded containers
-   Heavy borders
-   Excessive badges
-   Decorative labels

Preferred structure:

``` text
PRODUCT IMAGE

PRODUCT NAME
£49
4 COLOURS
```

Open layout.

The product image remains the dominant visual element.

------------------------------------------------------------------------

# 6. Product Card Interaction

### Desktop

Hover may transition:

**Primary image → Secondary image**

where a meaningful secondary image exists.

The transition should be subtle.

### Mobile

Do not depend on hover.

Tapping the card/image/name opens the PDP.

### Quick Add

Not mandatory for V1.

The preferred initial behaviour is to let the PDP handle product
selection and purchase decisions.

Quick Add can be introduced later if testing demonstrates a genuine
conversion benefit.

------------------------------------------------------------------------

# 7. Filtering

Filters should be useful rather than exhaustive.

### Gender

-   Men
-   Women
-   Unisex

### Shape

Examples:

-   Aviator
-   Rectangle
-   Square
-   Oval
-   Cat Eye
-   Rimless
-   Other catalogue-supported shapes

### Colour

Examples:

-   Black
-   Brown
-   Clear
-   Tortoise
-   Other actual catalogue colours

### Price

Use practical price ranges.

### Availability

-   In stock

### Future metadata

Style filters may be introduced when the catalogue contains reliable
metadata.

Do not expose filters that produce poor or empty results.

------------------------------------------------------------------------

# 8. Desktop Filter UX

Do not permanently occupy a large portion of the screen with a sidebar.

Preferred structure:

``` text
WOMEN'S SHADES

48 SHADES

FILTER          SORT BY: FEATURED

────────────────────────────────

PRODUCT PRODUCT PRODUCT PRODUCT
PRODUCT PRODUCT PRODUCT PRODUCT
```

Clicking FILTER opens a refined filter panel.

This preserves product visibility and gives the grid more space.

------------------------------------------------------------------------

# 9. Mobile Filter UX

At the top:

**48 SHADES**

`FILTER` `SORT`

Filters open through a full-screen or bottom-sheet experience.

The controls should be large enough for comfortable touch interaction.

Example:

``` text
FILTER

Gender
○ Men
○ Women
○ Unisex

Shape
□ Aviator
□ Rectangle
□ Square
□ Oval

Colour
□ Black
□ Brown
□ Clear
□ Tortoise

Price
──────●──────

APPLY FILTER
```

------------------------------------------------------------------------

# 10. Sorting

Keep sorting intentionally simple.

Options:

-   Featured
-   Newest
-   Price: Low → High
-   Price: High → Low
-   Best Selling

Avoid excessive sorting options.

------------------------------------------------------------------------

# 11. Product Count

Show the number of products in the current collection/filter state.

Example:

**48 SHADES**

This should update when filters are applied.

------------------------------------------------------------------------

# 12. Progressive Product Discovery

Traditional pagination should not interrupt browsing unnecessarily.

Preferred V1 approach:

**Progressive loading / Load More**

Example:

``` text
PRODUCTS
↓
PRODUCTS
↓
PRODUCTS
↓
LOAD MORE SHADES
↓
MORE PRODUCTS
```

For V1, controlled **Load More** is preferred over uncontrolled infinite
scrolling.

This keeps the customer in context and ensures the footer remains
reachable.

------------------------------------------------------------------------

# 13. Editorial Inserts

The PLP may contain occasional editorial/discovery inserts between
product groups.

Example:

``` text
PRODUCT PRODUCT PRODUCT PRODUCT

┌────────────────────────────────┐
│                                │
│       EDITORIAL IMAGE          │
│                                │
│       FIND YOUR FRAME           │
│                                │
└────────────────────────────────┘

PRODUCT PRODUCT PRODUCT PRODUCT
```

These should be merchandising decisions, not a rigid automated rule such
as "every eight products."

Every editorial insert should have a commercial or discovery purpose.

It must not become decorative filler.

------------------------------------------------------------------------

# 14. Recently Viewed

Because eyewear can be a consideration purchase, the PLP should support:

**RECENTLY VIEWED**

This allows customers to return to products they have already inspected.

The exact placement can be determined during implementation and
usability testing.

------------------------------------------------------------------------

# 15. Recommendations

The frontend architecture should support contextual recommendations such
as:

-   More like this
-   More from Men
-   More from Women
-   More from Unisex
-   Explore black frames
-   Similar shapes

Recommendation logic will depend on backend product metadata.

The frontend should therefore use reusable recommendation components
rather than hard-coded layouts.

------------------------------------------------------------------------

# 16. Empty States

When filters return no results, avoid a dead-end message.

Example:

**NOTHING HERE YET**

Try removing a filter or explore our best sellers.

CTA:

**VIEW BEST SELLERS →**

The goal is to keep the customer moving through the catalogue.

------------------------------------------------------------------------

# 17. Search Relationship

Search results should use the same product-card system.

Example:

**AVIATOR**

**24 SHADES**

Same:

-   Product grid
-   Product cards
-   Colour counts
-   Filter
-   Sort
-   Progressive loading

Do not create a separate visual language for search.

------------------------------------------------------------------------

# 18. URL Architecture

Recommended examples:

``` text
/shop
/shop/men
/shop/women
/shop/unisex

/collections/aviator
/collections/rectangle
/collections/cat-eye
```

Product:

``` text
/product/[product-slug]
```

Keep URLs clean and scalable.

------------------------------------------------------------------------

# 19. Product Photography Requirement

Product imagery is a major part of the perceived quality of the PLP.

Product images should ideally have:

-   Consistent aspect ratio
-   Consistent crop logic
-   Consistent scale
-   Consistent background treatment
-   Consistent lighting
-   High resolution

Recommended image sequence where available:

-   Front
-   Side
-   Detail
-   On-model

No UI treatment can compensate for inconsistent product photography.

------------------------------------------------------------------------

# 20. PLP Visual Hierarchy

The hierarchy should remain:

**PRODUCT IMAGE**

↓

**PRODUCT NAME**

↓

**PRICE**

↓

**COLOUR COUNT**

Everything else is secondary.

The colour count is deliberately included because it communicates
meaningful product choice without requiring a PDP visit.

Avoid:

-   Giant sale badges
-   Discount stickers
-   Excessive rating displays
-   Fake urgency labels
-   Promotional clutter

------------------------------------------------------------------------

# 21. Premium Visual Standard

The PLP should feel expensive through:

-   Consistent photography
-   Disciplined grid
-   Precise typography
-   Generous spacing
-   Minimal UI
-   Strong product presentation

Not through:

-   Gold
-   Marble
-   Gradients
-   Heavy shadows
-   Excessive borders
-   Decorative luxury clichés

------------------------------------------------------------------------

# 22. Mobile Architecture

Mobile PLP:

``` text
HEADER
↓
COLLECTION TITLE
↓
PRODUCT COUNT
↓
FILTER | SORT
↓
2-COLUMN PRODUCT GRID
↓
DISCOVERY / EDITORIAL INSERT
↓
MORE PRODUCTS
↓
LOAD MORE
↓
RECENTLY VIEWED / RECOMMENDATIONS
↓
FOOTER
```

The product card remains compact but must preserve:

-   Product image
-   Name
-   Price
-   Colour count

------------------------------------------------------------------------

# 23. Anti-AI-Slop Rules

Do not use:

-   Generic card containers
-   Excessive rounded corners
-   Floating badges
-   Random decorative elements
-   Excessive shadows
-   Gradient backgrounds
-   Glassmorphism
-   Fake scarcity indicators
-   Unnecessary carousels
-   Over-animated product cards
-   Giant filter sidebars
-   Marketplace-style density

The product should be the visual focus.

------------------------------------------------------------------------

# 24. PLP Success Criteria

A customer should be able to:

1.  Understand which collection they are viewing.
2.  See products immediately.
3.  Know the price without opening the PDP.
4.  Know how many colour options a product has without opening the PDP.
5.  Filter by meaningful attributes.
6.  Sort without confusion.
7.  Compare multiple products quickly.
8.  Continue discovering products without repeatedly changing pages.
9.  Return to recently viewed products.
10. Enter the PDP when deeper information is required.

------------------------------------------------------------------------

# 25. PLP North Star

> **Show the product. Inform the customer. Remove friction. Let the
> catalogue sell itself.**
