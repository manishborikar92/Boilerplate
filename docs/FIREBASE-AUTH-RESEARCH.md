# Firebase Authentication — In-Depth Research Report
### Phone Number OTP & Google Login/Signup

> **Research Date:** March 2026  
> **Primary Sources:** Firebase Official Documentation, Google Cloud Identity Platform Pricing, MetaCTO (2026), Logto Blog (2025), SuperTokens Blog, Cando Consulting  
> **Exchange Rate Used:** 1 USD ≈ ₹84 INR

---

## Table of Contents

1. [Firebase Authentication Overview](#1-firebase-authentication-overview)
2. [Pricing Plans — Spark vs Blaze](#2-pricing-plans--spark-vs-blaze)
3. [Google Login / Google Sign-In Pricing](#3-google-login--google-sign-in-pricing)
4. [Phone Number (OTP) Authentication](#4-phone-number-otp-authentication)
5. [SMS Pricing by Region](#5-sms-pricing-by-region)
6. [India-Specific Pricing in INR](#6-india-specific-pricing-in-inr)
7. [Free Tier Details & What's Included](#7-free-tier-details--whats-included)
8. [Limits and Quotas](#8-limits-and-quotas)
9. [Cost Calculation Examples](#9-cost-calculation-examples)
10. [Phone OTP vs Google Login — Cost Comparison](#10-phone-otp-vs-google-login--cost-comparison)
11. [Key Takeaways & Recommendations for Startups](#11-key-takeaways--recommendations-for-startups)

---

## 1. Firebase Authentication Overview

Firebase Authentication is Google's managed identity service built on top of **Google Cloud Identity Platform**. It provides a complete authentication backend — handling user sign-up, sign-in, session management, and token verification — without requiring you to build or maintain your own auth server.

### What Firebase Auth Does

- Manages user accounts (create, update, delete, disable)
- Issues and verifies **Firebase ID tokens** (JWTs) on your behalf
- Integrates natively with other Firebase products (Firestore, Cloud Functions, Storage) via Security Rules
- Provides pre-built UI components (FirebaseUI) for rapid integration
- Handles credential verification on Google's secure global infrastructure

### Supported Authentication Methods

| Method | Type | Notes |
|---|---|---|
| Email & Password | Native | Classic username/password |
| Email Link (Passwordless) | Native | Magic link sent via email |
| Phone Number / OTP | Native | SMS-based one-time password |
| Google Sign-In | Social / OAuth 2.0 | Most popular social provider |
| Apple Sign-In | Social / OAuth 2.0 | Required for iOS apps |
| Facebook Login | Social / OAuth 2.0 | Requires Facebook App setup |
| GitHub | Social / OAuth 2.0 | Ideal for developer tools |
| Twitter / X | Social / OAuth 2.0 | |
| Microsoft | Social / OAuth 2.0 | |
| Yahoo | Social / OAuth 2.0 | |
| Play Games | Platform | Android gaming |
| Game Center | Platform | iOS gaming |
| Anonymous Auth | Native | Temporary guest accounts |
| SAML | Enterprise / SSO | Requires Identity Platform (paid) |
| OpenID Connect (OIDC) | Enterprise / SSO | Requires Identity Platform (paid) |
| Custom Auth | Custom | Bring-your-own auth system |

### Platform SDK Support

Firebase Authentication SDKs are officially available for:
- **iOS+** (Swift, Objective-C)
- **Android** (Java, Kotlin)
- **Flutter**
- **Web** (JavaScript/TypeScript)
- **C++**
- **Unity**
- **Admin SDK** (Node.js, Python, Java, Go, C#)

---

## 2. Pricing Plans — Spark vs Blaze

Firebase offers two pricing tiers:

### Spark Plan (Free / No-Cost)

- **Cost:** $0/month
- Designed for prototyping, MVPs, and small-scale projects
- Generous free quotas for most services
- **Phone Authentication is NOT available** on the Spark plan — you must upgrade to Blaze

### Blaze Plan (Pay-As-You-Go)

- **Cost:** Starts at $0 — you pay only for usage beyond free-tier quotas
- All Spark quotas are retained (free limits still apply)
- Unlocks Phone Authentication (SMS OTP)
- Unlocks additional Firebase features (Cloud Vision, certain ML APIs)
- Requires a Google Cloud billing account to be attached

### Plan Comparison Summary

| Feature | Spark (Free) | Blaze (Pay-as-you-go) |
|---|---|---|
| Email/Password Auth | ✅ Free up to 50k MAU | ✅ Free up to 50k MAU, then ~$0.0055/MAU |
| Google / Social Login | ✅ Free up to 50k MAU | ✅ Free up to 50k MAU, then tiered |
| Anonymous Auth | ✅ Free | ✅ Free |
| Phone Number / OTP | ❌ Not available | ✅ Available — charged per SMS |
| SAML / OIDC (SSO) | ❌ Not available | 💰 $0.015/MAU after first 50 users |
| Cloud Functions | ❌ Not available | ✅ Pay-as-you-go |
| Billing required | ❌ No | ✅ Yes (Google Cloud Billing) |

### Monthly Active User (MAU) Calculation

- A **Monthly Active User (MAU)** is any user who signs in at least once within a given 30-day billing period
- If a user logs in 50 times in a month, they are still **counted as 1 MAU**
- Inactive users (those who don't sign in) are **not counted** and stored at no cost
- Anonymous users count toward MAU only if automatic cleanup is not enabled

---

## 3. Google Login / Google Sign-In Pricing

### Is Google Login Free?

**Yes, Google Sign-In is completely free** within Firebase Authentication's generous free tier.

### Free Tier Limits for Google Login

| Tier | MAU Limit | Cost |
|---|---|---|
| Free Tier | 0 – 50,000 MAU | **$0.00** |
| Paid Tier 1 | 50,001 – 100,000 MAU | ~$0.0055/MAU |
| Paid Tier 2 | 100,001 – 1,000,000 MAU | ~$0.0045/MAU |
| Paid Tier 3 | 1,000,001+ MAU | ~$0.0025/MAU |

> **Note:** Tier pricing for social/email MAUs above 50k applies to the Google Cloud Identity Platform, which activates automatically when you exceed the free tier limit.

### Key Facts About Google Login

- **No per-login charge** — you are billed per MAU (monthly active user), not per login event
- A user who logs in via Google 20 times in a month = **1 MAU = $0 cost** (within free tier)
- No setup fee, no monthly subscription for standard Google Sign-In
- Requires a valid OAuth 2.0 Client ID from Google Cloud Console (free to create)
- Fully supported on Android, iOS, Web, and Flutter

### Beyond 50k MAU — Google Login Cost Example (USD & INR)

| MAU Count | Monthly Cost (USD) | Monthly Cost (INR) |
|---|---|---|
| Up to 50,000 | $0.00 | ₹0 |
| 100,000 | ~$275 | ~₹23,100 |
| 500,000 | ~$2,475 | ~₹2,07,900 |
| 1,000,000 | ~$4,975 | ~₹4,17,900 |

> These estimates assume all users are on email/social login (Google, Facebook, etc.) only, and are on the Blaze plan with Identity Platform active.

---

## 4. Phone Number (OTP) Authentication

### How OTP Authentication Works in Firebase

Firebase Phone Authentication is a **multi-step SMS-based verification** system:

1. **User enters phone number** in the app
2. **App calls Firebase Auth SDK** with the phone number
3. **Firebase sends an SMS** with a 6-digit OTP code via Google's SMS infrastructure
4. **User enters the OTP** in the app
5. **App passes OTP to Firebase SDK**, which verifies it against Firebase's backend
6. **Firebase returns a UID and ID token** — the user is authenticated

On Android, Firebase can auto-detect the OTP via **SMS retriever API**, allowing seamless verification without the user manually typing the code.

### What Firebase Charges For Phone OTP

Firebase charges **per SMS sent**, not per successful verification.

- If a user requests 3 OTPs (e.g., retries), **3 SMS are billed**
- Failed verifications are still billed if the SMS was delivered
- The charge applies whether it's a new signup or a returning login

### Important Requirement

- Phone Authentication is **only available on the Blaze plan**
- A billing account must be attached to your Firebase project before phone auth can be enabled
- The Spark (free) plan does not support Phone Number Authentication at all

---

## 5. SMS Pricing by Region

Firebase charges per SMS sent, with pricing varying significantly by country. The following are standard rates from Google Cloud Identity Platform pricing (as of early 2026):

### Key Regional Pricing (per SMS sent)

| Country / Region | Price per SMS (USD) | Price per SMS (INR approx.) |
|---|---|---|
| 🇮🇳 India | **$0.0075 – $0.01** | **₹0.63 – ₹0.84** |
| 🇺🇸 United States | $0.01 | ₹0.84 |
| 🇨🇦 Canada | $0.01 | ₹0.84 |
| 🇬🇧 United Kingdom | $0.04 | ₹3.36 |
| 🇧🇷 Brazil | $0.05 | ₹4.20 |
| 🇩🇪 Germany | $0.07 | ₹5.88 |
| 🇦🇺 Australia | $0.06 | ₹5.04 |
| 🇿🇦 South Africa | $0.06 | ₹5.04 |
| 🇯🇵 Japan | $0.07 | ₹5.88 |
| Most other countries | $0.06 | ₹5.04 |
| Premium carriers (any region) | Up to $0.34 | Up to ₹28.56 |

> **Note:** The first 10 SMS per day are free — but only for pre-registered **test phone numbers** in your Firebase console. Real production phone numbers are billed immediately.

### Daily Free SMS Allowance

Firebase provides a small daily free quota:

| Allowance | Details |
|---|---|
| 10 SMS/day | Free — applies to test phone numbers only |
| Production numbers | No free quota — billed from the first SMS |

---

## 6. India-Specific Pricing in INR

### India SMS Rate

For Indian phone numbers (+91), Firebase charges approximately **$0.01 per SMS** for standard carriers (Jio, Airtel, Vi/Vodafone-Idea, BSNL). Premium or less-supported carriers may incur higher costs.

**$0.01 × 84 (USD/INR rate) = ₹0.84 per SMS**

Some sources report a range of ₹0.80 – ₹1.00 per SMS for Indian carriers, with premium number ranges occasionally hitting ₹2.70+ per verification.

### OTP Login Cost Scenarios for India

The following assumes all users authenticate via phone OTP every month (worst case — 100% OTP rate):

#### Scenario A: 1,000 OTP Logins/Month

| Metric | Value |
|---|---|
| OTP SMS sent | 1,000 |
| Rate per SMS (India) | $0.01 |
| Monthly cost (USD) | **$10.00** |
| Monthly cost (INR) | **~₹840** |
| Annual cost (INR) | ~₹10,080 |

#### Scenario B: 10,000 OTP Logins/Month

| Metric | Value |
|---|---|
| OTP SMS sent | 10,000 |
| Rate per SMS (India) | $0.01 |
| Monthly cost (USD) | **$100.00** |
| Monthly cost (INR) | **~₹8,400** |
| Annual cost (INR) | ~₹1,00,800 |

#### Scenario C: 100,000 OTP Logins/Month

| Metric | Value |
|---|---|
| OTP SMS sent | 100,000 |
| Rate per SMS (India) | $0.01 |
| Monthly cost (USD) | **$1,000.00** |
| Monthly cost (INR) | **~₹84,000** |
| Annual cost (INR) | ~₹10,08,000 (~10 lakh) |

> **Realistic adjustment:** In practice, not every active user logs in every month via OTP. A typical login rate of 30–50% of MAUs per month significantly reduces actual SMS costs (see Section 9 for realistic scenarios).

### Failed/Retry OTP Impact in India

If users fail OTP entry and retry (common with copy-paste or slow SMS delivery):

| Retry Rate | Extra SMS per 10k Users | Extra Monthly Cost (INR) |
|---|---|---|
| 10% retry | +1,000 SMS | +₹840 |
| 20% retry | +2,000 SMS | +₹1,680 |
| 30% retry | +3,000 SMS | +₹2,520 |

---

## 7. Free Tier Details — What's Included

### Spark Plan — Complete Free Tier

| Feature | Free Limit |
|---|---|
| Email/Password Auth | Up to 50,000 MAU/month |
| Google Sign-In | Up to 50,000 MAU/month |
| Facebook, Apple, GitHub, Twitter, etc. | Up to 50,000 MAU/month |
| Anonymous Auth | Up to 50,000 MAU/month |
| Phone Number (OTP) Auth | ❌ Not available on Spark |
| SAML / OIDC (Enterprise SSO) | ❌ Not available on Spark |
| Stored (inactive) users | Unlimited — no charge |
| Firebase Realtime Database | 1 GB storage, 10 GB/month transfer |
| Firestore | 1 GB storage, 50k reads, 20k writes/day |
| Cloud Storage | 5 GB stored, 1 GB/day download |
| Cloud Functions | ❌ Not available on Spark |

### Blaze Plan — Free Tier (Retained)

Even on the Blaze plan, the same free limits apply before billing kicks in:

| Feature | Free Limit |
|---|---|
| Email/Password, Google, Social Auth | First 50,000 MAU/month — FREE |
| SAML / OIDC | First 50 MAU — free |
| Phone Auth (OTP) | First 10 SMS/day (test numbers only) |
| Firestore | Same daily free limits as Spark |
| Cloud Functions | 2M invocations/month free |

---

## 8. Limits and Quotas

### Rate Limits for Firebase Authentication

Firebase imposes per-project rate limits to prevent abuse:

| Operation | Limit |
|---|---|
| Sign-in / Sign-up requests | 1,000 per second per project |
| Phone verification (SMS sends) | Soft limit varies; Firebase flags unusual patterns |
| Email verification sends | 100 per hour per user |
| Password reset emails | 100 per hour per user |
| Token refresh operations | No hard limit (client-side managed) |
| Admin SDK user management | 10 requests/second per project |

### SMS Fraud Protection

Firebase has built-in protections against SMS pumping fraud (where bad actors trigger mass OTP requests to generate revenue from carrier routing):

- **reCAPTCHA verification** is built into the web SDK flow
- **App Attest** (iOS) and **Play Integrity** (Android) validate that OTP requests come from legitimate app installs
- **SMS Regions Policy:** You can restrict OTP sending to a whitelist of allowed countries, or block specific regions entirely
- **Blocking Functions:** Custom Cloud Functions can intercept and block suspicious sign-in attempts

### OTP Expiry

| Parameter | Value |
|---|---|
| OTP validity window | 5 minutes |
| OTP code length | 6 digits |
| Maximum retries (default) | 3 attempts before lockout |

---

## 9. Cost Calculation Examples

### Assumptions Used

- USD to INR: 1 USD = ₹84
- India SMS rate: $0.01/SMS
- Google/Email login: Free up to 50k MAU, then ~$0.005/MAU
- Login frequency: Not every user logs in every month (realistic: 40–60% monthly active rate)
- OTP retry rate factored in: ~15% extra SMS overhead

---

### Example 1: Startup with 10,000 Total Users

**Profile:** Early-stage app, India-focused, mix of phone OTP (60%) and Google login (40%)

| Item | Value |
|---|---|
| Total registered users | 10,000 |
| Monthly active users (MAU) | ~5,000 (50% active monthly) |
| Google login MAU | ~2,000 |
| Phone OTP MAU | ~3,000 |
| OTP SMS (with 15% retries) | ~3,450 |
| Google login cost | $0 (well within 50k free tier) |
| OTP SMS cost @ $0.01 | $34.50 / ₹2,898 |
| **Total monthly auth cost** | **~$35 / ~₹2,900** |

> **Verdict:** Extremely affordable. A startup at 10k users spends less than ₹3,000/month on auth.

---

### Example 2: Medium App with 100,000 Total Users

**Profile:** Growing consumer app, India + some international users, 70% phone OTP, 30% Google

| Item | Value |
|---|---|
| Total registered users | 100,000 |
| Monthly active users (MAU) | ~60,000 (60% active) |
| Google login MAU | ~18,000 |
| Phone OTP MAU | ~42,000 |
| OTP SMS (with 15% retries) | ~48,300 |
| Google login cost | $0 (within 50k free) |
| OTP SMS cost @ $0.01 | $483 / ₹40,572 |
| **Total monthly auth cost** | **~$483 / ~₹40,500** |

> **Note:** If international OTP users are significant (e.g., UK/Europe at $0.04–$0.06/SMS), costs would be 4–6× higher for those segments.

---

### Example 3: Large App with 1,000,000 Total Users

**Profile:** Scale-up, mixed India + global, 50% phone OTP, 50% Google

| Item | Value |
|---|---|
| Total registered users | 1,000,000 |
| Monthly active users (MAU) | ~600,000 |
| Google login MAU | ~300,000 |
| Phone OTP MAU | ~300,000 |
| OTP SMS (with 15% retries) | ~345,000 |
| Google login cost (300k MAU) | First 50k free + 250k × $0.003 avg | 
| Google login cost | ~$750 / ₹63,000 |
| OTP SMS cost @ $0.01 (India avg) | $3,450 / ₹2,89,800 |
| **Total monthly auth cost** | **~$4,200 / ~₹3,52,800** |

> At 1M+ users, phone OTP dominates costs. Implementing **silent OTP (Android Auto-verify)** and **OTP caching** strategies can cut SMS volume significantly.

---

### Summary Table — All Three Scales

| App Scale | Total Users | Monthly Auth Cost (USD) | Monthly Auth Cost (INR) |
|---|---|---|---|
| Startup | 10,000 | ~$35 | ~₹2,900 |
| Medium | 100,000 | ~$483 | ~₹40,500 |
| Large | 1,000,000 | ~$4,200 | ~₹3,52,800 |

---

## 10. Phone OTP vs Google Login — Cost Comparison

### Side-by-Side Comparison

| Factor | Phone OTP | Google Login |
|---|---|---|
| **Cost model** | Per SMS sent | Per MAU (after 50k free) |
| **Free quota** | 10 SMS/day (test only) | 50,000 MAU/month |
| **Cost per login (India)** | ~$0.01 / ₹0.84 | $0 (within free tier) |
| **Cost per 10k logins** | ~$100 / ₹8,400 | $0 (if under 50k MAU) |
| **Cost per 100k logins** | ~$1,000 / ₹84,000 | ~$550 / ₹46,200 (at 100k MAU) |
| **Blaze plan required** | ✅ Yes | ✅ Yes (for >50k MAU billing) |
| **UX friction** | Medium (wait for SMS) | Low (1-tap sign-in) |
| **Reliable delivery** | Depends on carrier | Very reliable (OAuth) |
| **User privacy** | Phone number required | Google account required |
| **Fraud risk** | SMS pumping risk | Lower fraud risk |
| **Works without internet** | ❌ No | ❌ No |
| **Works without Google account** | ✅ Yes | ❌ No |

### Cost Winner at Each Scale

| Scale | Cheaper Option | Reason |
|---|---|---|
| < 50,000 MAU | **Google Login** | Completely free; OTP costs ~$0.01/SMS |
| 50,000–500,000 MAU | **Google Login** | MAU cost (~$0.005) < OTP cost ($0.01/SMS) |
| > 500,000 MAU | **Depends on usage** | OTP only billed on login; Google billed monthly |
| High login frequency | **Google Login** | OTP billed every login; Google MAU-based |
| Low login frequency | **Phone OTP** | OTP billed only when used; Google billed even for infrequent users |

### Recommendation

For **most Indian consumer apps**, a **hybrid approach** is optimal:
- Offer **Google Sign-In as primary** (free, fast, zero SMS cost)
- Offer **Phone OTP as secondary / fallback** (for users without Google accounts)
- Avoid **SMS OTP as the only authentication method** to control costs at scale

---

## 11. Key Takeaways & Recommendations for Startups

### Summary of Key Facts

| Fact | Detail |
|---|---|
| Google login is free | Up to 50,000 MAU/month — no charge at all |
| Phone OTP costs money | $0.01/SMS in India (~₹0.84) — from your first SMS |
| Spark plan blocks phone auth | You must upgrade to Blaze to use phone OTP |
| No free production SMS quota | The 10 SMS/day free quota is for test numbers only |
| SMS is billed on send, not success | Failed/retried OTPs are still billed |
| MAU ≠ login count | Google login billed monthly per user, not per login event |
| SAML/OIDC is expensive | $0.015/MAU — avoid unless enterprise SSO is needed |

### Practical Recommendations for Indian Startups

1. **Default to Google Sign-In** where possible — it's free, reliable, and low-friction. This is the single best cost-saving decision for auth.

2. **Add Phone OTP as a secondary option**, not the primary. In India, many users prefer phone login, but it comes at a direct monetary cost per verification.

3. **Enable SMS Regions restriction** in Firebase Console — block countries you don't serve to prevent fraudulent OTP requests from expensive international numbers.

4. **Use Firebase App Check** (with Play Integrity on Android and App Attest on iOS) to prevent SMS pumping attacks that can dramatically inflate your SMS bill.

5. **Monitor SMS usage** via Firebase Console's built-in metrics — set budget alerts in Google Cloud Billing to avoid bill shock.

6. **Use test phone numbers** during development to consume zero real SMS credits during QA/testing.

7. **Plan for scale:** If your app is expected to reach 100k+ users who primarily authenticate via phone OTP, budget approximately ₹40,000–₹85,000/month in SMS costs (India rates).

8. **Cache authentication tokens** properly — Firebase ID tokens are valid for 1 hour. Proper token refresh implementation prevents unnecessary re-authentications and re-OTPs.

---

## Appendix — Quick Reference Card

### Firebase Auth Pricing Cheat Sheet (India Focus)

```
GOOGLE LOGIN
  ├─ 0 – 50,000 MAU    → FREE ($0)
  ├─ 50k – 100k MAU    → ~$0.0055/MAU (~₹0.46/user)
  └─ 1M+ MAU           → ~$0.0025/MAU (~₹0.21/user)

PHONE OTP (India)
  ├─ Per SMS sent       → $0.01 (~₹0.84)
  ├─ Free quota         → 10 SMS/day (test numbers only)
  └─ 100k SMS/month     → $1,000 (~₹84,000)

SAML / OIDC (Enterprise SSO)
  ├─ First 50 users     → FREE
  └─ Beyond 50          → $0.015/MAU (~₹1.26/user/month)
```

### Monthly Budget Estimate (India, Phone OTP + Google Login Mix)

| Active Users | 70% Phone OTP | 30% Google | Total Monthly Cost |
|---|---|---|---|
| 5,000 | 3,500 SMS = ₹2,940 | Free | **~₹3,000** |
| 20,000 | 14,000 SMS = ₹11,760 | Free | **~₹12,000** |
| 50,000 | 35,000 SMS = ₹29,400 | Free | **~₹29,500** |
| 100,000 | 70,000 SMS = ₹58,800 | ~₹4,200 (50k MAU paid) | **~₹63,000** |
| 500,000 | 350,000 SMS = ₹2,94,000 | ~₹84,000 | **~₹3,78,000** |

---

*All prices are estimates based on publicly available Firebase and Google Cloud documentation as of March 2026. Actual costs may vary based on carrier, region, retry rates, and Google's periodic pricing updates. Always verify current pricing at [firebase.google.com/pricing](https://firebase.google.com/pricing) and [cloud.google.com/identity-platform/pricing](https://cloud.google.com/identity-platform/pricing).*
