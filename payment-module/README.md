# Payment Module

Reusable payment adapter module.

What it keeps from the source servers:

- Razorpay signature verification and order/refund ideas from `server-2`.
- Provider adapter contract and PhonePe request/webhook normalization from `server-3`.

It is intentionally decoupled from Express, MongoDB, bookings, subscriptions, or any project-specific payment rules.
