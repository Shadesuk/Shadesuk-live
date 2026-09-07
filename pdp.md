# SHADESUK — Product Detail Page (PDP)

**Status:** Approved  
**Direction:** Editorial commerce / product-first / premium restraint  
**Primary objective:** Turn product interest into purchase confidence and purchase action while continuing product discovery.

## 1. PDP North Star

The PDP is the primary conversion surface.

The page must answer:

> **I like these. Should I actually buy them?**

Customer journey:

**DESIRE → RECOGNITION → CHOICE → FIT → VALUE → CONFIDENCE → ACTION → DISCOVERY**

The product photography gets more visual real estate than the UI.

## 2. Above-the-Fold Architecture

Desktop:

**Large product gallery | Product information**

Product information hierarchy:
1. Product name
2. Price
3. Offer/sale information where applicable
4. Available colour count
5. Colour selection
6. Size / fit information
7. Size & Face Guide
8. Quantity
9. Add to Bag
10. Shipping reassurance
11. Payment reassurance

Do not bury the purchase action beneath large blocks of copy.

## 3. Product Gallery

Preferred imagery:
- Primary front view
- Side profile
- Detail
- Back/temple
- Authentic on-model imagery where available
- Packaging/accessories where actually supplied

Use only legitimate available imagery. Do not create synthetic imagery simply to make the gallery appear complete.

Desktop:
- Large primary image
- Thumbnail rail or controlled image navigation
- Click to enlarge
- Full-screen/lightbox view
- Optional subtle hover zoom

Mobile:
- Swipeable gallery
- Large product image
- Understated pagination such as `01 / 05`

## 4. Product Name

Strong but restrained. Avoid oversized typography that competes with the product.

## 5. Price

Price must be immediately visible.

Example:

**£49**

If discounted:

**£49**  
~~£69~~  
**SAVE £20**

Avoid giant promotional badges or aggressive sale graphics.

## 6. Colour System

The PDP must make the same colour information shown on the PLP actionable.

Example:

**4 COLOURS**

**COLOUR — BLACK**

`● ● ● ●`

Requirements:
- Only show real available colours.
- Selected state must be unmistakable.
- Image-based swatches may be used where actual colour imagery exists.
- Numerical colour count remains explicit.
- Variant changes should update relevant product information/image where supported.

Continuity:

**PLP: 4 COLOURS → PDP: 4 selectable colour variants**

## 7. Size / Fit Information

Show actual frame measurements where available.

Example:

**FRAME SIZE**

- Lens Width — 52 mm
- Bridge Width — 20 mm
- Temple Length — 145 mm

A simple fit label such as **MEDIUM FIT** may be used if the catalogue supports it, but numerical measurements remain authoritative.

Never invent measurements.

## 8. FIND YOUR FIT — Size & Face Guide

This is a required PDP feature.

The guide answers:
1. What size will fit me?
2. What frame shapes work with my face?
3. Which styles should I explore?

Trigger:

**FIND YOUR FIT →**

Open the guide without taking the customer away from the PDP.

### 8.1 Size Guide

Explain:
- Lens Width — width of one lens
- Bridge Width — distance between lenses
- Temple Length — length of the arm

Where appropriate, include a simple annotated frame diagram.

Values must correspond to the actual product.

### 8.2 Face Guide

Potential face shapes:
- Oval
- Round
- Square
- Heart
- Oblong
- Diamond

Use fashion guidance rather than absolute rules.

Example:

**ROUND**

Usually flattering:
- Rectangle
- Square
- Angular

### 8.3 Combined Guide Flow

**01 — KNOW YOUR SIZE**  
Frame measurements and how to understand them.

↓

**02 — KNOW YOUR FACE**  
Face-shape guidance.

↓

**03 — FIND YOUR STYLE**  
Recommended frame silhouettes.

This should feel like a premium shopping tool, not an AI quiz.

### 8.4 Guide → Product Discovery

Where product metadata supports it, the guide can lead to relevant products.

Example:

**ROUND FACE**

Recommended: **Rectangle / Square / Angular**

Then:

**RECOMMENDED FOR YOU**

Show relevant products.

Journey:

**Uncertainty → Guidance → Product discovery → Purchase**

Do not use an AI face scanner or camera-based try-on in V1.

## 9. Quantity

Keep quantity selection simple and adjacent to the purchase CTA without competing with it.

## 10. Add to Bag

Primary CTA:

**ADD TO BAG**

Use the approved deep navy primary button system.

V1 priority is Add to Bag. A separate Buy Now action is not required initially unless testing establishes a clear benefit.

## 11. Shipping Information

Shipping expectations must be visible before purchase.

Example:

**SHIPPING**

Minimum 2-week delivery timeframe.

Where appropriate, provide expandable detail covering international fulfilment and carrier transit.

Final wording follows the approved shipping policy.

Do not imply a guaranteed delivery date unless the service guarantees it.

## 12. Payment Reassurance

Near the purchase area:

**Secure card payment**

Potential supporting line:

**All major cards accepted**

Do not use a wall of payment logos.

## 13. Product Information

After the purchase area:

### DESCRIPTION
Concise product description.

### DETAILS
Potentially:
- Frame shape
- Dimensions
- Materials
- Lens information
- Colour
- Fit
- Other verified specifications

### WHAT'S INCLUDED
Only items actually supplied.

### SHIPPING
Detailed shipping information.

### RETURNS / REFUNDS
Link to approved policy.

## 14. Product Story

Optional and product-dependent.

Use a visual editorial moment with:
- Product image
- Product/model name
- Short statement about silhouette, shape or visual character

Use only genuine product/brand information.

## 15. Mandatory Product Disclosure

Every PDP must automatically display:

**High-quality 1:1 Superclone**

Implement as a reusable frontend component so it cannot be accidentally omitted from future products.

Place it near the bottom of the product information/content area rather than beside Add to Bag.

Final wording and legal presentation must be reviewed for applicable UK requirements before launch.

## 16. You May Also Like

The PDP must not become a dead end.

Section:

**YOU MAY ALSO LIKE**

Recommendations should be relevant to:
- Similar frame shapes
- Similar colours
- Similar styles
- Related catalogue products

Avoid random recommendations.

## 17. Recently Viewed

Section:

**RECENTLY VIEWED**

Useful because customers may compare several frames before purchasing.

## 18. Complete the Look

Optional.

Only introduce if the catalogue contains genuine complementary products or accessories.

## 19. Sticky Purchase Behaviour

### Mobile

After the primary Add to Bag area scrolls out of view, introduce a restrained sticky purchase bar.

Example:

**MODEL X — £49**

**ADD TO BAG**

Keep it compact and non-intrusive.

### Desktop

Do not automatically make the entire product information panel permanently sticky. Test against the actual gallery and content length.

## 20. Mobile PDP Architecture

```text
HEADER
↓
IMAGE GALLERY
↓
PRODUCT NAME
↓
PRICE
↓
COLOUR COUNT
↓
COLOUR SELECTION
↓
SIZE / FIT
↓
FIND YOUR FIT
↓
QUANTITY
↓
ADD TO BAG
↓
SHIPPING
↓
PAYMENT
↓
DESCRIPTION
↓
DETAILS
↓
PRODUCT STORY
↓
WHAT'S INCLUDED
↓
SHIPPING / RETURNS
↓
1:1 SUPERCLONE DISCLOSURE
↓
YOU MAY ALSO LIKE
↓
RECENTLY VIEWED
↓
FOOTER
```

Key sequence:

**IMAGE → PRODUCT → CHOICE → FIT → PURCHASE**

## 21. Desktop PDP Architecture

```text
HEADER
↓
┌──────────────────────┬─────────────────────────┐
│                      │ PRODUCT NAME            │
│                      │ PRICE                   │
│  PRODUCT GALLERY     │ COLOUR COUNT            │
│                      │ COLOUR                  │
│                      │ SIZE / FIT              │
│                      │ FIND YOUR FIT            │
│                      │ QUANTITY                │
│                      │ ADD TO BAG              │
│                      │ SHIPPING                │
│                      │ PAYMENT                 │
└──────────────────────┴─────────────────────────┘
↓
DESCRIPTION / DETAILS
↓
PRODUCT STORY
↓
SHIPPING / RETURNS
↓
DISCLOSURE
↓
YOU MAY ALSO LIKE
↓
RECENTLY VIEWED
↓
FOOTER
```

## 22. Conversion Hierarchy

**01 — Desire:** beautiful product photography  
↓  
**02 — Recognition:** what is it?  
↓  
**03 — Choice:** which colour / variant?  
↓  
**04 — Fit:** will it fit and suit me?  
↓  
**05 — Value:** how much?  
↓  
**06 — Confidence:** shipping, payment, specifications  
↓  
**07 — Action:** ADD TO BAG  
↓  
**08 — Continued discovery:** related products and recently viewed

## 23. No-Friction Requirements

The customer must not have to leave the PDP to discover:
- Available colours
- Frame measurements
- Basic fit information
- Face-shape guidance
- Shipping expectation
- Payment method
- Product specifications

## 24. Authenticity of Content

Never invent:
- Product measurements
- Materials
- Lens specifications
- Included accessories
- Reviews
- Model imagery
- Product claims

If data is unavailable, omit the field gracefully rather than fabricate it.

## 25. Anti-AI-Slop Rules

Do not use:
- Giant review-star blocks
- Fake urgency
- Fake stock counters
- Countdown timers
- Giant discount graphics
- Payment-logo walls
- Excessive badges
- Fake specifications
- Fake reviews
- AI-generated models used as filler
- Excessive accordions
- Floating UI everywhere
- Multiple competing CTAs
- Decorative gradients
- Glassmorphism
- Excessive rounded containers
- Cursor gimmicks
- Unnecessary animations

The product remains the hero.

## 26. PDP Success Criteria

A customer should be able to:
1. Understand the product immediately.
2. See high-quality imagery.
3. Know the price.
4. Know how many colour options exist.
5. Select a colour easily.
6. Understand frame measurements.
7. Access the Size & Face Guide.
8. Understand likely face-shape suitability.
9. Understand shipping expectations.
10. Understand payment reassurance.
11. Add the product to Bag without friction.
12. Continue discovering relevant products afterward.

## 27. PDP North Star

> **Make the customer confident enough to buy — without making the interface do the selling.**

The product, photography, typography and information hierarchy create confidence.

The UI removes friction.
