# SHADESUK — SEO + Performance Specification

**Document:** SEO + Performance  
**Project:** SHADESUK  
**Scope:** Frontend / Technical SEO / Performance  
**Status:** LOCKED  
**Purpose:** Practical V1 requirements for discoverability and site speed

---

# 1. Purpose

SEO is a supporting requirement for SHADESUK, not the driver of the design or frontend architecture.

The rule is:

> **Make every important page technically understandable and indexable. Do not design the website around SEO.**

Performance is more important to the customer experience, particularly because SHADESUK is an image-heavy ecommerce website.

---

# 2. Clean URLs

Use clear, human-readable URLs.

Examples:

```text
/product/[product-slug]
/brands/[brand-slug]
/collections/[collection-slug]

/new-arrivals
/best-sellers

/men
/women
/unisex

/search?q=black
```

Avoid unnecessarily complicated URLs.

---

# 3. Page Titles

Important pages should have appropriate titles.

Examples:

```text
Aviator Sunglasses | SHADESUK
Brand Name Model | SHADESUK
New Arrivals | SHADESUK
Men's Sunglasses | SHADESUK
```

Titles should be useful and readable.

Do not keyword-stuff titles.

---

# 4. Meta Descriptions

Important pages should have appropriate meta descriptions.

Descriptions should be:

- Relevant to the page
- Unique where practical
- Written for humans
- Concise

A complex automated SEO content system is not required for V1.

---

# 5. Product SEO

Product pages should expose meaningful product information:

- Product name
- Brand
- Description
- Price
- Availability
- Images
- Variant information

Use appropriate Product structured data where applicable.

All values must come from real product data.

---

# 6. Image SEO

Meaningful product images should have useful alternative text.

Example:

```text
Black aviator sunglasses by [Brand]
```

Avoid meaningless filenames/text such as:

```text
IMG_4829.jpg
```

Do not keyword-stuff alt text.

Decorative imagery should be treated appropriately for accessibility.

---

# 7. Canonical URLs

Important canonical pages should have clear canonical URLs.

Intentional pages such as:

```text
Product
Brand
Shape Collection
Gender
New Arrivals
Best Sellers
```

can be indexable when appropriate.

Random filter combinations should generally not become separate indexable pages.

Examples:

```text
?brand=x
?shape=aviator
?colour=black
```

should be handled appropriately through canonicalisation/indexing rules.

This prevents large numbers of thin or duplicate URLs.

---

# 8. Sitemap

Provide:

```text
sitemap.xml
```

The sitemap should primarily contain pages that SHADESUK actually wants indexed.

Do not expose every temporary/filter URL.

---

# 9. Robots

Provide:

```text
robots.txt
```

Use it to communicate appropriate crawler rules.

Keep the configuration simple and intentional.

---

# 10. 404 Page

Create a proper branded 404 page.

Example:

```text
THIS PAGE DOESN'T EXIST

The page you're looking for may have moved.

[BACK TO SHOP]
```

The page should give the customer useful paths back into the store.

---

# 11. Image Performance

This is the most important performance area for SHADESUK.

Use:

- WebP/AVIF where appropriate
- Responsive image sizes
- Compression
- Lazy loading below the fold
- Proper image dimensions
- Optimised thumbnails
- Appropriate image resolution

A mobile user should not unnecessarily download a huge desktop image.

---

# 12. Above-the-Fold Loading

The first visible content should receive priority.

Especially:

- Homepage hero
- Initial product content
- Primary PDP image

Do not load the entire catalogue before displaying the first screen.

---

# 13. Lazy Loading

Below-the-fold content should load progressively where appropriate.

Potential lazy-loaded content:

- Product images
- Editorial images
- Recommendations
- Recently Viewed

Primary above-the-fold imagery should not be unnecessarily delayed.

---

# 14. Fonts

Use the selected primary typeface efficiently.

Requirements:

- Load only required weights
- Avoid unnecessary font families
- Avoid duplicate font files
- Ensure typography does not create major layout shifts

---

# 15. JavaScript

Keep frontend JavaScript lean.

Do not install libraries simply because they are available.

Avoid unnecessary dependencies for:

- Animation
- Cursor effects
- Parallax
- Decorative interactions
- Oversized icon libraries
- UI features that can be implemented simply

Performance should take priority over decorative effects.

---

# 16. Loading Experience

Use the reusable loading system already defined in the Global Components specification.

Prefer:

- Skeletons
- Local loading states
- Progressive content loading

Avoid generic full-page spinners wherever possible.

---

# 17. Core Web Vitals

The production frontend should target good performance for:

```text
LCP
CLS
INP
```

Developers should test the production build and address obvious performance problems before launch.

The project does not require a complicated performance-monitoring architecture for V1.

---

# 18. Caching

Static assets should use appropriate caching.

Catalogue data may be cached where appropriate.

Inventory-sensitive information must remain accurate.

Caching must not cause customers to see obviously outdated stock information.

---

# 19. Mobile Performance

Mobile performance receives priority because customers may be using:

- Slower networks
- Smaller devices
- Mobile browsers
- Limited device resources

Prioritise:

- Fast first render
- Optimised images
- Minimal blocking JavaScript
- Progressive loading
- Stable layouts
- Limited animation
- Efficient interactions

---

# 20. What Is Not Required for V1

Do not over-engineer SEO.

Not required:

- Complicated SEO dashboards
- Hundreds of programmatic landing pages
- Keyword-stuffed collection pages
- Dozens of artificial category pages
- Blog-first SEO strategy
- Complex schema architecture
- Automated SEO content-generation pipelines
- SEO-driven UI decisions
- Separate SEO components throughout the application

The customer experience remains the primary objective.

---

# 21. Implementation Principle

### SEO

> **Make every important page technically understandable and indexable. Do not design the website around SEO.**

### Performance

> **Make the site fast, especially on mobile, without sacrificing product image quality.**

---

# 22. Locked Summary

### SEO

- Clean URLs
- Page titles
- Meta descriptions
- Product structured data where appropriate
- Useful image alt text
- Canonicals
- Sitemap
- Robots
- Branded 404
- No artificial SEO page explosion

### Performance

- Optimised images
- Responsive images
- Lazy loading
- Above-the-fold priority
- Efficient fonts
- Lean JavaScript
- Skeleton/loading states
- Good LCP, CLS and INP
- Sensible caching
- Mobile-first performance

**This specification is locked for SEO + Performance.**
