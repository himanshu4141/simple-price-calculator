
---




# Stripe Billing + Elements: Subscription Flow with Tax & Coupons

This document illustrates two recommended subscription payment flows using Stripe Billing and Stripe Elements, including tax estimation and coupon handling, as recommended in the [Stripe documentation](https://docs.stripe.com/billing/subscriptions/build-subscriptions?platform=web&ui=elements).

---
---

## Note on Incomplete Subscription Cleanup

When using `payment_behavior=default_incomplete`, subscriptions that are never confirmed (i.e., the user abandons checkout or payment fails) will remain in an incomplete state. It is your responsibility to periodically clean up these abandoned subscriptions to avoid clutter and potential billing confusion.

Stripe recommends:
- Monitoring for subscriptions that remain incomplete for too long (e.g., several hours or days)
- Canceling or deleting them as appropriate, either via scheduled jobs or webhook handling

For more details, see:
- [Stripe: Incomplete Subscriptions](https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses)
- [Stripe: Cleaning Up Incomplete Subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions?platform=web&ui=elements#handling-incomplete-subscriptions)

---

## Additional Note: Payment Method Flexibility

When the backend creates the subscription (with `payment_behavior=default_incomplete`), the initial PaymentIntent is generated in a `requires_payment_method` state. The user can then provide any valid payment method supported by your Stripe account at the point of confirmation using Stripe Elements. This allows for maximum flexibility, as the payment method is not fixed until the user completes checkout.

## 1. Standard Flow: Subscription Created First (Recommended)

**High-Level Flow Overview:**

- User selects a plan, enters payment details, and (optionally) a coupon code.
- Frontend requests a subscription preview from the backend, which calls Stripe to estimate the total price (including tax and discounts).
- User is shown the final price breakdown before confirming payment.
- On confirmation, the backend creates the subscription in `default_incomplete` state, and returns the PaymentIntent client secret.
- Frontend uses Stripe Elements to collect and confirm payment, including 3DS if required.
- Stripe webhooks notify the backend when payment is complete, and access is provisioned.

**Sequence Diagram (Standard Flow):**

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Stripe API

    U->>F: Select plan, enter payment details, enter coupon
    F->>B: POST /preview-subscription (plan, coupon, customer info)
    B->>S: Create/Fetch Customer (if needed)
    B->>S: Call Stripe API to preview subscription (tax, coupon)
    S->>B: Return estimated total (incl. tax, discounts)
    B->>F: Show price breakdown to user

    U->>F: Confirm purchase
    F->>B: POST /create-subscription (plan, coupon, customer info)
    B->>S: Create Subscription (payment_behavior=default_incomplete, coupon, tax)
    S->>B: Return Subscription + PaymentIntent client_secret
    B->>F: Return client_secret
    F->>S: stripe.confirmPayment() (via Elements)
    alt 3DS Required
        S->>U: 3DS authentication
        U->>S: Complete 3DS
    end
    S->>F: Payment confirmed
    S->>B: Webhook: invoice.paid / subscription.created
    B->>B: Grant user access
```

---

## 2. Alternative Flow: Take Payment Before Creating Subscription

In some cases, you may want to collect and confirm the user's payment method before creating the subscription. This can help ensure the payment method is valid and avoid incomplete subscriptions. The typical steps are:

1. Collect and confirm the payment method using a SetupIntent or PaymentIntent.
2. Attach the confirmed payment method to the customer.
3. Create the subscription with the saved payment method.

This approach is useful if you want to guarantee a valid payment method before provisioning a subscription, or to avoid abandoned/incomplete subscriptions.

**Sequence Diagram (Alternative Flow):**

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Stripe API

    U->>F: Enter payment details
    F->>B: POST /create-setup-intent (customer info)
    B->>S: Create SetupIntent
    S->>B: Return SetupIntent client_secret
    B->>F: Return client_secret
    F->>S: stripe.confirmSetup() (via Elements)
    S->>F: Payment method confirmed
    F->>B: POST /create-subscription (plan, coupon, payment method)
    B->>S: Create Subscription (with payment method)
    S->>B: Return Subscription
    B->>F: Return subscription details
```

For more details, see: [Stripe: Collect payment method before creating a subscription](https://docs.stripe.com/billing/subscriptions/build-subscriptions?platform=web&ui=elements#collect-payment-method-before-creating-subscription)

---

---

## 1. Standard Flow: Subscription Created First (Recommended)

**High-Level Flow Overview:**

- User selects a plan, enters payment details, and (optionally) a coupon code.
- Frontend requests a subscription preview from the backend, which calls Stripe to estimate the total price (including tax and discounts).
- User is shown the final price breakdown before confirming payment.
- On confirmation, the backend creates the subscription in `default_incomplete` state, and returns the PaymentIntent client secret.
- Frontend uses Stripe Elements to collect and confirm payment, including 3DS if required.
- Stripe webhooks notify the backend when payment is complete, and access is provisioned.

**Sequence Diagram (Standard Flow):**

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Stripe API

    U->>F: Select plan, enter payment details, enter coupon
    F->>B: POST /preview-subscription (plan, coupon, customer info)
    B->>S: Create/Fetch Customer (if needed)
    B->>S: Call Stripe API to preview subscription (tax, coupon)
    S->>B: Return estimated total (incl. tax, discounts)
    B->>F: Show price breakdown to user

    U->>F: Confirm purchase
    F->>B: POST /create-subscription (plan, coupon, customer info)
    B->>S: Create Subscription (payment_behavior=default_incomplete, coupon, tax)
    S->>B: Return Subscription + PaymentIntent client_secret
    B->>F: Return client_secret
    F->>S: stripe.confirmPayment() (via Elements)
    alt 3DS Required
        S->>U: 3DS authentication
        U->>S: Complete 3DS
    end
    S->>F: Payment confirmed
    S->>B: Webhook: invoice.paid / subscription.created
    B->>B: Grant user access
```

---

## 2. Alternative Flow: Take Payment Before Creating Subscription

In some cases, you may want to collect and confirm the user's payment method before creating the subscription. This can help ensure the payment method is valid and avoid incomplete subscriptions. The typical steps are:

1. Collect and confirm the payment method using a SetupIntent or PaymentIntent.
2. Attach the confirmed payment method to the customer.
3. Create the subscription with the saved payment method.

This approach is useful if you want to guarantee a valid payment method before provisioning a subscription, or to avoid abandoned/incomplete subscriptions.

**Sequence Diagram (Alternative Flow):**

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Stripe API

    U->>F: Enter payment details
    F->>B: POST /create-setup-intent (customer info)
    B->>S: Create SetupIntent
    S->>B: Return SetupIntent client_secret
    B->>F: Return client_secret
    F->>S: stripe.confirmSetup() (via Elements)
    S->>F: Payment method confirmed
    F->>B: POST /create-subscription (plan, coupon, payment method)
    B->>S: Create Subscription (with payment method)
    S->>B: Return Subscription
    B->>F: Return subscription details
```

For more details, see: [Stripe: Collect payment method before creating a subscription](https://docs.stripe.com/billing/subscriptions/build-subscriptions?platform=web&ui=elements#collect-payment-method-before-creating-subscription)

---

## Key Points

- Tax and coupon discounts are estimated before payment, ensuring transparency for the customer.
- Stripe Elements is used for secure, PCI-compliant payment collection and 3DS authentication.
- The backend is responsible for all Stripe API calls and webhook handling.
- Both flows are supported by Stripe, but the standard flow is recommended for most SaaS and subscription products.
