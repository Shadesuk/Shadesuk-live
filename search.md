# SHADESUK — Search Frontend Specification

**Status:** LOCKED  
**Section:** 8 of the ShadesUK Frontend System  
**Direction:** Fast, editorial, product-first, low friction

---

# 1. Search Objective

Search is a core shopping tool, not simply a results page.

> **Let a customer find the right pair with as little friction as possible.**

Search must use the same catalogue and product components as PLP.

---

# 2. Search Entry

Desktop header:

**SEARCH**

Open a clean search overlay.

```text
SEARCH

What are you looking for?

[ Search shades...                         × ]

────────────────────────────────────────

SUGGESTED

Rectangle
Black
Aviator
New Arrivals
Best Sellers
```

The interface should feel spacious and editorial rather than marketplace-like.

---

# 3. Search While Typing

When the customer types:

```text
SEARCH

black

────────────────────────────────────────

PRODUCTS

[ image ]  MODEL X
           £49

[ image ]  MODEL Y
           £55

────────────────────────────────────────

COLLECTIONS

Black Shades
Best Sellers
```

Prioritise useful actual products without overwhelming the customer.

---

# 4. Search Suggestions

Suggestions can include:

### Products
- Product name
- Model
- Variant
- Colour
- Shape

### Collections
- Men
- Women
- Unisex
- Aviator
- Rectangle
- Square
- New Arrivals
- Best Sellers

### Recent searches

For returning customers:

```text
RECENT SEARCHES

black
aviator
square

CLEAR
```

Do not retain sensitive search information unnecessarily.

---

# 5. Search Results

Press Enter or select **VIEW ALL RESULTS**.

Route example:

`/search?q=black`

The results page behaves like a PLP:

```text
SEARCH RESULTS

BLACK

42 RESULTS

FILTER
SORT

[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]
[ PRODUCT ] [ PRODUCT ] [ PRODUCT ] [ PRODUCT ]
```

Use the same grid, product card, filtering and sorting system.

---

# 6. Product Card Consistency

Search cards must retain the PLP hierarchy:

**IMAGE**

**PRODUCT NAME**

**PRICE**

**AVAILABLE COLOURS**

Example:

**MODEL X**  
£49  
**4 COLOURS**

Search must not introduce a separate product-card language.

---

# 7. Search by Product Attributes

The search experience should be capable of supporting meaningful attribute queries such as:

- `black`
- `aviator`
- `round`
- `women`
- `black aviator`

The exact search engine and fuzzy matching logic are backend/search-infrastructure decisions.

The frontend must be capable of presenting the resulting products and filters.

---

# 8. Search Filters

Reuse the PLP filter system.

Potential filters:
- Gender
- Shape
- Colour
- Price
- Availability

Do not create a separate search-specific filter architecture.

---

# 9. Search Sorting

Reuse PLP sorting options.

Potential options:
- Featured
- Newest
- Price: Low to High
- Price: High to Low

Final options must match the catalogue logic.

---

# 10. No Results

Never leave the customer at a dead end.

```text
NO RESULTS FOR
"PURPLE AVIATOR"

Try another search.

[ SEARCH AGAIN ]

OR

EXPLORE SHADES

New Arrivals
Best Sellers
```

A small selection of relevant products may appear below.

---

# 11. Typo / Approximate Search

Support an approximate-match state.

Example query:

`aviater`

Frontend may display:

```text
NO EXACT MATCH

Showing results for:

AVIATOR
```

The actual fuzzy-search implementation is backend/search-engine territory.

---

# 12. Search Loading

Use restrained product skeletons rather than a full-screen generic spinner.

```text
[ IMAGE SKELETON ] [ IMAGE SKELETON ]
[ IMAGE SKELETON ] [ IMAGE SKELETON ]
```

---

# 13. Search Error

```text
SEARCH UNAVAILABLE

We couldn't load results right now.

[ TRY AGAIN ]
```

Do not expose technical error messages.

---

# 14. Mobile Search

Mobile search should occupy most of the screen.

```text
SEARCH

←

[ Search shades...                     ]

RECENT SEARCHES

black
aviator
round

SUGGESTED

New Arrivals
Best Sellers
```

Suggestions should appear immediately as the customer types.

---

# 15. Mobile Search Results

```text
SEARCH

BLACK

42 RESULTS

FILTER     SORT

[ PRODUCT ] [ PRODUCT ]
[ PRODUCT ] [ PRODUCT ]
[ PRODUCT ] [ PRODUCT ]
```

Use the same two-column product grid as PLP.

---

# 16. Search Interaction

Preferred flow:

```text
HEADER
↓
SEARCH
↓
TYPE
↓
LIVE SUGGESTIONS
↓
SELECT PRODUCT
       OR
VIEW ALL RESULTS
↓
SEARCH RESULTS
↓
PDP
```

No unnecessary intermediate screen.

---

# 17. Search → PDP

Selecting a product takes the customer directly to its PDP.

When returning to Search, preserve the search context where technically appropriate rather than unnecessarily resetting the experience.

---

# 18. Search → Collection

If a suggestion corresponds to a real, meaningful collection, it can link directly to that collection.

Do not generate thin collection pages for arbitrary search terms.

---

# 19. Search Analytics

Frontend should expose events such as:

```text
search_open
search_started
search_query
search_suggestion_view
search_suggestion_click
search_result_view
search_result_click
search_no_results
search_filter_used
search_sort_used
```

Useful context can include:
- Search query
- Result count
- Suggestion type
- Product ID where applicable

Analytics platform can be selected later.

---

# 20. Search Accessibility

Support:
- Keyboard navigation
- Screen readers
- Visible focus
- Escape to close overlay
- Enter to search
- Arrow-key navigation through suggestions
- Proper search input label
- Accessible suggestion list
- Mobile touch targets

The overlay should manage focus correctly while open.

---

# 21. Search Performance

Suggestions should feel immediate.

Frontend should:
- Debounce requests where appropriate
- Avoid unnecessary requests
- Show useful loading states
- Cache suitable recent results where appropriate
- Avoid loading the full product catalogue into the browser

Exact infrastructure remains a backend decision.

---

# 22. Search Data Requirements

Results should support:
- Product ID
- Product name
- Product image
- Price
- Colour count
- Available colours
- Shape
- Gender
- Collection
- Availability
- Product URL

Suggestions should support:
- Product
- Collection
- Search term

---

# 23. Search + PLP Relationship

Locked principle:

> **Search is another entry point into the same catalogue system.**

Therefore:

**Same ProductCard**

**Same ProductGrid**

**Same Filters**

**Same Sort**

**Same responsive behaviour**

**Same product data**

---

# 24. Anti-AI-Slop Rules

Do not use:
- Giant search illustrations
- AI-assistant/chatbot behaviour
- Excessive animations
- Huge category clouds
- Random recommendations
- Decorative gradients
- Floating search widgets
- Artificial conversational copy

Search is a fashion ecommerce utility.

Keep it fast and quiet.

---

# 25. Search Success Criteria

A customer can:
1. Open search from anywhere.
2. Start typing immediately.
3. See useful suggestions.
4. Find products by name.
5. Find products by colour.
6. Find products by shape.
7. Find products by meaningful collection.
8. See recent searches.
9. Clear recent searches.
10. View all results.
11. Filter results.
12. Sort results.
13. Handle approximate/typo searches.
14. Understand no-result states.
15. Recover from errors.
16. Open a product directly.
17. Return to the previous search context.
18. Use the experience comfortably on mobile.

---

# 26. Locked Search Architecture

```text
GLOBAL HEADER
      ↓
SEARCH OVERLAY
      ↓
┌─────────────────────────┐
│ SEARCH INPUT            │
│                         │
│ RECENT SEARCHES         │
│                         │
│ PRODUCT SUGGESTIONS     │
│ COLLECTION SUGGESTIONS  │
└─────────────────────────┘
      ↓
VIEW ALL RESULTS
      ↓
SEARCH RESULTS
      ↓
FILTER / SORT
      ↓
PRODUCT GRID
      ↓
PDP
```

---

# 27. Final Principle

> **Search should feel like a shortcut, not another destination.**

If a customer knows what they want, get them there quickly.

If they don't, help them discover without turning Search into a chatbot or cluttered marketplace.
