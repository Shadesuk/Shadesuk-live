# SHADESUK --- Brand Design System

**Status:** Frontend foundation\
**Direction:** Clean / Modern / Luxury / Fashion-led\
**Core principle:** Premium restraint over visual noise

------------------------------------------------------------------------

## 1. Brand Positioning

ShadesUK should feel like a **modern eyewear label**, not a generic
ecommerce store and not a technology brand.

The visual benchmark is the clarity and confidence of established
eyewear brands: simple navigation, strong typography, disciplined
product presentation and immediate recognition.

The goal is **not to reproduce Ray-Ban's identity**. We can learn from
the category's strengths --- restraint, recognisable wordmark treatment,
product-first merchandising and strong editorial photography --- while
creating an unmistakably distinct ShadesUK system.

### Brand attributes

-   Modern
-   Confident
-   Premium
-   Minimal
-   Fashion-conscious
-   Accessible
-   Sharp
-   Urban

### Avoid

-   Over-designed luxury clichés
-   Excessive gradients
-   Glassmorphism
-   Neon accents
-   Generic AI-generated lifestyle imagery
-   Excessive rounded cards
-   Huge decorative headings without purpose
-   Floating UI elements everywhere
-   Excessive animations
-   Template-like ecommerce sections
-   "AI SaaS" visual language

------------------------------------------------------------------------

## 2. Existing Logo Direction

The supplied identity consists of:

-   SHADESUK wordmark
-   Horizontal underline
-   Separate stylised S monogram
-   Deep navy / near-black primary colour

The existing mark has a strong geometric and futuristic character.

### Frontend recommendation

Keep the logo **clean and authoritative**, but let the website itself
become more refined than the current logo treatment.

The interface should not try to imitate the angular geometry of the logo
in every component.

**Logo = brand signature.**\
**UI = quiet luxury.**

This distinction is important.

------------------------------------------------------------------------

## 3. Colour System

### Primary

**Deep Navy / Ink**

Use as the primary brand colour for:

-   Logo
-   Primary typography
-   Navigation
-   Primary buttons
-   Important UI controls
-   Footer

Suggested starting value:

`#0B1C2D`

This should be calibrated against the final logo asset before
production.

### Base

**Warm Off-White**

Primary page background:

`#F7F6F2`

This gives the interface a softer luxury feel than pure white.

### Secondary Neutral

**Soft Stone**

`#E9E7E1`

Use for:

-   Dividers
-   Secondary surfaces
-   Product information areas
-   Subtle backgrounds

### Dark

**Near Black**

`#111111`

For high-contrast text and selected editorial sections.

### White

`#FFFFFF`

Used intentionally for contrast, product imagery and selected surfaces.

### Accent

No permanent decorative accent colour should be introduced initially.

The system should be **monochromatic + navy-led**.

Any promotional colour should be functional rather than decorative.

------------------------------------------------------------------------

## 4. Typography

Typography should carry much of the premium character.

### Primary UI Typeface

Use a contemporary grotesk/sans-serif with excellent spacing and
numerals.

Recommended direction:

-   Inter
-   Geist
-   Suisse-style grotesk equivalent
-   Neue Haas Grotesk-style equivalent

The final choice should be based on licensing, performance and the
visual quality of the actual implementation.

### Type hierarchy

**Display**

Large, controlled, editorial.

Avoid oversized text simply for visual impact.

**Heading**

Strong but compact.

**Body**

Highly readable with comfortable line-height.

**Utility**

Small, precise and restrained.

Examples:

-   SHOP
-   NEW ARRIVALS
-   SEARCH
-   CART
-   SIZE GUIDE

### Typography rule

Do not mix multiple display fonts.

One strong sans-serif family, used intelligently, is preferable to a
collection of trendy typefaces.

------------------------------------------------------------------------

## 5. Layout Philosophy

The site should use **editorial whitespace**.

Whitespace is not empty space to fill. It is part of the brand.

### Principles

-   Wide margins on desktop
-   Controlled content width
-   Strong alignment
-   Consistent vertical rhythm
-   Clear hierarchy
-   Product imagery given room to breathe
-   Fewer, stronger sections

### Grid

Use a consistent responsive grid rather than individually positioning
sections.

Recommended foundation:

-   12-column desktop grid
-   8-column tablet grid
-   4-column mobile grid

The exact implementation can adapt to the chosen framework.

------------------------------------------------------------------------

## 6. Header

The header should feel extremely intentional.

### Desktop

Announcement bar --- optional\
↓\
Logo + primary navigation + utility navigation

Recommended utility actions:

-   Search
-   Account
-   Cart

Do not overload the header with icons.

### Navigation

Keep the top-level navigation short.

Possible structure:

-   Shop
-   New Arrivals
-   Best Sellers
-   Collections
-   About

The exact information architecture should follow the final catalogue.

### Behaviour

The header may become sticky after scrolling, but the transition must be
subtle.

No oversized floating header.

------------------------------------------------------------------------

## 7. Homepage Direction

The homepage should behave more like a fashion editorial storefront than
a conventional dropshipping catalogue.

### Section 01 --- Hero

Large product or campaign image.

Minimal copy.

Example:

**SEE THE DIFFERENCE.**

CTA:

**SHOP SUNGLASSES**

The visual should do most of the work.

### Section 02 --- Featured Collection

A restrained product presentation.

Avoid generic carousel behaviour unless there is a genuine merchandising
reason.

### Section 03 --- Brand Statement

A short statement establishing the brand philosophy.

One strong sentence is better than a paragraph.

### Section 04 --- Product Focus

Large editorial product imagery paired with a small curated selection.

### Section 05 --- Shop by Shape / Collection

Use strong visual navigation.

### Section 06 --- Social Proof

Reviews or UGC only once authentic content exists.

### Section 07 --- Final CTA

A simple closing shopping moment.

------------------------------------------------------------------------

## 8. Product Listing Page

The PLP should prioritise **product discovery**.

### Product grid

Desktop:

4-column default direction.

Tablet:

2--3 columns depending on available width.

Mobile:

2-column product grid where imagery remains legible.

### Product card

Recommended hierarchy:

1.  Product image
2.  Product name
3.  Price
4.  Sale information if applicable
5.  Colour/variant indicator

Keep the card visually quiet.

### Interaction

Hover can reveal a second product image where useful.

Avoid excessive card animations.

------------------------------------------------------------------------

## 9. Product Detail Page

The PDP is a primary conversion surface.

### Above the fold

Desktop:

**Product gallery \| Product information**

Product information should include:

-   Product name
-   Price
-   Discount if applicable
-   Colour / variant
-   Product options
-   Quantity
-   Add to cart
-   Shipping expectation
-   Payment reassurance

### Gallery

Large, high-quality product photography.

Avoid unnecessary frames, badges and decorative overlays.

### Below the fold

-   Product description
-   Specifications
-   Measurements
-   Materials
-   What's included
-   Shipping information
-   FAQ
-   Related products

### Mandatory disclosure

Every PDP must automatically display the agreed disclosure at the bottom
of the product information/content area:

**High-quality 1:1 Superclone**

This should be implemented as a reusable component so it cannot
accidentally be omitted from future products.

------------------------------------------------------------------------

## 10. Buttons

Buttons should be simple and decisive.

### Primary

Deep navy background\
White text

Examples:

-   ADD TO BAG
-   SHOP NOW
-   CHECKOUT

### Secondary

Transparent or light neutral surface with a restrained border.

### Rules

-   No pill-shaped buttons by default
-   No excessive shadows
-   No gradient buttons
-   No animated shine effects
-   Consistent height
-   Clear hover/focus states

------------------------------------------------------------------------

## 11. Cards & Surfaces

Avoid turning the entire website into cards.

A luxury interface should not have:

> card inside card inside card.

Use open layouts whenever possible.

Cards are reserved for actual grouping needs:

-   Product cards
-   Collection tiles
-   Select functional UI components

------------------------------------------------------------------------

## 12. Imagery Direction

Photography is critical to making the website feel premium.

### Product imagery

Prioritise:

-   Accurate product photography
-   Consistent background treatment
-   High resolution
-   Consistent crop ratios
-   Front / side / detail views
-   On-model imagery where available

### Lifestyle imagery

Should feel:

-   Fashion editorial
-   Natural
-   Contemporary
-   UK/European urban
-   Cleanly art-directed

Avoid obvious AI-generated people, hands, jewellery, sunglasses or
environments.

If authentic brand imagery is unavailable, use a restrained product-led
composition rather than filling the page with synthetic lifestyle
imagery.

------------------------------------------------------------------------

## 13. Motion

Motion should communicate hierarchy, not impress the developer.

Use:

-   Subtle hover states
-   Smooth image transitions
-   Small drawer transitions
-   Gentle page/section reveals where justified

Avoid:

-   Parallax everywhere
-   Scroll-jacking
-   Excessive text animation
-   Magnetic buttons
-   Cursor effects
-   Loading animations used as decoration

------------------------------------------------------------------------

## 14. Mobile Experience

Mobile is not a compressed desktop version.

Priorities:

1.  Product discovery
2.  Product imagery
3.  Fast navigation
4.  Easy add-to-cart
5.  Simple checkout
6.  Clear shipping expectations

Controls must be thumb-friendly.

The PDP should keep the purchase action accessible without creating an
intrusive permanent overlay unless testing proves it improves
conversion.

------------------------------------------------------------------------

## 15. AI Slop Prevention --- HARD RULE

The ShadesUK frontend must **not look AI-generated**.

### Prohibited design patterns

-   Generic gradient hero
-   Random floating blobs
-   Glassmorphism
-   Excessive rounded rectangles
-   Generic 3D objects
-   Fake luxury imagery
-   AI faces/models
-   Unnecessary badges
-   Overuse of sparkle/star icons
-   "Premium" gold-on-black clichés
-   Huge centred text with no merchandising purpose
-   Random asymmetric layouts with no grid logic
-   Excessive micro-interactions
-   Template-looking feature sections
-   Fake testimonials or invented social proof

### Required standard

Every section must answer:

**Why does this exist?**

If it does not improve:

-   Navigation
-   Product understanding
-   Brand perception
-   Trust
-   Conversion

remove it.

------------------------------------------------------------------------

## 16. Design QA Standard

Before any frontend section is approved, check:

### Visual

-   Is the hierarchy obvious?
-   Is the spacing intentional?
-   Is the typography controlled?
-   Does the section feel branded?
-   Does it look like a real fashion/ecommerce brand?

### UX

-   Can the user understand what to do?
-   Are CTAs obvious?
-   Is product information easy to scan?
-   Are interactions predictable?

### Technical

-   Responsive
-   Accessible
-   Fast
-   No layout shift
-   Correct image sizing
-   Keyboard usable
-   Focus states present

------------------------------------------------------------------------

## 17. Frontend North Star

The website should feel like:

**A modern eyewear brand with the confidence of an established label,
presented through a restrained contemporary interface.**

Not:

**A dropshipping store trying to look expensive.**

That distinction should govern every frontend decision.
