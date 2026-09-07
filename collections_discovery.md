# SHADESUK — Collections & Discovery Frontend Specification

**Document:** Collections & Discovery System  
**Project:** SHADESUK  
**Scope:** Frontend / UI / UX / Information Architecture  
**Status:** LOCKED  
**Purpose:** Single source of truth for implementation

---

## 1. Purpose

The SHADESUK catalogue must feel deep, premium, and easy to explore without becoming complicated.

Discovery should allow customers to move naturally between:

- Gender
- Brands
- Shapes
- Styles
- New Arrivals
- Best Sellers
- Search
- Product pages

The system must remain scalable as the catalogue grows.

The core principle is:

> **More ways to discover products, not more complexity.**

---

# 2. Core Discovery Dimensions

SHADESUK products are organised through multiple attributes rather than isolated catalogue silos.

## 2.1 WHO — Gender

Primary gender discovery:

- Men
- Women
- Unisex

Gender is a catalogue attribute and filter.

A product may belong to one or more gender contexts depending on the product data.

---

## 2.2 BRAND

Brands are a first-class discovery dimension.

Customers must be able to browse products by brand.

Brand architecture:

- View All Brands
- Individual Brand pages
- Brand filtering
- Brand visibility on product cards
- Brand visibility on PDPs

Example:

```text
/brands
/brands/[brand-slug]
```

Brand is a product attribute, not merely a manually created collection.

A product may belong to:

```text
Brand
+ Gender
+ Shape
+ Style
+ Colour
+ Price
+ Availability
+ New Arrival
+ Best Seller
```

This allows the same product to participate in multiple discovery paths.

### Brand scalability

The interface must support a small catalogue initially and scale to a much larger catalogue.

If the brand catalogue becomes large:

- Alphabetical grouping may be introduced
- Brand search may be introduced
- "View All Brands" becomes the primary discovery page
- The header/mega menu must not become excessively large

Do not create an oversized brand wall merely for the sake of showing brands.

---

## 2.3 WHAT — Merchandising

Primary merchandising collections:

- New Arrivals
- Best Sellers

Routes:

```text
/new-arrivals
/best-sellers
```

These are dynamic catalogue states rather than permanent manual collections where possible.

---

## 2.4 SHAPE

Core shape discovery may include:

- Aviator
- Rectangle
- Square
- Round
- Cat-Eye

Additional shapes should only be added when the catalogue contains enough meaningful products to justify them.

Routes:

```text
/collections/aviator
/collections/rectangle
/collections/square
/collections/round
```

Do not create collection pages for insignificant or poorly populated categories.

---

## 2.5 STYLE

Style collections should be restrained and catalogue-supported.

Potential examples:

- Everyday
- Minimal
- Statement
- Vintage-inspired

These should only exist when they represent a meaningful merchandising idea.

Avoid creating dozens of artificial style categories.

Routes:

```text
/collections/[style-slug]
```

---

# 3. Header Navigation

Primary header:

```text
SHADESUK logo

SHOP
NEW ARRIVALS
BEST SELLERS
COLLECTIONS
ABOUT

Search
Account
Bag
```

The logo links to Home.

There should be no separate "Home" navigation item.

---

# 4. SHOP Navigation

SHOP should act as the main discovery gateway.

The desktop interaction can use a restrained dropdown / mega menu.

It should contain:

### Shop by Gender

- Men
- Women
- Unisex

### Shop by Brand

- Selected/high-value brands
- View All Brands

### Shop by Shape

- Aviator
- Rectangle
- Square
- Round
- Cat-Eye
- Other meaningful shapes

### Shop by Style

- Meaningful style categories only

The menu should remain compact.

Do not create:

- giant tile-based mega menus
- excessive imagery
- unnecessary decorative sections
- dozens of links
- overly complex navigation trees

The purpose is discovery, not decoration.

---

# 5. Brand Discovery

Brands should be discoverable from multiple locations.

## Header

SHOP → Shop by Brand

## Brand Index

```text
/brands
```

The brand index should provide:

- Brand name
- Optional short descriptor
- Product count where useful
- Search if the number of brands becomes large
- Alphabetical grouping when appropriate

The page should remain editorial and minimal.

---

## Individual Brand Page

```text
/brands/[brand-slug]
```

Recommended structure:

1. Header
2. Brand title
3. Optional short brand introduction
4. Product count
5. Filters
6. Sort
7. Product grid
8. Load More / controlled pagination
9. Recently Viewed
10. Footer

Example:

```text
BRAND NAME

24 PRODUCTS

[filters] [sort]

Product Product Product Product
Product Product Product Product
...
```

Do not force a large brand hero section if the available brand content does not justify one.

Product exposure should remain the priority.

---

# 6. Gender Discovery

Gender routes:

```text
/men
/women
/unisex
```

These pages use the same catalogue system as other collection pages.

They should support:

- Product grid
- Brand filter
- Shape filter
- Colour filter
- Price filter
- Availability filter
- Sort
- Product count
- Controlled loading

Gender should not require duplicated product records.

---

# 7. Shape Discovery

Shape collection pages provide a natural bridge between browsing and the Fit Guide.

Example:

```text
Round Face
↓
Rectangle / Square / Angular frames
↓
Explore Rectangle
```

Shape pages should therefore be compatible with the Face & Size Guide.

Potential user journey:

```text
PDP
↓
Find Your Fit
↓
Know Your Face
↓
Recommended Shapes
↓
Shape Collection
↓
Products
```

Recommendations should be presented as guidance, not absolute rules.

---

# 8. Style Discovery

Style collections should be used for merchandising rather than technical filtering.

Examples:

```text
Everyday
Minimal
Statement
Vintage-inspired
```

Only introduce a style collection when:

- Enough products exist
- The style has a clear customer-facing meaning
- The collection can be maintained consistently

Avoid arbitrary tags becoming public collection pages.

---

# 9. Standard Collection Page

All major collection/discovery pages should share the same foundational structure.

```text
HEADER

COLLECTION TITLE
Optional short introduction

PRODUCT COUNT
FILTERS
SORT

PRODUCT GRID

Optional editorial insert

MORE PRODUCTS

RECENTLY VIEWED

FOOTER
```

The page should be product-first.

The collection title should clearly communicate context:

```text
NEW ARRIVALS
WOMEN
AVIATOR
BRAND NAME
BEST SELLERS
```

---

# 10. Product Grid

Desktop:

**4 columns**

Tablet:

**3–4 columns depending on available width**

Mobile:

**2 columns**

There should be no unnecessary card containers.

Product cards should feel like part of the page rather than boxed UI components.

---

# 11. Product Card

The same ProductCard component must be reused across:

- Homepage
- PLP
- Search
- Brand pages
- Gender pages
- Shape pages
- Style pages
- New Arrivals
- Best Sellers
- Recommendations
- Recently Viewed

Required information:

```text
[Product Image]

BRAND NAME
MODEL NAME

£49
4 COLOURS
```

The available colour count is mandatory.

Example:

> SHADES MODEL X  
> £49 · 4 COLOURS

Brand should be visible on the product card where the final visual hierarchy supports it.

Optional:

- Colour swatches
- New badge
- Best Seller indicator

Do not overload the card with badges.

---

# 12. Filtering

All collection/discovery pages should share the same filter system.

Core filters:

- Gender
- Brand
- Shape
- Colour
- Price
- Availability

Additional filters should only be introduced when they solve a genuine discovery problem.

Desktop:

- Clean filter panel / control
- Avoid oversized permanent sidebar

Mobile:

- Bottom sheet or full-height filter drawer
- Apply
- Clear All

Active filters should be clearly visible.

Example:

```text
Brand: Brand X
Shape: Aviator
Colour: Black
```

Users should be able to remove individual filters.

---

# 13. Sorting

Standard sort options:

- Featured
- Newest
- Price: Low to High
- Price: High to Low

The exact available options can be adjusted according to catalogue logic.

Sort should remain secondary to discovery.

---

# 14. Product Count

Every major collection page should communicate the number of available results.

Example:

```text
AVIATOR

32 PRODUCTS
```

After filters:

```text
AVIATOR

8 PRODUCTS
```

The count must be data-driven.

Never hard-code catalogue counts.

---

# 15. Pagination / Loading

Do not use uncontrolled infinite scrolling.

Preferred behaviour:

- Progressive loading
- Load More
- Controlled pagination where appropriate

The user should retain a clear sense of where they are in the catalogue.

Loading states must be designed rather than leaving blank space.

---

# 16. Editorial Inserts

Editorial inserts may be placed within product grids when useful.

Examples:

- Short brand story
- Shape education
- Collection statement
- Campaign image
- Fit-guide reminder

They should appear selectively.

Do not interrupt every few products with promotional content.

The product catalogue remains the primary experience.

---

# 17. Recently Viewed

Recently Viewed is a utility feature, not a major marketing section.

Initial recommendation:

**Maximum 4 products**

It may appear:

- Near the bottom of PLPs
- Near the bottom of collection pages
- Near the bottom of PDPs

It should not dominate the page.

Products should be stored and rendered dynamically.

---

# 18. Recommendations

Recommendation modules must have distinct purposes.

## You May Also Like

Primarily used on PDPs.

Purpose:

> Help the customer continue browsing after viewing a product.

## Best Sellers

Purpose:

> Surface proven products.

## New Arrivals

Purpose:

> Surface recently added products.

## Recently Viewed

Purpose:

> Help customers return to products they previously considered.

## Recommended for You

Potentially used later on:

- Homepage
- Account
- Personalised surfaces

Do not introduce personalisation until sufficient behavioural data exists.

---

# 19. Collection Relationships

The frontend should make discovery paths feel connected.

Example:

```text
Brand
 ↓
Product
 ↓
Shape
 ↓
Face Guide
 ↓
Recommended Shape
 ↓
Collection
 ↓
Product
```

Another path:

```text
New Arrivals
 ↓
Brand
 ↓
PDP
 ↓
Related Products
 ↓
Recently Viewed
```

This creates catalogue depth without requiring complicated navigation.

---

# 20. URL Architecture

Use clean, human-readable URLs.

Examples:

```text
/brands
/brands/[brand-slug]

/men
/women
/unisex

/new-arrivals
/best-sellers

/collections/aviator
/collections/rectangle
/collections/square
/collections/round

/search?q=black

/product/[product-slug]
```

Do not create URLs for arbitrary combinations such as:

```text
/men/black/aviator/under-50/best-sellers
```

unless there is a deliberate SEO/business reason.

Filter combinations should generally remain query/state based rather than becoming permanent collection pages.

---

# 21. Avoid Collection Explosion

The catalogue may contain many combinations:

```text
Men + Black + Aviator
Women + Gold + Round
Unisex + Brown + Rectangle
Brand + Shape + Style
```

These combinations should not automatically become public collection pages.

Only intentional, meaningful, indexable collections should receive dedicated routes.

This prevents:

- SEO duplication
- Navigation clutter
- Maintenance problems
- Thin collection pages
- A confusing customer experience

---

# 22. PDP → Discovery Connections

The PDP should expose useful discovery paths.

Examples:

```text
BRAND NAME
↓
Brand catalogue

AVIATOR
↓
Aviator collection

WOMEN
↓
Women catalogue
```

The customer should be able to move from a product into a broader catalogue context without restarting their search.

---

# 23. Homepage Discovery Connections

Homepage should link into the discovery architecture through carefully selected modules.

Examples:

```text
Shop Men
Shop Women
Shop Unisex

Explore Best Sellers

Explore New Arrivals

Shop by Shape

Featured Brands
```

A Featured Brands module may be introduced once the brand catalogue supports it.

Do not create a huge logo wall.

---

# 24. Search Integration

Search should use the same product catalogue and discovery metadata.

Search should understand:

- Product name
- Model
- Brand
- Variant
- Colour
- Shape
- Collection
- Gender
- Style

Example searches:

```text
black
aviator
round
women
black aviator
brand name
```

Search results should reuse:

- ProductCard
- ProductGrid
- Filters
- Sort
- Product count

This prevents search from becoming a separate visual system.

---

# 25. Data Architecture Requirements

The frontend must consume structured catalogue data.

Minimum product discovery fields:

```text
id
slug
name
brand
gender[]
shape[]
style[]
colours[]
price
availability
isNewArrival
isBestSeller
images[]
```

Additional fields may include:

```text
compareAtPrice
variantCount
colourCount
sizes
measurements
description
details
```

The final backend schema may differ, but the frontend should be designed around structured data rather than hard-coded catalogue content.

---

# 26. Brand Data Requirements

Each brand should support:

```text
id
slug
name
description
logo / brand mark if supplied
status
productCount
```

Optional:

```text
heroImage
brandStory
SEO title
SEO description
```

Brand imagery must only be used when supplied/approved.

Do not generate artificial brand assets automatically.

---

# 27. Empty States

Collection pages need deliberate empty states.

Example:

```text
NO PRODUCTS FOUND

Try removing a filter or explore another collection.

[Clear Filters]
[Explore Best Sellers]
```

For an empty brand:

```text
NO PRODUCTS AVAILABLE

Explore other brands.

[View All Brands]
```

Avoid technical language.

---

# 28. Loading States

Use product-grid skeletons that match the actual layout.

Do not show generic spinners for the whole page where a local loading state is possible.

Loading should preserve layout dimensions to avoid layout shift.

---

# 29. Error States

If a collection fails to load:

```text
WE COULDN'T LOAD THIS COLLECTION

Please try again.

[Try Again]
```

The rest of the site navigation should remain usable.

---

# 30. Out-of-Stock States

Out-of-stock products should be handled deliberately.

Depending on catalogue rules:

- Remain visible but marked unavailable
- Be filtered out
- Allow controlled notification functionality later

Do not use fake scarcity messaging.

Never display:

```text
ONLY 2 LEFT
```

unless this is backed by real inventory data.

---

# 31. Mobile Discovery

Mobile navigation must prioritise clarity.

Recommended structure:

```text
SHOP

MEN
WOMEN
UNISEX

BRANDS
SHAPES
STYLES

NEW ARRIVALS
BEST SELLERS

ABOUT
```

Expandable sections are preferable to an enormous menu.

The menu should be fast and easy to scan.

---

# 32. Accessibility

Discovery components must support:

- Keyboard navigation
- Visible focus states
- Screen-reader labels
- Semantic headings
- Accessible filter controls
- Accessible drawers
- Accessible brand links
- Accessible product cards
- Correct button/link semantics
- Escape-to-close for overlays
- Logical tab order

Do not rely solely on colour or imagery to communicate category state.

---

# 33. Performance

Discovery pages must be designed for performance.

Requirements:

- Optimised product imagery
- Responsive image sizes
- Lazy loading below the fold
- Stable image dimensions
- Progressive product loading
- Debounced search/filter interactions
- Avoid loading the entire catalogue into the browser
- Cache reusable catalogue data where appropriate

Performance should be protected as catalogue size grows.

---

# 34. Analytics

Discovery interactions should be measurable.

Recommended events:

```text
collection_view
brand_view
gender_view
shape_collection_view
style_collection_view

filter_used
filter_removed
sort_used

product_card_view
product_card_click

brand_click
shape_click
style_click
gender_click

load_more_click
recently_viewed_click
recommendation_click
```

These events should later help determine:

- Which brands customers browse
- Which shapes are popular
- Which collections convert
- Which filters are actually useful
- Where customers abandon discovery

---

# 35. SEO

Meaningful collection and brand pages should be indexable when appropriate.

Priority indexable routes include:

```text
/brands/[brand-slug]
/men
/women
/unisex
/new-arrivals
/best-sellers
/collections/[shape]
```

Style pages should only be indexable if they contain substantial, useful catalogue content.

Do not index every arbitrary filter combination.

Each indexable page should have:

- Unique title
- Unique meta description
- Canonical URL
- Appropriate heading hierarchy
- Structured product content
- Useful internal links

---

# 36. Anti-AI-Slop Design Rules

Discovery pages must not feel generated from an ecommerce template.

Strictly avoid:

- Giant rounded cards
- Generic gradient backgrounds
- Glassmorphism
- Floating blobs
- Decorative UI with no function
- Excessive shadows
- Fake luxury gold accents
- Huge icon grids
- Generic "Shop Now" repetition
- Fake statistics
- Fake testimonials
- Artificial urgency
- Excessive animation
- Random asymmetry
- Excessive parallax
- Unnecessary hover gimmicks
- Template-style mega menus
- Over-designed filter interfaces

The catalogue should feel:

**Clean. Editorial. Premium. Modern. Product-first.**

---

# 37. Motion

Motion should be subtle and functional.

Acceptable:

- Menu open/close transitions
- Filter drawer transitions
- Image transitions
- Product image hover where useful
- Loading transitions
- Add-to-bag feedback

Avoid:

- Excessive page transitions
- Magnetic cursor effects
- Scroll-triggered decoration
- Constant parallax
- Animations that delay shopping

Motion must never compete with the product.

---

# 38. Reusable Frontend Components

Recommended reusable components:

```text
Header
DesktopNavigation
MobileNavigation
ShopMegaMenu

BrandIndex
BrandCard
BrandHeader

CollectionHeader
CollectionGrid
CollectionIntro

ProductCard
ProductGrid

FilterBar
FilterDrawer
FilterChip
SortControl
ProductCount

EditorialInsert

RecentlyViewed
RecommendationRail

LoadMore
Pagination

EmptyState
LoadingState
ErrorState
```

The exact component naming can change during implementation, but the responsibilities should remain separated.

---

# 39. Single Catalogue System

The following pages should all use the same underlying discovery/product system:

```text
PLP
Search
Brand
Gender
Shape
Style
New Arrivals
Best Sellers
```

Only the context changes.

The product grid, card, filtering, sorting, loading, empty, and error behaviours should remain consistent.

This is critical for maintainability.

---

# 40. Discovery Journey

The intended discovery architecture is:

```text
HOME
 ↓
SHOP / NEW ARRIVALS / BEST SELLERS
 ↓
MEN / WOMEN / UNISEX
 ↓
BRANDS / SHAPES / STYLES
 ↓
PRODUCT GRID
 ↓
PDP
 ↓
RELATED PRODUCTS
 ↓
RECENTLY VIEWED
```

Alternative:

```text
SEARCH
 ↓
PRODUCT
 ↓
BRAND
 ↓
BRAND CATALOGUE
 ↓
PRODUCT
```

Alternative:

```text
PDP
 ↓
FIND YOUR FIT
 ↓
FACE SHAPE
 ↓
RECOMMENDED SHAPE
 ↓
SHAPE COLLECTION
 ↓
PRODUCT
```

All routes should feel connected.

---

# 41. Final Design Principle

The SHADESUK catalogue should feel like a large, carefully curated eyewear store without making the customer think about the underlying catalogue structure.

Brands, gender, shapes, styles, New Arrivals, and Best Sellers provide multiple entry points.

The customer should always understand:

**Where am I?**  
**What am I looking at?**  
**What can I refine?**  
**What can I explore next?**

The frontend should answer those questions through hierarchy and interaction rather than decorative UI.

---

# 42. Locked Summary

### Primary discovery

- Men
- Women
- Unisex
- Brands
- Shapes
- Styles
- New Arrivals
- Best Sellers

### Brand system

- `/brands`
- `/brands/[brand-slug]`
- Brand filter
- Brand visible on product cards
- Brand visible/clickable on PDP
- Scalable brand index
- No giant brand wall by default

### Collection system

- Shared collection template
- Shared product grid
- Shared ProductCard
- Shared filters
- Shared sorting
- Shared loading/error/empty states
- Controlled loading
- Data-driven counts

### Filters

- Gender
- Brand
- Shape
- Colour
- Price
- Availability

### Core routes

```text
/brands
/brands/[brand-slug]

/men
/women
/unisex

/new-arrivals
/best-sellers

/collections/[shape]
/collections/[style]

/search
/product/[product-slug]
```

### Design rules

- Product-first
- Editorial restraint
- Premium whitespace
- No AI-slop
- No unnecessary complexity
- No collection explosion
- No fake urgency
- No hard-coded catalogue data
- Reusable components
- Scalable architecture

**This specification is considered locked for the Collections & Discovery portion of the SHADESUK frontend.**
