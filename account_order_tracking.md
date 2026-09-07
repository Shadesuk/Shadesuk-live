# SHADESUK — Account + Order Tracking Frontend Specification

**Status:** LOCKED  
**Section:** 7 of the ShadesUK Frontend System  
**Direction:** Quiet luxury / utility-first / low friction

## 1. Core Principle
> **An account is a convenience, not a requirement to buy.**

Customers must be able to purchase as guests. Accounts exist for repeat shopping, order history and saved information.

## 2. Account Architecture
```text
ACCOUNT
├── Overview
├── Orders
│   └── Order Detail
│       └── Track Order
├── Personal Details
├── Saved Addresses
└── Sign Out
```

Logged-out users can access Sign In, Create Account, Forgot Password, Continue with Google and Track Order.

## 3. Sign In
```text
ACCOUNT
SIGN IN
Email
[________________]
Password
[________________]
[ SIGN IN ]
Forgot password?
OR
[ CONTINUE WITH GOOGLE ]
Don't have an account?
CREATE ACCOUNT
```
Use clean validation, password visibility, keyboard accessibility and mobile-friendly inputs.

## 4. Google Sign-In
Provide **CONTINUE WITH GOOGLE** as an optional account convenience. It must never be required for purchasing.

## 5. Create Account
Minimal fields:
- First name
- Last name
- Email
- Password

Also provide Google sign-in. Do not ask for delivery information during registration unless later required.

## 6. Forgot Password
Use email-based password reset. Do not reveal whether an email address is registered.

## 7. Account Overview
```text
ACCOUNT
Hello, [First Name]

ORDERS
View your recent orders →

PERSONAL DETAILS
Manage your details →

SAVED ADDRESSES
Manage your addresses →
```
No unnecessary statistics, loyalty graphics or spending dashboards.

## 8. Orders
Each order card shows:
- Order reference
- Date
- Product thumbnail
- Product name
- Colour
- Size/fit
- Quantity where useful
- Total
- Current status
- View order action

## 9. Order Detail
```text
ORDER #SHU10294
ORDER CONFIRMED
06 SEP 2026

MODEL X
Black · Medium
Qty 1
£49

DELIVERY
Minimum 2 weeks

SHIPPING ADDRESS
[Customer address]

PAYMENT
•••• 4242

TOTAL
£49

[ TRACK ORDER ]
```

## 10. Order Status System
Frontend must support:
- **ORDER PLACED** — order received
- **PROCESSING** — being prepared
- **DISPATCHED** — left fulfilment
- **IN TRANSIT** — travelling
- **OUT FOR DELIVERY** — carrier attempting delivery
- **DELIVERED** — delivered
- **EXCEPTION** — delay/address/carrier issue
- **TRACKING NOT AVAILABLE** — shipment exists but tracking has not been supplied yet

Use one reusable status component everywhere.

## 11. Guest Order Tracking
Guests must track orders without creating accounts.

```text
TRACK YOUR ORDER
Order reference
[________________]
Email
[________________]
[ TRACK ORDER ]
```
Final secure verification will be determined during backend implementation. Never expose order information based only on a guessable order number.

## 12. Tracking Page
```text
TRACK ORDER
ORDER #SHU10294

MODEL X
Black · Medium

ORDER PLACED
06 SEP
|
PROCESSING
07 SEP
|
DISPATCHED
09 SEP
|
IN TRANSIT
CURRENT
|
OUT FOR DELIVERY
|
DELIVERED

DELIVERY ADDRESS
[Address]

EXPECTED DELIVERY
Minimum 2 weeks

[ CARRIER TRACKING ]
```

## 13. Tracking Timeline
Use a vertical timeline because it works best on mobile and supports detailed status/exception messages.

## 14. Carrier Tracking
When a valid carrier reference exists, provide **TRACK WITH CARRIER →**. The ShadesUK page must still show the basic verified status. Keep the carrier implementation abstract.

## 15. Tracking Unavailable
Show:
**TRACKING NOT AVAILABLE YET**

> Your order has been received. Tracking information will appear once your shipment has been dispatched.

Treat this as a normal state, not an error.

## 16. Delayed Order
Show:
**DELIVERY UPDATE**

> Your order is taking longer than expected.

Display only verified latest information. Never invent a delivery date.

## 17. Personal Details
Fields:
- First name
- Last name
- Email

Provide **SAVE CHANGES**. Email changes may require verification depending on backend rules.

## 18. Saved Addresses
Customers can save multiple addresses with simple labels such as Home, Work and Other.

Example:
```text
SAVED ADDRESSES
HOME
221B Baker Street
London
NW1 XXX
[ EDIT ] [ REMOVE ]
[ + ADD NEW ADDRESS ]
```

## 19. Add/Edit Address
Use the **same reusable address autocomplete component as checkout**. Provide manual entry fallback.

## 20. Address Autocomplete
Shared behaviour:
1. Start typing.
2. Show suggestions.
3. Select suggestion.
4. Populate relevant fields.
5. Allow editing.
6. Allow manual entry if lookup fails.

Support browser/device autofill through proper HTML autocomplete attributes. Keep the provider abstracted.

## 21. Checkout Relationship
Logged-in users can select saved addresses or add a new one. Guests use autocomplete/manual entry. Both use the same underlying address components.

## 22. Post-Purchase Account Creation
After a guest purchase, optionally offer:
```text
Want easier access to your orders?
[ CREATE ACCOUNT ]
```
Never interrupt successful checkout with mandatory registration.

## 23. Mobile Account
```text
ACCOUNT
Hello, [First Name]

ORDERS →
PERSONAL DETAILS →
SAVED ADDRESSES →
SIGN OUT
```
Orders stack vertically; tracking remains a vertical timeline.

## 24. Empty States
No orders:
```text
NO ORDERS YET
Your orders will appear here.
[ SHOP SHADES ]
```

No addresses:
```text
NO SAVED ADDRESSES
Save an address for faster checkout.
[ ADD ADDRESS ]
```

## 25. Authentication/Security States
Support:
- Incorrect credentials
- Password reset request/completion
- Session expiry
- Sign out
- Account creation failure
- Google authentication failure
- Email verification where required
- Network failure

Errors must be specific and human-readable without exposing sensitive information.

## 26. Account Navigation
Desktop may use restrained secondary navigation:
**ACCOUNT | Overview | Orders | Personal Details | Addresses**

Mobile uses stacked navigation. Do not unnecessarily duplicate storefront navigation.

## 27. Guest vs Account
### Guest can:
- Browse
- Add to Bag
- Checkout
- Pay
- Receive confirmation
- Track order

### Account additionally provides:
- Order history
- Individual order access
- Saved addresses
- Personal details
- Google sign-in
- Easier repeat shopping

Account creation is never a prerequisite.

## 28. Anti-AI-Slop Rules
Do not use:
- Gamified dashboards
- Fake loyalty levels
- Fake spending statistics
- Giant profile cards
- Decorative illustrations
- Random recommendations
- Oversized welcome banners
- Excessive rounded cards
- Unnecessary animations
- Fake membership benefits

## 29. Reusable Components
Authentication:
- SignInForm
- CreateAccountForm
- ForgotPasswordForm
- GoogleAuthButton

Account:
- AccountNavigation
- OrderCard
- OrderDetail
- OrderStatus
- TrackingTimeline
- SavedAddressCard
- PersonalDetailsForm

Address:
- AddressAutocomplete
- AddressForm
- AddressSuggestionList

Global:
- Button
- Input
- Modal
- Drawer
- Toast
- LoadingState
- EmptyState
- ErrorState

## 30. Data Requirements
Customer:
- Customer ID
- Name
- Email
- Authentication state

Address:
- Address ID
- Label
- Address lines
- City/town
- County where applicable
- Postcode
- Country
- Default status

Order:
- Order ID/reference
- Order date
- Products
- Variants
- Quantities
- Prices
- Subtotal
- Shipping
- Total
- Payment status
- Order status
- Shipping status
- Tracking reference
- Carrier information where available
- Delivery address
- Customer email

Never hard-code customer or order data.

## 31. Cross-System Component Rule
**AddressAutocomplete** → Checkout + Account + Saved Addresses

**OrderCard** → Account + Order History

**OrderDetail** → Account + Guest Tracking + Confirmation

**OrderStatus** → Order Detail + Guest Tracking + Confirmation

This shared-component architecture is locked.

## 32. Success Criteria
A customer can:
1. Purchase without an account.
2. Create an account independently.
3. Sign in with email/password.
4. Sign in with Google.
5. Reset a password.
6. View order history.
7. Open order details.
8. Track from their account.
9. Track a guest order securely.
10. Understand all major order statuses.
11. See tracking when available.
12. Understand when tracking is unavailable.
13. Understand delays without fabricated dates.
14. Save multiple addresses.
15. Use address autocomplete in account and checkout.
16. Manually enter an address when needed.
17. Edit personal details.
18. Sign out cleanly.

## 33. Locked Principle
> **Buying never requires an account. An account simply makes buying again easier.**
