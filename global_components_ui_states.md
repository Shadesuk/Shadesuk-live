# SHADESUK — Global Components & UI States Specification

**Document:** Global Components & UI States  
**Project:** SHADESUK  
**Scope:** Frontend / UI / UX / Component Architecture  
**Status:** LOCKED  
**Purpose:** Single source of truth for reusable interface components and system states

---

## 1. Purpose

This document defines the reusable UI building blocks powering the SHADESUK frontend.

Core principle:

> **Build every common interaction once, then reuse it everywhere.**

These components support the Homepage, PLPs, Search, Brand and Collection pages, PDPs, Cart, Checkout, Account, Order Tracking, and supporting pages.

---

## 2. Global Design Principles

All components follow the SHADESUK direction:

- Premium
- Minimal
- Editorial
- Product-first
- Modern
- Restrained
- High whitespace
- Strong typography
- Clear hierarchy

Avoid excessive rounded cards, generic SaaS UI, glassmorphism, decorative gradients, heavy shadows, fake luxury styling, unnecessary icons, excessive badges, decorative UI without purpose, excessive animation, and template-like layouts.

Components should disappear into the experience rather than becoming the experience.

---

## 3. Component Architecture

### Foundation

```text
Typography
Spacing
Colours
Icons
Buttons
Links
Inputs
Focus states
```

### Core UI

```text
Header
Navigation
Drawer
Modal
Toast
Accordion
Tabs
Select
QuantityControl
```

### Ecommerce

```text
ProductCard
ProductGrid
ProductGallery
FilterBar
FilterDrawer
SortControl
BagDrawer
CartItem
RecommendationRail
RecentlyViewed
```

### Account / Checkout

```text
AddressForm
AddressAutocomplete
PaymentSection
OrderSummary
OrderCard
TrackingTimeline
AccountNavigation
```

### States

```text
LoadingState
Skeleton
EmptyState
ErrorState
SuccessState
DisabledState
```

---

## 4. Header

Desktop:

```text
[SHADESUK]

SHOP
NEW ARRIVALS
BEST SELLERS
COLLECTIONS
ABOUT

SEARCH
ACCOUNT
BAG
```

The logo links to Home. There is no separate Home navigation item.

Mobile should use a compact:

```text
[Menu] [Logo] [Search] [Bag]
```

Account can be accessed through the menu or account control depending on final spacing.

The header must remain usable without excessive vertical height.

---

## 5. Navigation / Shop Menu

SHOP uses the locked discovery architecture.

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

- Meaningful styles only

Keep the menu compact. Do not create giant tile-based mega menus, excessive imagery, dozens of links, or unnecessary decorative sections.

---

## 6. Buttons

Use a small consistent button system.

### Primary

Major conversion actions:

- Add to Bag
- Checkout
- Pay
- Apply Filters
- Submit

### Secondary

Supporting actions:

- Continue Shopping
- View Collection
- Explore

### Tertiary / Text

Low-priority actions:

```text
View All
Learn More
Remove
```

Every button supports:

```text
Default
Hover
Focus
Active
Disabled
Loading
```

Do not create page-specific button styles.

---

## 7. Button Loading

Processing actions must communicate state and prevent duplicate submissions.

Examples:

```text
ADD TO BAG
→ ADDING…

PAY £49
→ PROCESSING PAYMENT…
```

---

## 8. Links

Links use consistent hover and focus behaviour.

Examples:

- Brand links
- Collection links
- Footer links
- Continue Shopping
- View All

Do not underline every piece of text.

---

## 9. Product Card

One ProductCard component is reused throughout:

- Homepage
- PLP
- Search
- Brand pages
- Collections
- New Arrivals
- Best Sellers
- Recommendations
- Recently Viewed

Structure:

```text
IMAGE

BRAND
MODEL NAME

£49
4 COLOURS
```

Optional:

- Colour swatches
- New Arrival
- Best Seller

No unnecessary badges.

---

## 10. Product Card States

Support:

- Default
- Hover
- Loading
- Out of stock
- Sold out
- Image unavailable
- Optional second-image hover

Never invent product imagery. Broken images must have a designed fallback.

---

## 11. Product Grid

ProductGrid controls:

- Columns
- Gaps
- Responsive behaviour
- Loading state
- Empty state
- Editorial inserts
- Progressive loading

Desktop: 4 columns.  
Mobile: 2 columns.  
Tablet responds to available width.

---

## 12. Product Image Behaviour

Requirements:

- Consistent aspect ratios
- No layout shift
- Responsive image sizes
- Lazy loading below the fold
- Optimised assets
- Appropriate object-fit
- High-quality product presentation

A second hover image may only appear if an actual second image exists.

---

## 13. Product Gallery

PDP gallery can support:

- Front
- Side
- Detail
- Back
- Temple
- On-model
- Packaging

Only existing images are displayed.

Desktop:

```text
Large main image
+
Thumbnail navigation
```

Mobile:

```text
Swipeable gallery
```

Lightbox may be used where useful.

---

## 14. Quantity Control

Reusable:

```text
−   1   +
```

Requirements:

- Minimum enforced
- Maximum enforced when applicable
- Disabled minus at minimum
- Accessible labels
- Keyboard support
- Appropriate loading feedback

---

## 15. Filters

FilterBar is shared across:

- PLP
- Search
- Brand pages
- Gender pages
- Shape pages
- Style pages
- New Arrivals
- Best Sellers

Core filters:

- Gender
- Brand
- Shape
- Colour
- Price
- Availability

Desktop uses a compact filter interface. Mobile uses a drawer or bottom sheet.

---

## 16. Filter Drawer

Mobile structure:

```text
FILTERS

Gender
Brand
Shape
Colour
Price
Availability

[Clear All] [Apply]
```

Requirements:

- Focus trap
- Escape to close
- Close control
- Apply
- Clear All
- Preserve selected values appropriately

Do not create excessive network requests for every individual selection unless technically justified.

---

## 17. Sort Control

Standard options:

```text
Featured
Newest
Price: Low to High
Price: High to Low
```

Sort remains visually secondary to products.

---

## 18. Active Filter Chips

Applied filters appear as removable chips:

```text
Brand: X ×
Shape: Aviator ×
Colour: Black ×
```

A global **Clear All** action must also be available.

---

## 19. Search Overlay

Search is global.

Desktop:

- Clean overlay/panel
- Automatic input focus
- Recent searches
- Product suggestions
- Brand/collection suggestions

Mobile:

- Full-width/full-screen where appropriate
- Keyboard-first interaction
- Clear close action

---

## 20. Search Suggestions

Suggestions may include:

```text
PRODUCTS
BRANDS
COLLECTIONS
RECENT SEARCHES
```

Prioritise relevance and avoid overwhelming lists.

---

## 21. Bag Drawer

After Add to Bag, the preferred experience is a Bag Drawer.

```text
YOUR BAG

Product
Colour
Size
Quantity
Price

Subtotal

[CHECKOUT]

Continue Shopping
```

It must:

- Confirm successful add
- Allow quantity adjustment
- Allow removal
- Link to product
- Show subtotal
- Lead to Checkout

---

## 22. Cart Page

Full Cart remains at:

```text
/cart
```

Desktop:

```text
PRODUCTS          ORDER SUMMARY
```

Mobile stacks product list and summary.

Each item confirms:

- Product
- Variant
- Colour
- Size/fit
- Quantity
- Price

---

## 23. Toast / Notification

Use toasts sparingly for lightweight feedback:

```text
Added to bag
Removed from bag
Address saved
Details updated
```

Critical failures must also receive inline feedback.

---

## 24. Modal

Reusable for:

- Confirmations
- Important information
- Fit guide
- Account prompts
- Controlled destructive actions

Requirements:

- Overlay
- Close control
- Escape
- Focus trap
- Focus restoration
- Mobile responsive behaviour

Do not use modals for information that belongs naturally inline.

---

## 25. Drawer

Reusable for:

- Mobile navigation
- Filters
- Bag
- Secondary utilities

Must have:

- Clear title
- Close control
- Accessible focus handling
- Predictable animation
- Correct scroll handling

---

## 26. Accordion

Primarily used for PDP information:

```text
Description
Details
What's Included
Shipping
Returns / Refunds
```

Keyboard accessible, with clear expanded/collapsed states and restrained transitions.

---

## 27. Fit Guide

Reusable `Find Your Fit` component.

```text
FIND YOUR FIT

01 KNOW YOUR SIZE
02 KNOW YOUR FACE
03 FIND YOUR STYLE
```

Face shapes:

- Oval
- Round
- Square
- Heart
- Oblong
- Diamond

Guidance is general styling guidance, not absolute rules.

The guide may link to relevant shape collections.

No AI face scanner or virtual try-on in V1.

---

## 28. Address Autocomplete

Reusable between Checkout and Account.

Flow:

```text
Enter address
↓
Suggestions
↓
Select address
↓
Populate fields
↓
Manual correction if required
```

Manual address entry must always remain possible.

The address provider must be replaceable without redesigning the component.

---

## 29. Forms

All forms consistently support:

```text
Label
Input
Helper text
Error
Success
Disabled
Loading
```

Do not rely on placeholders as labels.

---

## 30. Input States

Every input supports:

```text
Default
Hover
Focus
Filled
Error
Success
Disabled
Loading
```

Errors are human-readable.

---

## 31. Select / Dropdown

Reusable for:

- Size
- Sorting
- Address fields
- Other structured choices

Support keyboard navigation, focus, disabled state, selection, and mobile-friendly behaviour.

---

## 32. Loading States

Preserve layout wherever possible.

Preferred:

- Product-card skeletons
- Text skeletons
- Image skeletons
- Local loading indicators

Avoid replacing entire pages with generic spinners.

---

## 33. Skeletons

Skeleton dimensions should match final components.

Product skeleton:

```text
IMAGE
BRAND
MODEL
PRICE
COLOUR COUNT
```

This reduces layout shift.

---

## 34. Empty States

Every major system has a designed empty state.

### Empty Bag

```text
YOUR BAG IS EMPTY

Explore our latest collection.

[SHOP NEW ARRIVALS]
```

### No Search Results

```text
NO RESULTS FOR "BLACK"

Try another search or explore:

[NEW ARRIVALS]
[BEST SELLERS]
```

### No Orders

```text
NO ORDERS YET

Your orders will appear here after purchase.
```

### No Saved Addresses

```text
NO SAVED ADDRESSES

Add an address for faster checkout.
```

---

## 35. Error States

Global error:

```text
SOMETHING WENT WRONG

We couldn't complete that request.

[TRY AGAIN]
```

Preserve entered data/state where possible.

Do not unnecessarily restart the user's journey.

---

## 36. Success States

Use restrained confirmation.

Examples:

```text
ORDER PLACED
ADDRESS SAVED
DETAILS UPDATED
```

Major events such as completed orders should use dedicated confirmation pages.

---

## 37. Disabled States

Controls must clearly appear unavailable.

Examples:

- Out-of-stock size
- Minimum quantity
- Unavailable action
- Processing payment

Do not communicate disabled state through colour alone.

---

## 38. Checkout Components

Reusable:

```text
CheckoutHeader
ContactSection
DeliverySection
AddressForm
AddressAutocomplete
ShippingMethod
PaymentSection
OrderSummary
ReviewSection
CheckoutButton
```

Checkout remains distraction-free.

---

## 39. Order Summary

Shared across:

- Cart
- Checkout
- Confirmation
- Account order detail

Supports:

```text
Products
Quantity
Subtotal
Shipping
Total
```

All values are data-driven.

---

## 40. Order Status

Supported statuses:

```text
Order Placed
Processing
Dispatched
In Transit
Out for Delivery
Delivered
Exception
Tracking Not Available
```

Status is always driven by order data.

---

## 41. Tracking Timeline

Reusable:

```text
✓ Order Placed
✓ Processing
✓ Dispatched
● In Transit
○ Out for Delivery
○ Delivered
```

Actual status and timestamps are data-driven.

---

## 42. Account Components

Reusable:

```text
AccountNavigation
SignInForm
CreateAccountForm
ForgotPasswordForm
GoogleAuthButton

OrderCard
OrderDetail

PersonalDetailsForm

SavedAddressCard
AddressForm
AddressAutocomplete
```

Account remains secondary to shopping.

---

## 43. Destructive Actions

Use confirmation when an action can cause meaningful loss.

Example:

```text
Remove this saved address?
```

Avoid confirmations for trivial actions.

---

## 44. Responsive Rules

Components must adapt rather than simply shrink.

Desktop:

- Wider spacing
- Multi-column layouts
- Hover interactions
- Persistent navigation where appropriate

Mobile:

- Touch-friendly controls
- 2-column product grids
- Drawers instead of permanent side panels
- Simplified navigation
- Sticky purchase actions where required

---

## 45. Touch Targets

Interactive elements need comfortable touch targets.

Spacing must prevent accidental taps between:

- Quantity controls
- Close buttons
- Filters
- Product cards
- Navigation items

---

## 46. Accessibility

Every reusable component must support:

- Keyboard navigation
- Visible focus states
- Screen-reader labels
- Semantic HTML
- Correct ARIA where necessary
- Focus trapping for modal/drawer
- Focus restoration
- Logical tab order
- Accessible form errors
- Accessible loading states
- No colour-only communication

Accessibility is a component-level responsibility.

---

## 47. Focus States

All interactive elements require visible focus:

- Buttons
- Links
- Inputs
- Product cards
- Navigation
- Filters
- Selects
- Quantity controls

Never remove focus indicators without replacing them with a stronger accessible treatment.

---

## 48. Keyboard Behaviour

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

- Escape closes search
- Escape closes modal
- Escape closes drawer
- Arrow keys navigate suggestions where applicable
- Enter activates selected actions

---

## 49. Image Fallbacks

If an image fails:

- Preserve dimensions
- Avoid broken-image icons
- Use a restrained fallback
- Track asset failures where useful

Never automatically generate an artificial product image as a replacement.

---

## 50. Motion

Global motion should be:

- Fast
- Subtle
- Consistent
- Functional

Appropriate uses:

- Drawer transitions
- Modal transitions
- Menu transitions
- Image transitions
- Add-to-bag feedback
- Filter interactions

Avoid magnetic cursors, decorative parallax, long transitions, constant scroll effects, and unnecessary page animations.

Respect reduced-motion preferences.

---

## 51. No Duplicate Components

Each common component has one shared implementation:

```text
Button
Input
Select
Modal
Drawer
Toast
Accordion

ProductCard
ProductGrid
ProductGallery

FilterBar
FilterDrawer
SortControl

AddressAutocomplete
AddressForm

OrderSummary
OrderStatus
TrackingTimeline
```

Pages consume shared components rather than creating duplicates.

---

## 52. Component Data Rules

Components receive data through props, state, API responses, or controlled content/data sources.

Do not hard-code production:

- Product names
- Prices
- Brand names
- Stock
- Colour counts
- Order statuses
- Shipping values
- Customer details

Catalogue and order data must remain backend-driven.

---

## 53. State Management

Keep UI state local where possible.

### Local state

- Modal open
- Drawer open
- Accordion state
- Search input
- Filter UI before Apply

### Shared/server state

- Cart
- Customer session
- Products
- Inventory
- Orders
- Saved addresses

Avoid putting every UI interaction into global state.

---

## 54. Component Naming

Use clear responsibility-based names:

```text
ProductCard
ProductGrid
FilterDrawer
AddressAutocomplete
TrackingTimeline
OrderSummary
```

Avoid:

```text
Box
Thing
Section2
CardNew
ComponentFinal
```

---

## 55. Recommended Folder Architecture

```text
src/
  components/
    ui/
    navigation/
    product/
    discovery/
    cart/
    checkout/
    account/
    orders/
    forms/
    states/

  pages/
  layouts/
  hooks/
  lib/
  services/
  data/
  styles/
  types/
```

The framework can change; separation of responsibility should not.

---

## 56. Common State Vocabulary

Use a consistent state system:

```text
default
hover
focus
active
selected
disabled
loading
success
error
empty
unavailable
```

Components must not invent inconsistent state behaviour.

---

## 57. Build-Once Rule

Before creating a new component, ask:

> **Does an existing component already solve this problem?**

If yes, reuse it.

If not, create a reusable component rather than a page-specific implementation.

---

## 58. Global UI Quality Rule

Every interaction should answer:

- What happened?
- What is happening now?
- What can I do next?
- Can I recover if something failed?

Feedback should be immediate, clear, and restrained.

---

## 59. Implementation Checklist

### Navigation

- Header
- Desktop menu
- Mobile menu
- Shop discovery menu
- Search

### Commerce

- Product card
- Product grid
- Gallery
- Quantity control
- Bag drawer
- Cart
- Filters
- Sort

### Forms

- Input
- Select
- Address autocomplete
- Address form
- Validation

### Account

- Sign in
- Create account
- Forgot password
- Google auth
- Account navigation
- Orders
- Saved addresses

### Orders

- Order summary
- Order status
- Tracking timeline

### UI

- Modal
- Drawer
- Toast
- Accordion
- Loading
- Skeleton
- Empty
- Error
- Success

### Accessibility

- Focus
- Keyboard
- Screen reader
- Touch
- Reduced motion

---

## 60. Locked Summary

The SHADESUK frontend will use a disciplined, reusable component system.

Priority:

**Consistency → Reusability → Accessibility → Performance → Visual restraint**

The frontend must not become a collection of individually designed pages.

Instead:

```text
ONE DESIGN SYSTEM
        ↓
REUSABLE COMPONENTS
        ↓
CONSISTENT PAGE SYSTEM
        ↓
SCALABLE ECOMMERCE FRONTEND
```

The implementation must preserve:

> **Premium. Minimal. Editorial. Product-first. No AI slop.**

**This specification is locked for Global Components & UI States.**
