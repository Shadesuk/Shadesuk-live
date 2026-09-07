# SHADESUK --- Sitemap & Navigation Architecture

**Status:** Frontend architecture --- approved\
**Direction:** Clean / modern / luxury / product-led\
**Primary commercial focus:** Sunglasses / Shades

------------------------------------------------------------------------

## 1. Core Navigation Principles

ShadesUK should have a deliberately simple navigation structure.

The interface should feel like a premium eyewear brand rather than a
large catalogue or dropshipping marketplace.

The navigation must:

-   Keep shopping immediately accessible
-   Make Men / Women / Unisex discovery obvious
-   Keep the number of top-level choices low
-   Allow the catalogue to scale without redesigning the information
    architecture
-   Prioritise product discovery throughout the browsing journey
-   Support guest checkout without sacrificing order tracking
-   Provide optional account creation through Google authentication
-   Keep policy/support pages accessible without cluttering the primary
    navigation

------------------------------------------------------------------------

# 2. Primary Header

## Desktop

**SHADESUK logo**

Primary navigation:

-   SHOP
-   NEW ARRIVALS
-   BEST SELLERS
-   COLLECTIONS
-   ABOUT

Utility:

-   Search
-   Account
-   Bag

The logo returns the customer to Home.

Do not place "Home" in the primary navigation.

------------------------------------------------------------------------

# 3. SHOP

## `/shop`

The main catalogue entry point.

### Shop structure

-   All Shades
-   Men
-   Women
-   Unisex

The category system should remain intentionally simple.

There is only one product category:

**Sunglasses / Shades**

Men / Women / Unisex are merchandising/discovery classifications rather
than separate product types.

------------------------------------------------------------------------

# 4. NEW ARRIVALS

## `/new-arrivals`

Dedicated merchandising page for recently added products.

Purpose:

-   Highlight new products
-   Create a reason for returning customers to browse
-   Provide a direct discovery path from the header
-   Support future seasonal/product drops

Products should be dynamically populated once the backend is connected.

------------------------------------------------------------------------

# 5. BEST SELLERS

## `/best-sellers`

Dedicated merchandising page for proven/high-demand products.

Purpose:

-   Reduce decision friction
-   Surface products with stronger purchase intent
-   Give new customers an easy starting point
-   Provide a high-conversion entry point

Products should eventually be dynamically populated from actual
sales/order data.

------------------------------------------------------------------------

# 6. COLLECTIONS

## `/collections`

Collections should be visual and discovery-led.

### Primary collection structure

**By Gender**

-   Men
-   Women
-   Unisex

**By Shape**

Potential examples:

-   Aviator
-   Rectangle
-   Square
-   Oval
-   Cat Eye
-   Rimless
-   Other shapes based on the actual catalogue

**By Style**

Potential examples:

-   Classic
-   Minimal
-   Statement
-   Sport
-   Vintage-inspired

Only categories with meaningful product volume should be exposed.

Do not create empty or artificially fragmented collection pages.

------------------------------------------------------------------------

# 7. PRODUCT DETAIL

## `/product/[product-slug]`

Every product has a dedicated PDP.

### PDP structure

Above the fold:

-   Product gallery
-   Product name
-   Price
-   Sale/offer information where applicable
-   Gender/category
-   Colour/variant
-   Quantity
-   Add to Bag
-   Purchase CTA
-   Shipping expectation
-   Payment reassurance

Below the fold:

-   Product description
-   Specifications
-   Measurements
-   Materials
-   What's included
-   Shipping information
-   FAQ
-   Related products
-   Recently viewed products where appropriate

### Mandatory disclosure

Every PDP must automatically display:

**High-quality 1:1 Superclone**

This is a reusable frontend component and must not depend on manually
adding content to individual products.

------------------------------------------------------------------------

# 8. PRODUCT DISCOVERY / LOW-BOUNCE PRINCIPLE

A core frontend requirement is that **product discovery should continue
as the customer scrolls**.

The site should not allow long stretches of content where the customer
is no longer exposed to products.

However, this must be implemented through intelligent merchandising
rather than simply repeating product grids.

## Recommended approach

### On the homepage

Alternate between:

**Brand/editorial moment → Product discovery → Brand/editorial moment →
Product discovery**

Example:

``` text
Hero
↓
Featured Shades
↓
Editorial / Brand Statement
↓
Best Sellers
↓
Collection Discovery
↓
Product Spotlight
↓
New Arrivals
↓
Final CTA
```

### On collection pages

Use product-led merchandising:

``` text
Collection Header
↓
Product Grid
↓
Editorial/collection break
↓
Product Grid
↓
Product-focused promotional section
↓
More Products
```

The customer should repeatedly encounter products without the experience
feeling repetitive.

### Important UX rule

Do **not** use aggressive infinite scrolling that makes the footer,
policies or navigation difficult to reach.

Instead:

-   Progressive product loading
-   "Load more" or controlled infinite loading
-   Product recommendations between content blocks
-   Related products
-   Recently viewed products
-   Persistent access to Bag
-   Clear collection/filter controls

The objective is:

**More product exposure → more discovery → more consideration → higher
purchase intent**

without creating a frustrating browsing experience.

------------------------------------------------------------------------

# 9. SEARCH

## `/search`

Search should be a full product-discovery experience.

Potential states:

### Initial

-   Search input
-   Suggested searches
-   Popular products/categories

### Active search

-   Product results
-   Product count
-   Filters
-   Sort

### No results

-   Clear no-result message
-   Suggested categories
-   Best sellers
-   Alternative products

Search should remain fast and visually minimal.

------------------------------------------------------------------------

# 10. ACCOUNT

## `/account`

Accounts are optional.

The primary purchase path must remain:

**Guest Checkout**

Customers must never be forced to create an account before purchasing.

### Account options

-   Continue with Google
-   Account details
-   Orders
-   Order details
-   Saved addresses
-   Logout

Google authentication should be presented as an optional convenience
rather than an obstacle to purchase.

------------------------------------------------------------------------

# 11. GUEST CHECKOUT

Guest checkout is mandatory.

### Primary flow

``` text
Product
↓
Bag
↓
Checkout
↓
Customer details
↓
Delivery address
↓
Payment
↓
Order confirmation
↓
Order tracking
```

The customer should be able to complete the purchase without
registering.

------------------------------------------------------------------------

# 12. ORDER TRACKING

Every order must remain trackable, including guest orders.

Guest customers should receive an order confirmation containing a secure
way to access their order status.

Potential frontend routes:

## `/track-order`

Customer enters appropriate order information.

## `/order/[secure-reference]`

Secure order status page.

The experience should show:

-   Order reference
-   Products ordered
-   Order status
-   Shipping status
-   Tracking information when available
-   Delivery progress
-   Customer/delivery summary where appropriate

The exact authentication/security mechanism will be defined during
backend integration.

Frontend requirement:

**Guest checkout must never mean an untracked order.**

------------------------------------------------------------------------

# 13. CART / BAG

## `/cart`

The cart should exist in two forms.

### Cart drawer

Used for quick shopping.

Contains:

-   Product
-   Variant
-   Quantity
-   Price
-   Remove
-   Subtotal
-   Checkout CTA

### Full cart

Used when the customer needs to review the complete order.

The Bag should remain easily accessible while browsing.

------------------------------------------------------------------------

# 14. CHECKOUT

## `/checkout`

Checkout should remove unnecessary navigation and distractions.

Recommended structure:

``` text
SHADESUK
↓
Contact
↓
Delivery
↓
Shipping
↓
Payment
↓
Order Summary
↓
Complete Order
```

Stripe payment UI will be integrated later.

The frontend must be designed so the payment implementation can be
inserted without changing the checkout architecture.

------------------------------------------------------------------------

# 15. ABOUT

## `/about`

Editorial brand page.

Purpose:

-   Explain ShadesUK
-   Establish brand identity
-   Build trust
-   Provide context without becoming a long corporate story

The page should remain visually led and concise.

------------------------------------------------------------------------

# 16. CONTACT

## `/contact`

Customer support/contact page.

Include appropriate contact channels once supplied.

Potential additions:

-   Support information
-   Response expectations
-   Order-help pathway
-   FAQ shortcut

------------------------------------------------------------------------

# 17. FAQ

## `/faq`

Organised around actual customer objections.

Suggested categories:

-   Orders
-   Shipping
-   Products
-   Payments
-   Returns / Refunds
-   Order Tracking

Do not create questions merely to fill space.

------------------------------------------------------------------------

# 18. LEGAL / INFORMATION PAGES

These should not clutter the primary navigation.

### `/shipping-policy`

Shipping expectations, including the minimum expected timeframe.

### `/refund-policy`

Refund / cancellation policy.

### `/terms`

Terms & Conditions.

### `/privacy-policy`

Privacy Policy.

### `/cookie-policy`

Cookie Policy.

These should be accessible through the footer and where contextually
required during checkout/account flows.

------------------------------------------------------------------------

# 19. FOOTER

The footer should provide the secondary navigation layer.

## SHOP

-   All Shades
-   Men
-   Women
-   Unisex
-   New Arrivals
-   Best Sellers
-   Collections

## HELP

-   FAQ
-   Contact
-   Shipping
-   Returns / Refunds
-   Track Order

## COMPANY

-   About
-   Terms & Conditions
-   Privacy Policy
-   Cookie Policy

## SOCIAL

Only active official social channels.

## Footer bottom

-   ShadesUK logo
-   Copyright
-   Appropriate legal/payment information

------------------------------------------------------------------------

# 20. FINAL SITEMAP

``` text
SHADESUK
│
├── HOME
│
├── SHOP
│   ├── All Shades
│   ├── Men
│   ├── Women
│   └── Unisex
│
├── NEW ARRIVALS
│
├── BEST SELLERS
│
├── COLLECTIONS
│   ├── Men
│   ├── Women
│   ├── Unisex
│   ├── By Shape
│   │   ├── Aviator
│   │   ├── Rectangle
│   │   ├── Square
│   │   ├── Oval
│   │   ├── Cat Eye
│   │   └── Other catalogue-supported shapes
│   │
│   └── By Style
│       ├── Classic
│       ├── Minimal
│       ├── Statement
│       ├── Sport
│       └── Other catalogue-supported styles
│
├── PRODUCT
│   └── Product Detail
│
├── SEARCH
│
├── ACCOUNT
│   ├── Google Authentication
│   ├── Orders
│   ├── Order Details
│   ├── Account Details
│   └── Saved Addresses
│
├── CART / BAG
│
├── CHECKOUT
│
├── ORDER TRACKING
│   ├── Track Order
│   └── Secure Order Status
│
└── INFORMATION
    ├── About
    ├── Contact
    ├── FAQ
    ├── Shipping Policy
    ├── Refund / Returns Policy
    ├── Terms & Conditions
    ├── Privacy Policy
    └── Cookie Policy
```

------------------------------------------------------------------------

# 21. Frontend Non-Negotiables

These requirements are locked into the frontend architecture.

### Product exposure

The customer should repeatedly encounter relevant products while
scrolling.

### No forced registration

Guest checkout is the default purchase path.

### Guest order tracking

Every guest order must have a trackable customer-facing order status
experience.

### Optional account

Customers can create/sign into an account using Google authentication.

### Product-led design

Editorial sections support product discovery; they should never bury the
catalogue.

### No navigation clutter

The header remains minimal.

### No artificial category explosion

Only meaningful collections should become visible navigation
destinations.

### Premium restraint

The sitemap should support the established clean, modern, luxury visual
direction.

### No AI-slop UX

No unnecessary UI patterns should be introduced merely because they are
common in generated ecommerce designs.
