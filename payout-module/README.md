# Payout Module

Reusable payout adapter module.

What it keeps from the source servers:

- Cashfree beneficiary, transfer, bank verification, and webhook ideas from `server-3`.
- Clean adapter boundary so projects can swap providers without changing controllers.

It contains no booking, earning, wallet, or settlement business logic.
