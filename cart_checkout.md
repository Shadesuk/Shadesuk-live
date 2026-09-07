# SHADESUK — Cart + Checkout Frontend Specification

**Status:** Locked  
**Direction:** Quiet luxury / conversion-first / seamless continuation of the storefront  
**Scope:** Frontend architecture and UX only. Backend/payment/carrier implementation is a later phase.

---

# 1. North Star

The Cart and Checkout should feel like a natural continuation of the ShadesUK storefront.

The customer journey is:

**PDP → ADD TO BAG → BAG DRAWER → CART → GUEST CHECKOUT → ORDER CONFIRMATION → TRACK ORDER**

The experience should feel:

- Clean
- Fast
- Trustworthy
- Premium
- Low-friction
- Consistent with the editorial storefront

The checkout should never suddenly look like a generic ecommerce template.

---

# 2. Cart Objective

The Cart has one job:

> **Confirm the purchase and remove the final reasons to hesitate.**

No unnecessary editorial content, promotional clutter or distractions.

Desktop should use a restrained two-column structure:

```text
CART

YOUR BAG

┌────────────────────────────┐
│ PRODUCT IMAGE              │
│ MODEL NAME                 │
│ COLOUR                     │
│ SIZE / FIT                 │
│                            │
│ QTY   −  1  +              │
│                            │
│ £49                    ×   │
└────────────────────────────┘


                              ORDER SUMMARY

                              Subtotal     £49
                              Shipping     —
                              ─────────────────
                              TOTAL        £49

                              [ CHECKOUT ]

                              Secure payment
                              All major cards accepted
```

---

# 3. Cart Product Row

Each item should show:

- Product image
- Product name
- Selected colour
- Size / fit
- Quantity
- Price
- Remove

Example:

**SHADES MODEL X**  
Black · Medium  
£49

`− 1 +`

`REMOVE`

Do not use giant product cards or excessive borders.

---

# 4. Variant Confirmation

The Cart must clearly confirm the selected variant.

Example:

**BLACK**

**MEDIUM FIT**

This reduces uncertainty about what was added.

The product's selected colour and fit should remain editable where the catalogue/implementation supports it.

---

# 5. Order Summary

Keep it concise.

```text
SUBTOTAL                 £49

SHIPPING                 Calculated at checkout

────────────────────────────

TOTAL                    £49
```

Only display shipping values that are actually known.

Never fabricate shipping costs.

---

# 6. Cart CTA

Primary CTA:

**CHECKOUT**

Secondary action:

**CONTINUE SHOPPING**

Checkout must be visually dominant.

Do not use competing primary purchase actions.

---

# 7. Empty Cart

The empty state should remain minimal and premium.

```text
YOUR BAG IS EMPTY

Nothing here yet.

[ EXPLORE SHADES ]
```

A small product selection may appear below, limited to genuinely relevant products.

Do not turn the empty cart into a catalogue.

---

# 8. Mini Cart / Bag Drawer

After Add to Bag, show a restrained bag confirmation.

Example:

```text
YOUR BAG

MODEL X
Black · Medium

£49

[ VIEW BAG ]
[ CHECKOUT ]
```

The drawer should confirm the action without becoming a large intrusive popup.

Desktop:
- Side drawer or compact panel
- No full-screen takeover

Mobile:
- Compact bottom drawer or equivalent dedicated transition

The exact interaction should be refined during implementation.

---

# 9. Cart → Checkout Transition

The conversion path should be explicit:

**PDP**

↓  
**ADD TO BAG**

↓  
**BAG DRAWER**

↓  
**VIEW BAG / CHECKOUT**

↓  
**GUEST CHECKOUT**

↓

**ORDER CONFIRMATION**

The customer should never be forced through unnecessary intermediate screens.

---

# 10. Checkout Philosophy

The checkout should communicate:

> **You're already buying. This is simply the final confirmation.**

Avoid unnecessary steps.

The conceptual flow is:

### STEP 01 — CONTACT
Email / required contact information.

### STEP 02 — DELIVERY
Shipping address.

### STEP 03 — PAYMENT
Card payment.

### STEP 04 — REVIEW
Final order confirmation.

Where the final payment implementation allows it, these can be presented as one streamlined checkout experience rather than four separate pages.

---

# 11. Guest Checkout — Mandatory

Guest checkout must be the default.

The customer must not be forced to create an account before purchasing.

Primary path:

**CONTINUE AS GUEST**

Secondary path:

**Have an account? Sign in**

Account creation can be offered after purchase or as a secondary option.

This is a core conversion requirement.

---

# 12. Account / Google Sign-In

Account functionality exists separately from guest purchasing.

Checkout should not be dominated by account creation.

Possible structure:

**Email**

Then:

**Continue as guest**

and, where relevant:

**Sign in**

Google authentication belongs to the account/sign-in experience rather than becoming a checkout barrier.

---

# 13. Contact Information

Clean form design:

```text
CONTACT

Email
[________________________]
```

Use standard browser autocomplete semantics so returning customers can benefit from their browser/device's saved information.

---

# 14. Delivery Address — Auto Address Feature

This is a locked checkout requirement.

ShadesUK should support **address autocomplete / address search** so customers do not have to manually type every part of their UK address.

Preferred interaction:

```text
DELIVERY ADDRESS

Start typing your address...

[ 221B Baker Street, London NW1... ]

[ 10 Downing Street, London SW1... ]

[ ... ]
```

Customer selects an address.

The interface then populates the appropriate fields automatically.

Potential fields:

- Address line 1
- Address line 2
- City / town
- County where required
- Postcode
- Country

The customer must still be able to edit the populated fields.

---

# 15. Address Autocomplete Implementation Principle

The frontend should be designed so the address provider can be changed without redesigning checkout.

Use an abstraction around the address lookup service rather than coupling the UI directly to one provider.

### Required behaviour

1. Customer starts typing.
2. Suggestions appear.
3. Customer selects a suggestion.
4. Address fields populate.
5. Customer can edit any field.
6. Customer can manually enter an address if lookup fails.

### Free / low-cost approach

The initial implementation should use a provider with an appropriate free tier or low-volume allowance.

Browser/device autofill is inherently free and should also be supported through correct HTML autocomplete attributes.

Do not architect the frontend around a paid provider being permanently free.

The provider can be selected during backend/integration implementation.

---

# 16. Manual Address Fallback

Address autocomplete must never be the only method.

Provide a clear fallback:

**ENTER ADDRESS MANUALLY**

This is required for:
- Addresses not found by the provider
- New developments
- Unusual addresses
- Flats/units where lookup is incomplete
- Any customer who prefers manual entry

The manually entered fields should use the same visual system as autocomplete-populated fields.

---

# 17. Delivery Form

Example:

```text
DELIVERY ADDRESS

Start typing your address...
[________________________]

or

ENTER ADDRESS MANUALLY

First name
[________________________]

Last name
[________________________]

Address line 1
[________________________]

Address line 2
[________________________]

City / Town
[________________________]

Postcode
[________________________]

Country
[ United Kingdom ▼ ]
```

Do not expose unnecessary address fields before they are needed.

The exact field requirements will be finalized with the delivery implementation.

---

# 18. Shipping Expectation

Shipping expectations must be visible before payment.

Example:

**DELIVERY**

Minimum 2-week delivery timeframe.

Then:

**Shipping information →**

The final customer-facing wording must follow the approved shipping policy.

Never imply an exact guaranteed delivery date unless the service guarantees it.

---

# 19. Payment

Payment should feel extremely trustworthy without looking like a payment portal.

Example:

**PAYMENT**

Card details

`Card number`

`MM / YY` `CVC`

Then:

**Secure card payment**

Supporting line:

**All major cards accepted**

The actual payment implementation is a backend/integration phase. The frontend should remain implementation-agnostic.

---

# 20. Trust Without Badge Slop

Do not use:

- Giant security badges
- Fake trust statistics
- Fake review counts
- Excessive payment logos
- "100% SECURE" graphics
- Artificial trust claims

Use restrained reassurance:

**Secure card payment**

That is sufficient.

---

# 21. Order Review

Before final payment, provide a concise review.

```text
YOUR ORDER

MODEL X
Black · Medium
Qty 1

£49

DELIVERY
Minimum 2 weeks

PAYMENT
•••• 4242

TOTAL
£49

[ PAY £49 ]
```

The final CTA may be **PAY £49** or **PLACE ORDER**, depending on the final payment flow.

Preferred direction:

**PAY £49**

when the implementation can clearly support that wording.

---

# 22. Mobile Checkout

Mobile must be even more disciplined.

```text
CHECKOUT

CONTACT
↓

DELIVERY
↓

SHIPPING
Minimum 2 weeks

↓

PAYMENT
↓

ORDER SUMMARY

MODEL X
Black · Medium
£49

TOTAL
£49

[ PAY £49 ]
```

The order summary may become collapsible if the page becomes long.

---

# 23. Cart and Checkout Error States

Errors must be:

- Inline
- Specific
- Human-readable
- Positioned near the affected field

Avoid:

> Something went wrong.

Prefer:

> Enter a valid postcode.

or:

> Your card was declined. Check the details or try another card.

Frontend states must account for:

- Invalid email
- Missing address
- Invalid postcode
- Payment failure
- Session timeout
- Item unavailable
- Network failure

---

# 24. Cart Product Discovery

The Cart may contain a restrained:

**YOU MAY ALSO LIKE**

Only show genuinely relevant products.

Maximum initial recommendation:

**4 products**

Checkout should be essentially distraction-free.

Once the customer reaches payment, do not introduce aggressive cross-selling.

---

# 25. Order Confirmation

The confirmation page is part of the checkout experience.

Example:

```text
ORDER CONFIRMED

Thank you.

ORDER #XXXXXX

MODEL X
Black · Medium
Qty 1

TOTAL £49

DELIVERY
Minimum 2 weeks

We'll send your order updates to:
customer@email.com

[ TRACK ORDER ]

CONTINUE SHOPPING
```

The page should feel calm and reassuring rather than celebratory or gimmicky.

No confetti.

---

# 26. Guest Order Tracking

A guest customer must be able to track their order without being forced to create an account.

The frontend should accommodate a secure order-tracking route/reference system.

Potential structure:

**TRACK ORDER**

- Order reference
- Required verification detail

The final authentication method will be determined during backend implementation.

---

# 27. Checkout Navigation

The checkout should not encourage unnecessary browsing.

Avoid:
- Full merchandising header
- Large promotional banners
- Editorial content
- Popups
- Promotional interruptions

A reduced checkout header is preferable.

The ShadesUK logo can remain present as a quiet brand anchor.

---

# 28. Responsive Architecture

### Desktop

Use the full two-column cart/checkout layout where appropriate.

### Tablet

Collapse gracefully while maintaining:
- Clear hierarchy
- Comfortable form widths
- Visible order summary

### Mobile

Prioritise:
- Form readability
- Large enough touch targets
- Sticky or clearly accessible final CTA where appropriate
- Compact order summary
- Fast address selection

---

# 29. Accessibility Requirements

Forms and checkout controls must support:

- Keyboard navigation
- Visible focus states
- Proper labels
- Screen-reader-friendly field names
- Error association with fields
- Sufficient touch target size
- Clear selected/unselected states
- No colour-only indication of errors

Address suggestions must be keyboard and screen-reader navigable.

---

# 30. Anti-AI-Slop Rules

Do not use:

- Fake urgency
- Fake stock counters
- Countdown timers
- Fake reviews
- Fake trust statistics
- Giant discount graphics
- Giant payment-logo walls
- Excessive badges
- Generic ecommerce illustrations
- Confetti
- Decorative gradients
- Glassmorphism
- Excessive rounded containers
- Unnecessary animations
- Floating UI everywhere
- Multiple competing CTAs

The checkout should feel **quiet, secure and inevitable**.

---

# 31. Frontend Data Requirements

The UI should be prepared to receive:

### Cart
- Product ID
- Product name
- Product image
- Selected colour
- Selected size/fit
- Quantity
- Unit price
- Line total

### Checkout
- Customer email
- Address fields
- Shipping option
- Shipping cost
- Order subtotal
- Total
- Payment status

### Confirmation
- Order reference
- Ordered items
- Total
- Delivery expectation
- Customer email
- Tracking availability

All values should come from real data.

Never hard-code product, price, shipping or order information into the production UI.

---

# 32. Engineering Flexibility

The frontend must not be tightly coupled to:

- One payment provider
- One address provider
- One shipping carrier
- One account provider

The UI should use clean service abstractions so integrations can be changed without redesigning the customer experience.

This is especially important for:
- Address autocomplete
- Payment
- Order tracking
- Shipping status

---

# 33. Cart + Checkout Success Criteria

A customer should be able to:

1. Add a product to Bag.
2. Immediately understand that it was added.
3. Confirm colour and size/fit.
4. Review the Cart quickly.
5. Continue as a guest.
6. Enter an email with browser autofill support.
7. Search for their address using autocomplete.
8. Select an address and have relevant fields populated.
9. Manually enter/edit the address when required.
10. Clearly understand the minimum 2-week delivery expectation.
11. Enter payment details securely.
12. Review the complete order.
13. Clearly understand the amount being paid.
14. Complete the order without unnecessary steps.
15. Receive a calm confirmation.
16. Track the order without being forced to create an account.

---

# 34. Locked Conversion Flow

```text
PRODUCT DETAIL
      ↓
ADD TO BAG
      ↓
BAG DRAWER
      ↓
CART
      ↓
CONTINUE AS GUEST
      ↓
CONTACT
      ↓
ADDRESS AUTOCOMPLETE
      ↓
DELIVERY
      ↓
PAYMENT
      ↓
ORDER REVIEW
      ↓
PAY £XX
      ↓
ORDER CONFIRMED
      ↓
TRACK ORDER
```

---

# 35. Final Principle

> **The checkout should remove friction, not add persuasion.**

The storefront creates desire.

The PDP creates confidence.

The Cart confirms the decision.

The Checkout makes completing that decision effortless.

The Order Confirmation reassures the customer that everything went through correctly.

That is the ShadesUK conversion system.
