# Simplified Chargebee-Backed Subscription Payment Flows (No 3DS)

This document presents simplified sequence diagrams for subscription payment flows using a Chargebee-backed architecture, omitting 3DS authentication complexity but retaining frontend PaymentIntent confirmation. For the full, canonical flow (including 3DS), see:

[Order Submission Flow with Stripe 3DS Integration](PAYMENT_FLOW_SEQUENCE_DIAGRAM.md#order-submission-flow-with-stripe-3ds-integration)

---

## 1. Standard Flow: Estimate, PaymentIntent, Then Subscription Creation (Recommended)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (Angular)
    participant B as Backend (Node.js)
    participant S as Stripe API
    participant C as Chargebee API

    U->>F: Enter payment details, (optional) coupon
    F->>B: POST /api/payment/create-payment-intent
    B->>C: POST /estimates/create_subscription_for_items (billing address, items)
    C->>B: Return estimated total with taxes
    B->>S: Create PaymentIntent (unconfirmed)
    B->>F: Return {clientSecret, paymentIntentId}
    F->>S: stripe.confirmPayment(clientSecret)
    S->>F: Payment confirmed
    F->>B: POST /api/payment/complete-subscription
    B->>S: Retrieve PaymentIntent (verify success)
    B->>C: Create customer with billing address
    B->>C: Create subscription for new customer
    B->>F: Return {success, subscriptionId, customerId}
    F->>U: Show success page
```

---


## 2. Alternative Flow: Take Payment Method First, Then Create Subscription *(Untested)*

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (Angular)
    participant B as Backend (Node.js)
    participant S as Stripe API
    participant C as Chargebee API

    U->>F: Enter payment details
    F->>B: POST /api/payment/create-setup-intent
    B->>S: Create SetupIntent
    B->>F: Return client_secret
    F->>S: stripe.confirmSetup(client_secret)
    S->>F: Payment method confirmed
    F->>B: POST /api/payment/create-subscription (plan, coupon, payment method)
    B->>C: Create customer with billing address
    B->>C: Create subscription for new customer (with payment method)
    B->>F: Return {success, subscriptionId, customerId}
    F->>U: Show success page
```

---

These diagrams show the core payment and subscription creation steps for a Chargebee-backed system, with PaymentIntent confirmation handled on the frontend. For full details and 3DS handling, see the canonical diagram in PAYMENT_FLOW_SEQUENCE_DIAGRAM.md.
