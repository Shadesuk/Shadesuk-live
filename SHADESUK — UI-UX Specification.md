# SHADESUK — UI/UX SPECIFICATION

**Status:** LOCKED  
**Purpose:** Source of truth for frontend UI/UX implementation  
**Product:** SHADESUK Ecommerce  
**Design Direction:** Editorial Commerce / Modern Eyewear  
**Primary Principle:** Premium restraint, product clarity, frictionless discovery

---

# 1. DESIGN NORTH STAR

SHADESUK should feel like a modern eyewear label first and an ecommerce website second.

The experience must balance:

- Brand perception
- Product discovery
- Product confidence
- Ease of purchase
- Accessibility
- Performance

### Core principle

> **Make the customer want the brand, then make discovering a product effortless.**

The interface should never feel like:

- A generic ecommerce template
- A dropshipping storefront
- A SaaS dashboard
- A technology product
- An over-designed luxury website
- An AI-generated website

The UI should be quiet, confident and intentional.

### Brand rule

> **Logo = brand signature. UI = quiet luxury.**

---

# 2. VISUAL DIRECTION

## Overall aesthetic

SHADESUK is:

- Clean
- Modern
- Premium
- Fashion-led
- Confident
- Minimal
- Contemporary
- Accessible
- Sharp
- Urban

The design should use whitespace, typography, imagery and alignment to create premium perception rather than decorative effects.

---

# 3. COLOUR SYSTEM

The colour relationship is LOCKED.

## Brand identity

### Deep Navy

```text
#0B1C2D
```

Primary brand colour.

Used for:

- Primary buttons
- Important actions
- Header/logo treatments where appropriate
- Selected states
- Strong brand moments
- Key interactive elements

### Silver

Silver is part of the **brand identity**, particularly in the logo/monogram direction.

Silver should be used sparingly in the UI.

It is NOT a general-purpose website accent.

Do NOT create:

- Silver gradients
- Metallic button effects
- Silver borders everywhere
- Silver cards
- Silver decorative backgrounds
- Metallic UI effects

Silver should primarily reinforce the brand identity.

---

## UI neutrals

### Warm Off-White

```text
#F7F6F2
```

Primary page background.

### Soft Stone

```text
#E9E7E1
```

Secondary surfaces and restrained supporting backgrounds.

### Near Black

```text
#111111
```

Primary body text and strong typography.

### White

```text
#FFFFFF
```

Used where appropriate for contrast and surfaces.

---

## Colour hierarchy

```text
PRIMARY BRAND
Deep Navy #0B1C2D

PRIMARY BACKGROUND
Warm Off-White #F7F6F2

SECONDARY SURFACE
Soft Stone #E9E7E1

TEXT
Near Black #111111

WHITE
#FFFFFF

BRAND ACCENT
Silver — restrained
```

Do not introduce additional permanent accent colours without explicit design approval.

---

# 4. WHAT NOT TO DO

The following are explicitly prohibited unless deliberately approved:

- Gradients
- Glassmorphism
- Neon colours
- Glow effects
- Excessive shadows
- Giant rounded cards
- Floating blobs
- Decorative 3D objects
- Generic AI lifestyle imagery
- AI-generated models
- Fake luxury photography
- Gold-on-black luxury styling
- Excessive animation
- Cursor effects
- Parallax
- Scroll-jacking
- Magnetic buttons
- Sparkle/star icons
- Fake statistics
- Fake testimonials
- Fake reviews
- Fake scarcity
- Excessive badges
- Random asymmetry
- Huge decorative headings with no purpose
- Card-on-card layouts
- Template ecommerce sections

If a design element does not improve:

1. Navigation
2. Product understanding
3. Brand perception
4. Trust
5. Conversion

question whether it belongs.

---

# 5. TYPOGRAPHY

Use one strong contemporary grotesk/sans-serif family throughout the interface.

Suitable direction:

- Inter
- Geist
- Suisse-style
- Neue Haas-style
- Similar contemporary grotesk

Avoid unnecessarily mixing multiple font families.

## Hierarchy

```text
Display
H1
H2
H3
Body
Small
Micro
```

Typography should create hierarchy through:

- Size
- Weight
- Line height
- Spacing
- Position

Do not rely on decorative typography.

Responsive typography must use the shared type scale rather than arbitrary page-specific values.

---

# 6. SPACING

Use a consistent spacing system:

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

Spacing should create:

- Rhythm
- Breathing room
- Hierarchy
- Consistency

Large desktop layouts should increase whitespace rather than increase information density.

---

# 7. GRID & LAYOUT

## Desktop

Use a 12-column grid.

## Tablet

Use an 8-column foundation.

## Mobile

Use a 4-column foundation.

## Product grids

```text
Mobile:   2 columns
Tablet:   3 columns
Desktop:  4 columns
Large:    4 columns
```

Do NOT increase to 5–6 product columns on large desktop.

Large screens should gain whitespace, not catalogue density.

---

# 8. BREAKPOINTS

```text
Mobile
< 768px

Tablet
768px – 1199px

Desktop
1200px+

Large Desktop
1440px+
```

Required QA widths:

```text
320
360
390
430

768
834
1024
1199

1200
1280
1440
1600+
```

Mobile must be deliberately designed rather than treated as compressed desktop.

---

# 9. GLOBAL HEADER

## Desktop

```text
SHADESUK

SHOP
NEW ARRIVALS
BEST SELLERS
COLLECTIONS
ABOUT

SEARCH
ACCOUNT
BAG
```

Do NOT add "HOME" to the navigation.

The SHADESUK logo links to the homepage.

Navigation should remain quiet and compact.

Do not use oversized mega navigation unless the catalogue genuinely requires it.

---

## Mobile

```text
[ MENU ]    SHADESUK    [ SEARCH ] [ BAG ]
```

The mobile header must remain compact and easy to operate.

---

# 10. MOBILE NAVIGATION

Use a hierarchical slide-in navigation drawer.

First level:

```text
SHOP                         >
NEW ARRIVALS
BEST SELLERS
COLLECTIONS                  >
ABOUT
ACCOUNT
```

SHOP submenu:

```text
← SHOP

MEN
WOMEN
UNISEX

BRANDS                       >
SHAPES                       >
STYLES                       >
```

Requirements:

- Back navigation
- Close control
- Focus management
- Escape support
- Scroll handling
- No background interaction while open
- Comfortable touch targets

---

# 11. HOMEPAGE

The homepage follows:

> **CAMPAIGN → PRODUCT → EDITORIAL → PRODUCT → CATEGORY → PRODUCT → PRODUCT STORY → PRODUCT → TRUST → SHOP**

---

## Hero

Use one exceptional campaign/product image.

```text
[ CAMPAIGN IMAGE ]

SHADES FOR
EVERY ANGLE.

Short supporting statement.

[ SHOP MEN ]     [ SHOP WOMEN ]
```

The hero must communicate:

- Eyewear
- Brand quality
- Contemporary positioning
- Clear shopping routes

Avoid generic oversized hero typography with no product context.

---

## Product exposure

Example:

```text
THE SHADES PEOPLE ARE WEARING

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]

[ SHOP ALL SHADES ]
```

Product exposure should happen early.

---

## Editorial moment

```text
[ EDITORIAL IMAGE ]

BUILT AROUND
THE WAY YOU SEE
THE WORLD.

Short supporting copy.

[ EXPLORE ]
```

---

## Gender discovery

```text
SHOP YOUR WAY

MEN
WOMEN
UNISEX
```

---

## Best sellers

```text
THE MOST WANTED

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]

[ VIEW BEST SELLERS ]
```

---

## Product story

```text
[ PRODUCT STORY IMAGE ]

MODEL NAME

One-line description.

£XX

[ SHOP THIS STYLE ]
```

---

## Shape discovery

```text
FIND YOUR FRAME

AVIATOR
RECTANGLE
SQUARE
ROUND
CAT-EYE
...
```

Only show shapes supported by the real catalogue.

---

## New arrivals

```text
JUST IN

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]

[ VIEW NEW ARRIVALS ]
```

---

## Trust

Use three restrained blocks:

```text
SHIPPING
International delivery.
Expected minimum timeframe: 2 weeks.

PAYMENT
Secure card payments.

TRACKING
Every order can be tracked.
```

Do not turn this into a large icon wall.

---

## Final CTA

```text
[ CAMPAIGN IMAGE ]

FIND YOUR FRAME.

[ SHOP ALL SHADES ]
```

---

# 12. PRODUCT CARD

One shared ProductCard must power:

- Homepage
- PLP
- Search
- Brand pages
- Gender pages
- Collections
- New Arrivals
- Best Sellers
- Recommendations
- Recently Viewed

Structure:

```text
PRODUCT IMAGE

BRAND
MODEL NAME
PRICE
4 COLOURS
```

Optional:

- Colour swatches
- New Arrival
- Best Seller
- Second product image

Do not create separate product-card implementations for different pages.

---

## Product card states

Support:

```text
Default
Hover
Loading
Out of Stock
Sold Out
Image Unavailable
```

Second-image hover is allowed only when a legitimate second image exists.

Essential information must never depend on hover.

---

# 13. PRODUCT GRID

ProductGrid must control:

- Responsive columns
- Gaps
- Loading
- Empty states
- Editorial inserts
- Progressive loading

The grid is data-driven.

Never hard-code product names, prices or availability into UI components.

---

# 14. SHOP / PLP

Structure:

```text
SHOP

ALL SHADES

PRODUCT COUNT

[ FILTER ]                     [ SORT ]

PRODUCT GRID

[ LOAD MORE ]
```

Visual hierarchy:

```text
IMAGE
↓
PRODUCT NAME
↓
PRICE
↓
COLOUR COUNT
```

Colour count is mandatory on PLP.

Example:

```text
MODEL 01
£49
4 COLOURS
```

---

# 15. PLP FILTERS

Filters:

```text
Gender
Brand
Shape
Colour
Price
Availability
```

Desktop:

- Compact filter controls
- No oversized sidebar

Mobile:

- Drawer or bottom sheet

```text
FILTER

Gender                       >
Brand                        >
Shape                        >
Colour                       >
Price                        >
Availability                 >

CLEAR ALL              APPLY
```

Do not trigger excessive requests for every individual selection.

---

# 16. SORT

Supported options:

```text
Featured
Newest
Price: Low to High
Price: High to Low
Best Selling
```

---

# 17. PRODUCT LOADING

Use skeletons.

Example:

```text
[ IMAGE SKELETON ] [ IMAGE SKELETON ]

██████████         ██████████
█████              █████

████               ████
```

Do NOT use generic full-page:

```text
LOADING...
```

unless a full-page operation genuinely requires it.

---

# 18. PROGRESSIVE LOADING

Prefer:

```text
Initial products
↓
Load More
↓
More products
↓
Recently Viewed
↓
Recommendations
```

Avoid uncontrolled infinite scroll.

---

# 19. SEARCH

Search is a core shopping tool.

It must behave like a shortcut, not another complicated destination.

Desktop search overlay:

```text
SEARCH

[ Search shades... ]

RECENT SEARCHES

SUGGESTED SEARCHES

PRODUCTS

COLLECTIONS
```

While typing, show:

- Products
- Collections
- Recent searches
- Suggestions

---

# 20. SEARCH RESULTS

Route:

```text
/search?q=black
```

Search results behave like PLP.

```text
SEARCH RESULTS

BLACK

42 RESULTS

[ FILTER ]                     [ SORT ]

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]
...
```

Use the same:

- ProductCard
- ProductGrid
- Filter system
- Sort system
- Responsive rules

---

# 21. SEARCH ATTRIBUTES

Search should support:

- Product name
- Model
- Variant
- Colour
- Shape
- Gender
- Collection
- Style

Do not load the entire catalogue unnecessarily into the browser.

Use debounced requests where applicable.

---

# 22. SEARCH EMPTY STATE

```text
NO SHADES FOUND

We couldn't find anything matching
your search.

[ SEARCH AGAIN ]

OR

EXPLORE:

NEW ARRIVALS
BEST SELLERS
ALL SHADES
```

---

# 23. SEARCH TYPO STATE

Example:

```text
NO EXACT MATCH

Showing results for:

AVIATOR
```

---

# 24. COLLECTIONS

Discovery dimensions:

```text
Gender
Brand
New Arrivals
Best Sellers
Shape
Style
```

Do not create unnecessary categories.

Only create public collection routes when there is a real catalogue/business reason.

---

# 25. BRAND INDEX

Route:

```text
/brands
```

Structure:

```text
BRANDS

[ SEARCH BRANDS... ]

A

Brand A
Brand B
Brand C

B

Brand D
Brand E
```

If the catalogue grows significantly, alphabetical navigation/search can be added.

---

# 26. BRAND PAGE

Route:

```text
/brands/[brand-slug]
```

Structure:

```text
BRAND NAME

Optional introduction.

47 PRODUCTS

[ FILTER ]                     [ SORT ]

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]

[ LOAD MORE ]
```

Use the same catalogue components.

---

# 27. GENDER COLLECTIONS

Routes:

```text
/men
/women
/unisex
```

Each uses the standard collection template:

```text
TITLE

Optional supporting line.

PRODUCT COUNT

[ FILTER ]                     [ SORT ]

PRODUCT GRID

[ LOAD MORE ]
```

---

# 28. SHAPE COLLECTIONS

Example:

```text
/collections/aviator
/collections/rectangle
/collections/square
/collections/round
/collections/cat-eye
```

Only create routes for meaningful catalogue-supported shapes.

Shape discovery should connect naturally to the Fit Guide.

---

# 29. PDP

The PDP is the primary conversion surface.

North star:

> **Make the customer confident enough to buy — without making the interface do the selling.**

Customer journey:

```text
Desire
↓
Recognition
↓
Choice
↓
Fit
↓
Value
↓
Confidence
↓
Action
↓
Discovery
```

---

# 30. PDP ABOVE THE FOLD

Desktop:

```text
┌──────────────────────┬────────────────────────┐
│                      │ BRAND                  │
│                      │                        │
│ PRODUCT GALLERY      │ PRODUCT NAME           │
│                      │                        │
│                      │ PRICE                  │
│                      │                        │
│                      │ COLOUR COUNT           │
│                      │                        │
│                      │ COLOUR SELECTION       │
│                      │                        │
│                      │ SIZE / FIT             │
│                      │                        │
│                      │ SIZE & FACE GUIDE      │
│                      │                        │
│                      │ QUANTITY               │
│                      │                        │
│                      │ ADD TO BAG             │
│                      │                        │
│                      │ SHIPPING               │
│                      │ PAYMENT                │
└──────────────────────┴────────────────────────┘
```

---

# 31. PDP GALLERY

Only show legitimate available imagery.

Potential gallery assets:

- Front
- Side
- Detail
- Back
- Temple
- On-model
- Packaging

Only when the actual asset exists.

Desktop:

```text
MAIN IMAGE

[ THUMBNAIL ]
[ THUMBNAIL ]
[ THUMBNAIL ]
```

Mobile:

```text
SWIPEABLE IMAGE GALLERY
```

Optional lightbox.

Never fabricate missing product imagery.

---

# 32. PDP COLOURS

Colour selection must be actionable.

Example:

```text
4 COLOURS

● BLACK
○ BROWN
○ SILVER
○ CLEAR
```

Changing colour may update:

- Product image
- Variant
- Availability
- Relevant product information

Only use real catalogue colours.

---

# 33. PDP SIZE / FIT

If actual measurements exist:

```text
SIZE / FIT

Lens: 52
Bridge: 20
Temple: 145
```

Do not invent measurements.

Do not claim a fit label unless supported by actual product data.

---

# 34. FIND YOUR FIT

Required functionality:

```text
SIZE & FACE GUIDE
```

Flow:

```text
KNOW YOUR SIZE
KNOW YOUR FACE
FIND YOUR STYLE
```

Face shapes:

```text
Oval
Round
Square
Heart
Oblong
Diamond
```

Guidance must be presented as general guidance, not an absolute determination.

V1 must NOT include:

- AI face scanner
- AI recommendation camera
- Virtual try-on

---

# 35. PDP PURCHASE

Quantity:

```text
[ − ] 1 [ + ]
```

Primary CTA:

```text
[ ADD TO BAG ]
```

Do not introduce Buy Now unless deliberately approved.

---

# 36. PDP SHIPPING & PAYMENT

Shipping information must be visible before purchase.

Example:

```text
SHIPPING

Expected minimum delivery timeframe:
2 weeks.

PAYMENT

Secure card payment.
```

Do not promise guaranteed dates unless the service actually guarantees them.

Do not create a wall of payment logos.

---

# 37. PDP CONTENT

Use accordions:

```text
DESCRIPTION                       >

DETAILS                           >

WHAT'S INCLUDED                   >

SHIPPING                          >

RETURNS / REFUNDS                 >
```

Customer should not have to leave the PDP to understand:

- Product
- Colours
- Measurements
- Fit
- Shipping
- Payment
- Returns
- Specifications

---

# 38. REQUIRED PDP DISCLOSURE

Every PDP must automatically display:

```text
High-quality 1:1 Superclone
```

This must be implemented as a reusable component.

Legal presentation and wording must be reviewed for actual UK compliance before production.

---

# 39. PDP DISCOVERY

After the primary product information:

```text
YOU MAY ALSO LIKE

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]
```

Then:

```text
RECENTLY VIEWED

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ]
```

"Complete the Look" should only exist when genuinely useful complementary products exist.

---

# 40. MOBILE PDP

Mobile sequence:

```text
HEADER

PRODUCT GALLERY

PRODUCT NAME
PRICE
COLOUR COUNT
COLOUR
SIZE / FIT
SIZE & FACE GUIDE
QUANTITY
ADD TO BAG
SHIPPING
PAYMENT

DESCRIPTION
DETAILS
WHAT'S INCLUDED
SHIPPING
RETURNS

DISCLOSURE

YOU MAY ALSO LIKE
RECENTLY VIEWED
```

Mobile is not a compressed desktop layout.

---

# 41. MOBILE STICKY PURCHASE BAR

Only activate after the primary Add to Bag button leaves the viewport.

Example:

```text
MODEL 01       £49       [ ADD TO BAG ]
```

Must support device safe areas.

---

# 42. CART / BAG DRAWER

After Add to Bag, the Bag Drawer can confirm the action.

```text
YOUR BAG

MODEL 01
Black

[ IMAGE ]

− 1 +

£49

REMOVE

SUBTOTAL                     £49

[ CHECKOUT ]

[ CONTINUE SHOPPING ]
```

The drawer must clearly answer:

- What was added?
- How many?
- How much?
- What happens next?

---

# 43. EMPTY BAG

```text
YOUR BAG IS EMPTY

Looks like you haven't added
anything yet.

[ EXPLORE SHADES ]

NEW ARRIVALS
BEST SELLERS
```

Never use a generic empty state with no recovery path.

---

# 44. CART PAGE

Route:

```text
/cart
```

Desktop:

```text
PRODUCTS

PRODUCT
QUANTITY
PRICE

ORDER SUMMARY

SUBTOTAL
SHIPPING
TOTAL

[ CHECKOUT ]
```

Mobile stacks these sections.

---

# 45. CHECKOUT

Route:

```text
/checkout
```

Checkout should be distraction-free.

Guest checkout is the default.

Structure:

```text
CONTACT

DELIVERY

PAYMENT

ORDER SUMMARY

[ PLACE ORDER ]
```

Do not force account creation.

---

# 46. ADDRESS

Address component must support:

- Autocomplete
- Manual entry
- Keyboard navigation
- Explicit labels
- Validation
- Error states

The provider should be replaceable.

Manual entry must always remain possible.

---

# 47. CHECKOUT ERROR

Errors must be inline and understandable.

Example:

```text
Postcode

[ SW1A ]

Please enter a valid postcode.
```

Do not rely only on colour.

---

# 48. PAYMENT FAILURE

```text
PAYMENT COULDN'T BE COMPLETED

Your payment wasn't successful.

Your order has not been completed.

[ TRY PAYMENT AGAIN ]

[ RETURN TO BAG ]
```

Preserve previously entered customer information wherever possible.

---

# 49. ORDER CONFIRMATION

```text
ORDER CONFIRMED

Thank you for your order.

ORDER #SU-XXXXX

We've received your order
and will begin processing it shortly.

ORDER ITEMS

TOTAL

Expected minimum delivery timeframe:
2 weeks.

[ TRACK ORDER ]

[ CONTINUE SHOPPING ]
```

---

# 50. ORDER TRACKING

Route:

```text
/track-order
```

Guest tracking is mandatory.

```text
TRACK YOUR ORDER

Order reference
[                    ]

Email
[                    ]

[ TRACK ORDER ]
```

No account is required.

---

# 51. TRACKING TIMELINE

```text
ORDER PLACED
     │
PAYMENT CONFIRMED
     │
PROCESSING
     │
SHIPPED
     │
OUT FOR DELIVERY
     │
DELIVERED
```

Only show statuses supported by actual order data.

---

# 52. ACCOUNT

Account is optional.

Possible sections:

```text
ACCOUNT DETAILS
ORDERS
SAVED ADDRESSES
```

Google authentication may be provided for convenience.

Guest checkout remains the default.

---

# 53. FAQ

Use an accordion.

Examples:

```text
How long does shipping take?                  >

How can I track my order?                     >

What payment methods do you accept?           >

Can I change my order?                         >

What is your refund policy?                   >

How do I choose my frame size?                >

How do I find a frame for my face shape?      >
```

---

# 54. FOOTER

Structure:

```text
SHADESUK

SHOP
All Shades
Men
Women
Unisex
New Arrivals
Best Sellers
Collections

HELP
FAQ
Contact
Shipping
Returns / Refunds
Track Order

COMPANY
About
Terms
Privacy
Cookie

SOCIAL
Official active channels only
```

Include:

- Logo
- Copyright
- Legal links
- Payment information where appropriate

Do not add inactive/fake social channels.

---

# 55. 404

```text
THIS PAGE DOESN'T EXIST

The page you're looking for
may have moved.

[ BACK TO SHOP ]
```

404 should remain branded and useful.

---

# 56. UI STATES

Every reusable component must consider:

```text
Default
Hover
Focus
Active
Disabled
Loading
Success
Error
Empty
Unavailable
```

Every interaction should answer:

1. What happened?
2. What is happening?
3. What can I do next?
4. How do I recover?

---

# 57. BUTTONS

Primary buttons:

```text
ADD TO BAG
CHECKOUT
PAY
APPLY
SUBMIT
```

Primary:

```text
Deep Navy background
White text
```

Secondary:

- Light/neutral surface
- Restrained border where appropriate

Tertiary:

- Text/link treatment

Do not make every button a pill.

Default button shape should remain restrained and contemporary.

---

# 58. BUTTON STATES

Every button supports:

```text
Default
Hover
Focus
Active
Disabled
Loading
```

Loading state must communicate that the requested action is processing.

---

# 59. FORMS

Every form field must support:

```text
Label
Input
Helper text
Error
Success
Disabled
Loading
```

Placeholder text must NEVER replace the label.

---

# 60. MODALS & DRAWERS

Must support:

- Focus trap
- Focus restoration
- Escape
- Close control
- Screen-reader semantics
- No background interaction

Use drawers where they improve mobile interaction.

---

# 61. TOASTS

Use toast notifications for lightweight feedback.

Example:

```text
✓ ADDED TO BAG
```

Critical errors should appear inline rather than relying only on a toast.

---

# 62. ACCORDIONS

Use for secondary information such as:

- Description
- Details
- What's Included
- Shipping
- Returns

Do not hide essential purchase information inside unnecessary accordions.

---

# 63. IMAGE FALLBACK

When an image is unavailable:

```text
┌───────────────────────┐
│                       │
│   IMAGE UNAVAILABLE   │
│                       │
└───────────────────────┘
```

Preserve image dimensions to prevent layout shift.

Never automatically generate a fake replacement product image.

---

# 64. IMAGE POLICY

Preferred imagery:

- Authentic product photography
- Supplied brand assets
- Consistent lighting
- Consistent aspect ratios
- Consistent cropping
- Editorial/natural lifestyle photography when genuinely available

Avoid:

- AI-generated people
- AI-generated hands
- AI-generated eyewear
- Fake product photography
- Generic stock imagery
- Artificial luxury environments

If authentic imagery is unavailable during development, use an intentional labelled placeholder.

Example:

```text
┌──────────────────────────────┐
│                              │
│       CAMPAIGN IMAGE         │
│       ASSET PENDING          │
│                              │
└──────────────────────────────┘
```

Do NOT use ugly developer placeholders such as:

```text
THIS IMAGE WILL GO HERE
ADD IMAGE LATER
```

---

# 65. DEMO PLACEHOLDERS

During the demo phase, use intentional placeholders:

```text
CAMPAIGN IMAGE
PRODUCT IMAGE
EDITORIAL IMAGE
PRODUCT STORY IMAGE
GENDER IMAGE
BRAND IMAGE
```

The placeholder should preserve the intended dimensions and visual hierarchy.

The purpose is to demonstrate the final layout without pretending that unavailable assets exist.

---

# 66. DEMO CATALOGUE

The frontend demo should use structured mock catalogue data.

Each product should contain, where applicable:

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

Optional:

```text
compareAtPrice
variantCount
colourCount
sizes
measurements
description
details
```

Mock data must behave like production data.

Do not hard-code product information directly inside components.

---

# 67. COMPONENT ARCHITECTURE

Recommended structure:

```text
src/
├── components/
│   ├── ui/
│   ├── navigation/
│   ├── product/
│   ├── discovery/
│   ├── cart/
│   ├── checkout/
│   ├── account/
│   ├── orders/
│   ├── forms/
│   └── states/
│
├── pages/
├── layouts/
├── hooks/
├── lib/
├── services/
├── data/
├── styles/
└── types/
```

---

# 68. BUILD-ONCE RULE

If the same interaction exists in multiple locations, build it once and reuse it.

Examples:

```text
ProductCard
ProductGrid
FilterBar
FilterDrawer
SortControl
Search
BagDrawer
QuantityControl
Accordion
Toast
Modal
LoadingState
EmptyState
ErrorState
```

Do not create:

```text
HomepageProductCard
SearchProductCard
PLPProductCard
RecommendationProductCard
```

unless there is a genuine structural reason.

---

# 69. CATALOGUE SYSTEM

One catalogue system should power:

```text
Shop
Search
Brand
Gender
Shape
Style
New Arrivals
Best Sellers
Recommendations
Recently Viewed
```

This prevents the frontend from becoming a collection of disconnected pages.

---

# 70. ROUTING

Core routes:

```text
/
 /shop
 /men
 /women
 /unisex

 /new-arrivals
 /best-sellers

 /brands
 /brands/[brand-slug]

 /collections/[shape]
 /collections/[style]

 /search

 /product/[product-slug]

 /cart
 /checkout

 /account

 /track-order
 /order/[secure-reference]

 /about
 /contact
 /faq

 /shipping-policy
 /refund-policy
 /terms
 /privacy-policy
 /cookie-policy
```

---

# 71. URL RULES

Use clean URLs.

Examples:

```text
/product/model-name
/brands/brand-name
/collections/aviator
/new-arrivals
/best-sellers
/search?q=black
```

Random filter combinations should generally remain query/state based rather than becoming permanent indexable pages.

---

# 72. RESPONSIVE PRINCIPLES

Responsive priority:

```text
Clarity
↓
Accessibility
↓
Performance
↓
Responsiveness
↓
Visual polish
```

Mobile must be intentionally redesigned around:

- Product discovery
- Imagery
- Navigation
- Add to Bag
- Checkout
- Shipping clarity

---

# 73. ACCESSIBILITY

Target:

> **WCAG 2.2 AA**

Requirements include:

- Keyboard navigation
- Visible focus
- Screen-reader support
- Correct semantic HTML
- Sufficient colour contrast
- Accessible forms
- Associated errors
- Accessible dialogs/drawers
- Accessible navigation
- Comfortable touch targets
- Reduced-motion support

---

# 74. PRODUCT ACCESSIBILITY

Product cards must expose a coherent product destination.

Colour swatches must be independently accessible.

Do not make important information available only through hover.

---

# 75. MOTION

Motion should be:

- Fast
- Subtle
- Functional
- Consistent

Use animation to communicate:

- State change
- Navigation
- Feedback
- Loading
- Spatial relationship

Avoid animation purely for decoration.

Respect:

```text
prefers-reduced-motion
```

---

# 76. PERFORMANCE

Performance is especially important on mobile.

Use:

- Responsive images
- WebP/AVIF where appropriate
- Correct image dimensions
- Lazy loading below the fold
- Priority loading for primary hero/PDP imagery
- Efficient fonts
- Lean JavaScript
- No unnecessary libraries
- No unnecessary animation systems

Protect:

```text
LCP
CLS
INP
```

Avoid layout shift by reserving image dimensions.

---

# 77. SEO

SEO supports the UX.

It does NOT dictate the visual design.

Important pages should be:

- Technically understandable
- Crawlable
- Indexable where appropriate
- Properly canonicalised

Product pages should expose real:

- Product name
- Brand
- Description
- Price
- Availability
- Images
- Variants

Structured data should use actual product data.

Do not build the website around:

- SEO dashboards
- Programmatic SEO
- Blog-first architecture
- Keyword-stuffed interfaces
- Hundreds of artificial collection pages

---

# 78. DISCOVERY PRINCIPLE

The customer should always have a useful next step.

Example:

```text
Homepage
↓
Product
↓
Shape
↓
Another Product
↓
Bag
```

Or:

```text
Search
↓
Product
↓
Fit Guide
↓
Shape Collection
↓
Product
```

Or:

```text
Product
↓
You May Also Like
↓
Product
```

Avoid dead ends.

---

# 79. TRUST PRINCIPLE

Trust should come from clarity rather than visual noise.

Communicate:

- Shipping
- Payment
- Tracking
- Returns
- Product details
- Fit information
- Order status

Do not manufacture trust through:

- Fake reviews
- Fake ratings
- Fake statistics
- Fake scarcity
- Fake urgency
- Decorative trust badges

---

# 80. PRODUCT DATA INTEGRITY

Never fabricate:

- Prices
- Stock
- Product measurements
- Colours
- Delivery dates
- Ratings
- Reviews
- Product specifications
- Customer testimonials

If data does not exist:

1. Omit it, or
2. Use a deliberate demo placeholder during development.

---

# 81. DEMO DEVELOPMENT RULE

The demo is NOT a disposable prototype.

The demo frontend is the foundation of the production frontend.

Therefore:

```text
Demo UI
   ↓
Real component architecture
   ↓
Real responsive behaviour
   ↓
Real states
   ↓
Real interaction patterns
   ↓
Replace mock data/assets
   ↓
Production
```

Do not build a separate "prototype architecture" that must later be rewritten.

---

# 82. DEVELOPMENT STATE SWITCHER

During development, it is useful to have an internal/demo-only state switcher.

Example:

```text
DEMO CONTROLS

PAGE
Homepage

STATE
Default

AVAILABLE STATES

Default
Loading
Empty
Error
Success
Disabled
Sold Out
Unavailable
```

This allows every important state to be demonstrated and tested without manually manipulating backend data.

This control must not appear in production.

---

# 83. REQUIRED QA

Test:

### Navigation

- Desktop navigation
- Mobile navigation
- Search
- Account
- Bag
- Drawers
- Modals

### Ecommerce

- Product selection
- Colour selection
- Quantity
- Add to Bag
- Remove
- Cart
- Checkout
- Payment states

### Discovery

- Filters
- Sort
- Search
- Collections
- Brands
- Gender
- Shapes
- Recommendations

### States

- Loading
- Empty
- Error
- Success
- Disabled
- Sold out
- Image unavailable

### Responsive

```text
320
360
390
430
768
834
1024
1199
1200
1280
1440
1600+
```

### Accessibility

- Keyboard
- Focus
- Screen reader
- Contrast
- Touch
- Reduced motion

---

# 84. FINAL DESIGN RULES

When making any new UI decision, ask:

### 1. Does it improve the customer journey?

### 2. Does it improve product understanding?

### 3. Does it improve navigation?

### 4. Does it improve trust?

### 5. Does it improve conversion?

### 6. Is it accessible?

### 7. Is it performant?

### 8. Is it consistent with the existing component system?

### 9. Is it genuinely SHADESUK?

### 10. Would this still look good without decorative effects?

If the answer is no, reconsider the implementation.

---

# 85. NON-NEGOTIABLES

```text
PRODUCT-LED DESIGN
PREMIUM RESTRAINT
DEEP NAVY + QUIET NEUTRALS
SILVER USED SPARINGLY AS BRAND IDENTITY
NO GRADIENTS
NO GLASSMORPHISM
NO AI-SLOP
NO FAKE IMAGERY
NO FAKE DATA
NO FAKE REVIEWS
NO FAKE SCARCITY
NO EXCESSIVE ANIMATION
NO UNNECESSARY CATEGORIES
NO UNCONTROLLED INFINITE SCROLL
NO DESKTOP-FIRST MOBILE COMPRESSION
NO DUPLICATE COMPONENTS
NO HARD-CODED CATALOGUE DATA
GUEST CHECKOUT
GUEST ORDER TRACKING
ACCESSIBLE BY DEFAULT
MOBILE-FIRST PERFORMANCE
```

---

# 86. SHADESUK UI/UX NORTH STAR

The final experience should feel like:

```text
QUIET
        ↓
CONFIDENT
        ↓
EDITORIAL
        ↓
PRODUCT-LED
        ↓
EASY TO NAVIGATE
        ↓
EASY TO UNDERSTAND
        ↓
EASY TO BUY
```

Not:

```text
LOUD
DECORATIVE
TREND-CHASING
OVER-ANIMATED
GENERIC
AI-GENERATED
DROPSHIPPING
```

**SHADESUK should look expensive because the design is disciplined — not because the interface is decorated to look expensive.**