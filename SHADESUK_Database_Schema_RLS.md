# SHADESUK --- Production Database Schema & RLS Specification

**Status:** PRODUCTION FOUNDATION --- LOCKED BEFORE IMPLEMENTATION\
**Purpose:** Single source of truth for Supabase database structure,
relationships, authentication boundaries, RLS policies,
order/payment/fulfilment state, and admin access.

> **Critical rule:** No production tables, foreign keys, status enums,
> or RLS policies should be implemented ad hoc in application code. This
> document must be reviewed before creating the first production
> migration.

------------------------------------------------------------------------

# 1. Architecture

## Core systems

``` text
SHADESUK Storefront
        │
        ├── Supabase Auth
        ├── Supabase Postgres
        └── Supabase Storage
                 │
                 ├── Products / Catalogue
                 ├── Customers / Addresses
                 ├── Cart
                 ├── Orders
                 ├── Payments
                 ├── Shipments / Tracking
                 └── Admin

Razorpay
   │
   └── Server-side payment creation + webhook verification

Resend
   │
   └── Transactional email delivery
```

## V1 fulfilment model

SHADESUK will **manually fulfil and ship orders**.

There is no requirement for a supplier API, carrier API, Royal Mail API,
or automated shipping-label integration in V1.

The database must therefore support manually entering:

-   Carrier
-   AWB / tracking number
-   Tracking URL
-   Shipment status
-   Shipment notes where appropriate

------------------------------------------------------------------------

# 2. Design Principles

1.  Use UUID primary keys unless a specific external/reference ID is
    required.
2.  Foreign keys must use explicit relationships.
3.  Monetary values must be stored as integer minor units, not
    floating-point values.
4.  Product/order records must preserve historical purchase information.
5.  Customer accounts are optional for purchasing.
6.  Guest orders must work without an authenticated customer account.
7.  Admin access must be explicitly authorised.
8.  Service-role operations must remain server-side.
9.  RLS must protect every customer-facing table.
10. Webhook processing must be idempotent.
11. Payment confirmation must come from verified Razorpay events, not
    frontend claims.
12. Order status and shipment status must be separate concepts.
13. Tracking information may be unavailable and must not be fabricated.
14. Product catalogue data must be backend-driven.
15. Avoid storing unnecessary sensitive information.

------------------------------------------------------------------------

# 3. Entity Relationship Overview

``` text
auth.users
    │
    └── profiles
          │
          ├── addresses
          │
          ├── carts
          │      └── cart_items ─── products / product_variants
          │
          └── orders
                 │
                 ├── order_items ─── products / product_variants
                 │
                 ├── payments
                 │
                 ├── shipments
                 │      └── tracking_events
                 │
                 └── order_events

products
    │
    ├── product_variants
    │
    ├── product_images
    │
    └── product_collections ─── collections

admin_users ─── auth.users

email_events ─── orders
```

------------------------------------------------------------------------

# 4. Authentication Model

Supabase Auth owns authentication identity.

Do **not** duplicate passwords or authentication credentials in public
tables.

Supported customer authentication:

-   Email/password
-   Google OAuth
-   Password reset
-   Email verification where configured

Guest checkout remains available.

------------------------------------------------------------------------

# 5. `profiles`

One customer profile per authenticated Supabase user.

  Column       Type          Rules
  ------------ ------------- --------------------------------
  id           uuid          PK, references `auth.users.id`
  email        text          NOT NULL, synced from auth
  first_name   text          nullable
  last_name    text          nullable
  phone        text          nullable
  created_at   timestamptz   NOT NULL
  updated_at   timestamptz   NOT NULL

### Relationship

``` text
auth.users.id → profiles.id
```

### Rules

-   Customers can read/update their own profile.
-   Customers cannot update their own ID.
-   Customers cannot change privileged/admin fields because no admin
    role belongs here.
-   Server-side processes may create/update profile records when
    appropriate.

------------------------------------------------------------------------

# 6. `admin_users`

Admin authorisation must be separate from normal customer profile data.

  Column       Type          Rules
  ------------ ------------- ------------------------------
  id           uuid          PK
  user_id      uuid          UNIQUE, FK → `auth.users.id`
  role         text/enum     NOT NULL
  is_active    boolean       NOT NULL DEFAULT true
  created_at   timestamptz   NOT NULL
  updated_at   timestamptz   NOT NULL

## V1 role

``` text
admin
```

Architecture should allow future roles such as:

``` text
admin
operations
support
```

without redesigning authentication.

### Critical security rule

A user is **not** an admin merely because their email looks like an
admin email.

Admin access must be determined from an authorised database record and
enforced server-side/RLS-side.

------------------------------------------------------------------------

# 7. Products

## `products`

Canonical product-level data.

  Column            Type          Rules
  ----------------- ------------- ------------------
  id                uuid          PK
  slug              text          UNIQUE, NOT NULL
  name              text          NOT NULL
  brand             text          nullable
  description       text          nullable
  details           jsonb         nullable
  materials         text          nullable
  what's_included   text          nullable
  shape             text          nullable
  gender            text          nullable
  fit               text          nullable
  disclosure        text          NOT NULL
  status            text/enum     NOT NULL
  created_at        timestamptz   NOT NULL
  updated_at        timestamptz   NOT NULL

### Disclosure

Every product must default to:

``` text
High-quality 1:1 Superclone
```

The frontend should also enforce this through a reusable component.

The final legal wording must be reviewed before launch.

------------------------------------------------------------------------

# 8. `product_variants`

Variants represent purchasable combinations such as colour/size.

  Column                   Type          Rules
  ------------------------ ------------- ------------------------
  id                       uuid          PK
  product_id               uuid          FK → `products.id`
  sku                      text          UNIQUE, NOT NULL
  colour_name              text          NOT NULL
  size_name                text          nullable
  price_minor              integer       NOT NULL
  compare_at_price_minor   integer       nullable
  currency                 text          NOT NULL DEFAULT `GBP`
  lens_width_mm            integer       nullable
  bridge_width_mm          integer       nullable
  temple_length_mm         integer       nullable
  stock_quantity           integer       NOT NULL DEFAULT 0
  status                   text/enum     NOT NULL
  created_at               timestamptz   NOT NULL
  updated_at               timestamptz   NOT NULL

### Rules

-   Never invent measurements.
-   Price is stored in minor units.
-   GBP is the V1 storefront currency unless deliberately changed.
-   A variant can be unavailable independently of the parent product.

------------------------------------------------------------------------

# 9. `product_images`

  Column         Type          Rules
  -------------- ------------- -------------------------------------
  id             uuid          PK
  product_id     uuid          FK → `products.id`
  variant_id     uuid          nullable FK → `product_variants.id`
  storage_path   text          NOT NULL
  alt_text       text          NOT NULL
  sort_order     integer       NOT NULL
  image_type     text/enum     NOT NULL
  created_at     timestamptz   NOT NULL

Possible image types:

``` text
primary
secondary
detail
side
lifestyle
```

Images should be stored through Supabase Storage rather than binary data
in Postgres.

------------------------------------------------------------------------

# 10. `collections`

  Column        Type          Rules
  ------------- ------------- ----------
  id            uuid          PK
  slug          text          UNIQUE
  name          text          NOT NULL
  description   text          nullable
  image_path    text          nullable
  status        text/enum     NOT NULL
  sort_order    integer       NOT NULL
  created_at    timestamptz   NOT NULL
  updated_at    timestamptz   NOT NULL

Only meaningful collections should become customer-facing navigation
destinations.

------------------------------------------------------------------------

# 11. `product_collections`

Many-to-many relationship.

  Column          Type          Rules
  --------------- ------------- -----------------------
  product_id      uuid          FK → `products.id`
  collection_id   uuid          FK → `collections.id`
  created_at      timestamptz   NOT NULL

Primary key:

``` text
(product_id, collection_id)
```

------------------------------------------------------------------------

# 12. Cart

## `carts`

Supports both guest and authenticated carts.

  Column       Type          Rules
  ------------ ------------- -------------------------------
  id           uuid          PK
  user_id      uuid          nullable FK → `auth.users.id`
  session_id   text          nullable
  status       text/enum     NOT NULL
  currency     text          NOT NULL DEFAULT `GBP`
  created_at   timestamptz   NOT NULL
  updated_at   timestamptz   NOT NULL

A guest cart must not require a customer account.

The implementation must define a secure guest session mechanism before
production.

## `cart_items`

  Column               Type          Rules
  -------------------- ------------- ----------------------------
  id                   uuid          PK
  cart_id              uuid          FK → `carts.id`
  product_variant_id   uuid          FK → `product_variants.id`
  quantity             integer       NOT NULL, \> 0
  unit_price_minor     integer       NOT NULL
  created_at           timestamptz   NOT NULL
  updated_at           timestamptz   NOT NULL

The cart item price is retained so checkout can validate pricing rather
than trusting client input.

------------------------------------------------------------------------

# 13. Addresses

## `addresses`

Saved customer addresses.

  Column           Type          Rules
  ---------------- ------------- ------------------------
  id               uuid          PK
  user_id          uuid          FK → `auth.users.id`
  label            text          nullable
  first_name       text          NOT NULL
  last_name        text          NOT NULL
  address_line_1   text          NOT NULL
  address_line_2   text          nullable
  city             text          NOT NULL
  county           text          nullable
  postcode         text          NOT NULL
  country          text          NOT NULL
  is_default       boolean       NOT NULL DEFAULT false
  created_at       timestamptz   NOT NULL
  updated_at       timestamptz   NOT NULL

Customers can save multiple addresses.

------------------------------------------------------------------------

# 14. Orders

## `orders`

The order is the central commerce record.

  Column                Type          Rules
  --------------------- ------------- -------------------------------
  id                    uuid          PK
  order_reference       text          UNIQUE, NOT NULL
  user_id               uuid          nullable FK → `auth.users.id`
  customer_email        text          NOT NULL
  customer_first_name   text          NOT NULL
  customer_last_name    text          NOT NULL
  status                text/enum     NOT NULL
  payment_status        text/enum     NOT NULL
  currency              text          NOT NULL DEFAULT `GBP`
  subtotal_minor        integer       NOT NULL
  shipping_minor        integer       NOT NULL
  total_minor           integer       NOT NULL
  delivery_address      jsonb         NOT NULL
  created_at            timestamptz   NOT NULL
  updated_at            timestamptz   NOT NULL

### Important

`user_id` is nullable because guest orders are supported.

The delivery address is copied into the order as a **snapshot**.

Do not rely on a customer's saved address record for historical orders.

If the customer later changes their saved address, the old order must
remain unchanged.

------------------------------------------------------------------------

# 15. Order Status

Locked customer-facing order lifecycle:

``` text
ORDER PLACED
    ↓
PROCESSING
    ↓
DISPATCHED
    ↓
IN TRANSIT
    ↓
OUT FOR DELIVERY
    ↓
DELIVERED
```

Additional states:

``` text
EXCEPTION
TRACKING NOT AVAILABLE
```

Internal database enum values may use stable machine-readable names:

``` text
placed
processing
dispatched
in_transit
out_for_delivery
delivered
exception
tracking_unavailable
```

Do not mix payment state with fulfilment state.

------------------------------------------------------------------------

# 16. `order_items`

Historical snapshot of what was purchased.

  Column               Type          Rules
  -------------------- ------------- -------------------------------------
  id                   uuid          PK
  order_id             uuid          FK → `orders.id`
  product_id           uuid          FK → `products.id`
  product_variant_id   uuid          nullable FK → `product_variants.id`
  sku                  text          NOT NULL
  product_name         text          NOT NULL
  variant_name         text          nullable
  quantity             integer       NOT NULL
  unit_price_minor     integer       NOT NULL
  line_total_minor     integer       NOT NULL
  product_snapshot     jsonb         nullable
  created_at           timestamptz   NOT NULL

### Historical data rule

Order items must retain the purchased product name, SKU, variant and
price.

If the catalogue changes later, old orders must still display what the
customer actually purchased.

------------------------------------------------------------------------

# 17. Payments

## `payments`

One order may have multiple payment attempts, but only the valid
captured payment should make the order paid.

  Column                Type          Rules
  --------------------- ------------- ----------------------
  id                    uuid          PK
  order_id              uuid          FK → `orders.id`
  provider              text          NOT NULL
  provider_order_id     text          UNIQUE where present
  provider_payment_id   text          UNIQUE where present
  amount_minor          integer       NOT NULL
  currency              text          NOT NULL
  status                text/enum     NOT NULL
  failure_reason        text          nullable
  captured_at           timestamptz   nullable
  created_at            timestamptz   NOT NULL
  updated_at            timestamptz   NOT NULL

Provider:

``` text
razorpay
```

Possible payment states:

``` text
created
authorized
captured
failed
cancelled
refunded
partially_refunded
```

Never store card numbers, CVV, or other sensitive card credentials.

------------------------------------------------------------------------

# 18. Razorpay Webhook Idempotency

## `payment_webhook_events`

  Column              Type          Rules
  ------------------- ------------- ------------------------
  id                  uuid          PK
  provider            text          NOT NULL
  provider_event_id   text          UNIQUE
  event_type          text          NOT NULL
  payload             jsonb         NOT NULL
  processed           boolean       NOT NULL DEFAULT false
  processed_at        timestamptz   nullable
  created_at          timestamptz   NOT NULL

### Rule

A webhook event must be safely re-playable.

Duplicate delivery of the same Razorpay event must not:

-   Create duplicate orders
-   Double-confirm payment
-   Deduct stock twice
-   Send duplicate order confirmation emails

Webhook signature verification must happen server-side.

------------------------------------------------------------------------

# 19. Shipment / Manual Fulfilment

## `shipments`

V1 uses manual fulfilment.

  Column            Type          Rules
  ----------------- ------------- -------------------------
  id                uuid          PK
  order_id          uuid          UNIQUE FK → `orders.id`
  carrier_name      text          nullable
  tracking_number   text          nullable
  tracking_url      text          nullable
  status            text/enum     NOT NULL
  shipped_at        timestamptz   nullable
  delivered_at      timestamptz   nullable
  notes             text          nullable
  created_at        timestamptz   NOT NULL
  updated_at        timestamptz   NOT NULL

### V1 workflow

Admin manually enters:

``` text
Carrier
AWB / Tracking Number
Tracking URL
```

The system then exposes this information to the customer.

Do not automatically claim a carrier status unless a real carrier
integration exists.

------------------------------------------------------------------------

# 20. `tracking_events`

Manual or future-provider tracking history.

  Column        Type          Rules
  ------------- ------------- -------------------------------
  id            uuid          PK
  shipment_id   uuid          FK → `shipments.id`
  status        text/enum     NOT NULL
  description   text          nullable
  occurred_at   timestamptz   NOT NULL
  created_by    uuid          nullable FK → `auth.users.id`
  created_at    timestamptz   NOT NULL

For V1, admin users may create these events manually.

Future carrier integrations can populate the same table.

------------------------------------------------------------------------

# 21. `order_events`

Audit/history of order lifecycle changes.

  Column          Type          Rules
  --------------- ------------- -------------------------------
  id              uuid          PK
  order_id        uuid          FK → `orders.id`
  event_type      text          NOT NULL
  old_status      text          nullable
  new_status      text          nullable
  actor_user_id   uuid          nullable FK → `auth.users.id`
  metadata        jsonb         nullable
  created_at      timestamptz   NOT NULL

Examples:

``` text
order_created
payment_confirmed
status_changed
shipment_created
tracking_added
tracking_updated
```

This provides an audit trail for admin operations.

------------------------------------------------------------------------

# 22. Email Events --- Resend

## `email_events`

This table records application-level transactional email attempts.

  Column                Type          Rules
  --------------------- ------------- ---------------------------
  id                    uuid          PK
  order_id              uuid          nullable FK → `orders.id`
  recipient_email       text          NOT NULL
  email_type            text          NOT NULL
  provider              text          NOT NULL
  provider_message_id   text          nullable
  status                text/enum     NOT NULL
  error_message         text          nullable
  sent_at               timestamptz   nullable
  created_at            timestamptz   NOT NULL

Provider:

``` text
resend
```

Possible email types:

``` text
order_confirmation
payment_failed
shipment_dispatched
tracking_update
order_delivered
account_verification
password_reset
```

### Important

Email sending must happen server-side.

The frontend must never call Resend directly with privileged
credentials.

Email triggers must be idempotent.

------------------------------------------------------------------------

# 23. Inventory

For V1, inventory can remain attached to
`product_variants.stock_quantity`.

However, all stock mutations must happen through trusted server-side
operations.

### Rules

-   Customer frontend cannot directly decrement stock.
-   Payment verification must not cause duplicate deductions.
-   Failed/cancelled payments must not permanently consume stock.
-   Inventory operations must be atomic.
-   Admin may adjust stock through protected operations.

If inventory complexity grows, a separate inventory ledger can be
introduced later without changing the customer-facing order model.

------------------------------------------------------------------------

# 24. RLS Strategy

RLS is mandatory.

## Public catalogue

Customers/anonymous visitors may read published:

-   Products
-   Product variants
-   Product images
-   Collections
-   Product/collection relationships

They must not directly write catalogue data.

## Customer-owned data

Authenticated users may access only their own:

-   Profile
-   Saved addresses
-   Cart
-   Orders
-   Order items
-   Shipment/tracking information belonging to their orders

## Guest orders

Guest order retrieval must **not** be implemented as:

``` text
SELECT * FROM orders WHERE order_reference = ...
```

without verification.

Guest tracking should use a secure server-side lookup requiring the
appropriate verification information.

Do not expose an order by predictable UUID/reference alone.

## Admin data

Only active authorised admins may:

-   Read all orders
-   Read customer/order operational data required for fulfilment
-   Update order status
-   Create/update shipments
-   Add tracking
-   Add tracking events
-   Manage catalogue
-   Manage inventory
-   Review payment state where operationally necessary

Admin write operations should preferably go through protected
server-side functions/routes in addition to RLS.

------------------------------------------------------------------------

# 25. RLS Policy Matrix

  --------------------------------------------------------------------------------------------------
  Table                       Anonymous Customer Read     Customer         Admin Read    Admin Write
                                   Read                      Write                    
  ------------------------ ------------ ------------- ------------ ------------------ --------------
  profiles                           No           Own          Own   Limited/required            Yes

  admin_users                        No            No           No       Own/required      Protected

  products                    Published     Published           No                Yes            Yes
                                   only          only                                 

  product_variants            Published     Published           No                Yes            Yes
                                   only          only                                 

  product_images              Published     Published           No                Yes            Yes
                                   only          only                                 

  collections                 Published     Published           No                Yes            Yes
                                   only          only                                 

  product_collections         Published     Published           No                Yes            Yes
                                   only          only                                 

  carts                              No           Own          Own   Operational only            Yes

  cart_items                         No           Own          Own   Operational only            Yes

  addresses                          No           Own          Own          Only when            Yes
                                                                        operationally 
                                                                             required 

  orders                      No direct           Own    No direct                Yes            Yes
                                 access                     status                    
                                                            writes                    

  order_items                        No           Own           No                Yes            Yes

  payments                           No   Own/limited           No                Yes      Protected

  payment_webhook_events             No            No           No   Operational only    Server only

  shipments                   No direct           Own           No                Yes            Yes

  tracking_events             No direct           Own           No                Yes            Yes

  order_events                No direct   Own/limited           No                Yes            Yes

  email_events                       No    No/limited           No        Operational   Server/admin
  --------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 26. Critical RLS Rules

### Never

``` sql
USING (true)
```

for private customer data.

### Customer ownership

Policies should derive ownership from authenticated identity:

``` text
auth.uid() = user_id
```

or through the appropriate order relationship.

### Admin check

Admin policies should use a secure helper function such as:

``` text
is_admin()
```

which checks an active authorised admin record.

Avoid duplicating complex admin checks across dozens of policies.

### Service role

The Supabase service role bypasses RLS.

Therefore:

> **Service-role credentials must never reach the browser.**

------------------------------------------------------------------------

# 27. Order Security

Customer order access must be scoped.

Authenticated customer:

``` text
auth.uid() = orders.user_id
```

Guest customer:

``` text
secure verification → server-side lookup → minimal order response
```

Do not expose:

-   Internal admin notes
-   Payment secrets
-   Webhook payloads
-   Internal operational metadata
-   Other customers' information

------------------------------------------------------------------------

# 28. Order / Payment Relationship

The intended flow is:

``` text
Checkout
   ↓
Create pending order
   ↓
Create Razorpay order
   ↓
Customer completes payment
   ↓
Razorpay webhook
   ↓
Verify webhook signature
   ↓
Idempotency check
   ↓
Mark payment captured
   ↓
Confirm order
   ↓
Atomically update inventory
   ↓
Create/send order confirmation email
```

Frontend success UI must not be the authoritative source of payment
confirmation.

------------------------------------------------------------------------

# 29. Shipment Relationship

``` text
orders
   │
   └── shipments
          │
          └── tracking_events
```

V1:

``` text
Admin marks DISPATCHED
        ↓
Admin enters carrier
        ↓
Admin enters AWB/tracking number
        ↓
Admin enters tracking URL
        ↓
Customer receives dispatch email
        ↓
Customer sees tracking information
```

------------------------------------------------------------------------

# 30. Status Separation

Do not create one giant status column containing everything.

Keep separate:

### Order status

``` text
placed
processing
dispatched
in_transit
out_for_delivery
delivered
exception
tracking_unavailable
```

### Payment status

``` text
created
authorized
captured
failed
cancelled
refunded
partially_refunded
```

### Shipment status

``` text
pending
dispatched
in_transit
out_for_delivery
delivered
exception
tracking_unavailable
```

This prevents impossible state combinations and makes future
integrations easier.

------------------------------------------------------------------------

# 31. Referential Integrity

Required foreign keys:

``` text
profiles.id → auth.users.id

admin_users.user_id → auth.users.id

addresses.user_id → auth.users.id

product_variants.product_id → products.id

product_images.product_id → products.id
product_images.variant_id → product_variants.id

product_collections.product_id → products.id
product_collections.collection_id → collections.id

cart_items.cart_id → carts.id
cart_items.product_variant_id → product_variants.id

orders.user_id → auth.users.id

order_items.order_id → orders.id
order_items.product_id → products.id
order_items.product_variant_id → product_variants.id

payments.order_id → orders.id

shipments.order_id → orders.id

tracking_events.shipment_id → shipments.id

order_events.order_id → orders.id
order_events.actor_user_id → auth.users.id

email_events.order_id → orders.id
```

Use appropriate `ON DELETE` behaviour deliberately.

Do not blindly cascade-delete historical order/payment data.

------------------------------------------------------------------------

# 32. Historical Data Protection

Products can change.

Orders cannot retroactively change because a product was edited.

Therefore order items must snapshot:

-   Product name
-   SKU
-   Variant
-   Unit price
-   Quantity
-   Line total
-   Relevant product information

Similarly, the order must snapshot the delivery address.

------------------------------------------------------------------------

# 33. Monetary Rules

Store:

``` text
£49.00 → 4900
£12.50 → 1250
```

Use integer minor units.

Never use floating-point values for financial amounts.

Store currency explicitly:

``` text
GBP
```

------------------------------------------------------------------------

# 34. Timestamps

All server records should use timezone-aware timestamps:

``` text
timestamptz
```

Use UTC in the database.

Render customer-facing dates in the appropriate user-facing context.

------------------------------------------------------------------------

# 35. Indexing

At minimum, index:

``` text
products.slug
products.status

product_variants.product_id
product_variants.sku
product_variants.status

product_images.product_id
product_images.variant_id

collections.slug
collections.status

addresses.user_id

orders.order_reference
orders.user_id
orders.customer_email
orders.status
orders.payment_status
orders.created_at

order_items.order_id

payments.order_id
payments.provider_order_id
payments.provider_payment_id

shipments.order_id
shipments.tracking_number

tracking_events.shipment_id
tracking_events.occurred_at

order_events.order_id
order_events.created_at

email_events.order_id
email_events.status
```

Indexes should be added based on actual query patterns and not
indiscriminately.

------------------------------------------------------------------------

# 36. Admin Requirements

The first admin release must support:

### Admin Login

``` text
/admin/login
```

Admin authentication must use Supabase Auth.

### Admin Dashboard

Minimum:

``` text
Orders
Products
Inventory
```

### Order Detail

Admin must be able to see:

-   Order reference
-   Date
-   Customer
-   Email
-   Delivery address
-   Items
-   Quantities
-   Prices
-   Payment status
-   Order status
-   Shipment status
-   Carrier
-   AWB/tracking number
-   Tracking URL
-   Order history

### Fulfilment controls

Admin must be able to:

-   Change order status
-   Create/update shipment
-   Enter/edit carrier
-   Enter/edit AWB
-   Enter/edit tracking URL
-   Add tracking events

------------------------------------------------------------------------

# 37. Customer Order Tracking

Authenticated customer:

``` text
Account → Orders → Order Detail
```

Guest customer:

``` text
Track Order
    ↓
Secure verification
    ↓
Order status
    ↓
Shipment/tracking
```

Customer must be able to see:

-   Order reference
-   Items
-   Order total
-   Delivery address (appropriately minimised)
-   Current status
-   Tracking number when available
-   Tracking link when available
-   Status history
-   Tracking-unavailable state where applicable

------------------------------------------------------------------------

# 38. Resend Email Trigger Rules

Transactional emails must be tied to state changes.

### Order confirmation

Trigger:

``` text
verified payment captured
```

### Dispatch confirmation

Trigger:

``` text
shipment marked dispatched + tracking information recorded
```

### Tracking update

Trigger:

``` text
meaningful shipment/tracking status change
```

### Delivery confirmation

Trigger:

``` text
shipment/order marked delivered
```

Emails should not be sent simply because a frontend page was viewed.

------------------------------------------------------------------------

# 39. Idempotency Requirements

Idempotency is required for:

-   Razorpay webhooks
-   Order confirmation emails
-   Dispatch emails
-   Tracking update emails
-   Inventory deduction
-   Order status transitions where repeated requests are possible

The same event processed twice must not produce two commercial side
effects.

------------------------------------------------------------------------

# 40. What Must NOT Be Stored

Never store:

-   Card numbers
-   CVV
-   Raw card authentication secrets
-   Razorpay secret key
-   Resend API key
-   Supabase service-role key
-   Passwords
-   Unnecessary sensitive payment information

Secrets belong in server-side environment configuration.

------------------------------------------------------------------------

# 41. Supabase Storage

Recommended logical buckets:

``` text
product-images
collection-images
editorial-images
```

Public read access may be appropriate for published catalogue imagery.

Write/upload permissions must be restricted to authorised admin/server
operations.

Do not allow anonymous users to upload product imagery.

------------------------------------------------------------------------

# 42. Migration Rules

Database implementation must use versioned migrations.

Example:

``` text
001_initial_schema.sql
002_rls_policies.sql
003_seed_catalogue.sql
004_payment_tables.sql
005_fulfilment_tables.sql
006_email_events.sql
```

Do not manually modify production tables through the Supabase dashboard
without creating a corresponding migration.

------------------------------------------------------------------------

# 43. Seed Data

Development seed data should include:

-   At least one product
-   Multiple variants
-   Multiple colours
-   Product images
-   One collection
-   Product/collection relationship
-   Test customer
-   Test admin
-   Test order
-   Test shipment
-   Test tracking events

Test data must be clearly distinguishable from production data.

------------------------------------------------------------------------

# 44. Database Acceptance Checklist

Before application integration begins, confirm:

### Schema

-   [ ] All tables created
-   [ ] Primary keys defined
-   [ ] Foreign keys defined
-   [ ] Unique constraints defined
-   [ ] Required fields defined
-   [ ] Status enums/constraints defined
-   [ ] Historical order snapshots defined
-   [ ] Monetary values use minor units

### Security

-   [ ] RLS enabled on every private table
-   [ ] Public catalogue policies verified
-   [ ] Customer ownership policies verified
-   [ ] Guest order access is server-controlled
-   [ ] Admin authorisation helper defined
-   [ ] Admin policies tested
-   [ ] Service-role usage restricted to server
-   [ ] No secrets exposed to client

### Payments

-   [ ] Razorpay provider fields defined
-   [ ] Payment/order relationship defined
-   [ ] Webhook event table defined
-   [ ] Webhook idempotency defined
-   [ ] Payment states separated from order states

### Fulfilment

-   [ ] Manual shipment table defined
-   [ ] AWB/tracking number supported
-   [ ] Tracking URL supported
-   [ ] Carrier name supported
-   [ ] Tracking events supported
-   [ ] Admin status updates supported

### Email

-   [ ] Resend email event table defined
-   [ ] Order confirmation event defined
-   [ ] Dispatch event defined
-   [ ] Tracking update event defined
-   [ ] Delivery event defined
-   [ ] Email idempotency strategy defined

### Admin

-   [ ] Admin login supported
-   [ ] Admin role/authorisation defined
-   [ ] Admin order access defined
-   [ ] Admin fulfilment controls defined

------------------------------------------------------------------------

# 45. Locked Production Principle

The database is the **source of truth**.

``` text
Frontend
   ↓
Server/API layer
   ↓
Supabase
   ↓
Database constraints + RLS
```

Not:

``` text
Frontend
   ↓
Trust whatever the browser sends
```

Payments, order ownership, inventory, admin privileges and fulfilment
state must all be validated server-side.

------------------------------------------------------------------------

# 46. Implementation Gate

**Do not start building the production database until this document has
been reviewed.**

After approval, implementation should proceed in this order:

``` text
1. Supabase project configuration
2. Initial schema migration
3. Constraints + indexes
4. RLS helper functions
5. RLS policies
6. Storage buckets/policies
7. Auth configuration
8. Admin bootstrap
9. Development seed data
10. Generated database types
11. Application integration
```

This document is the database/RLS contract for SHADESUK V1.
