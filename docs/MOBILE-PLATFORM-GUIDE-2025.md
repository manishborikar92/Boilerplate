# 📱 Mobile App Development Platform Guide — 2025+

> **Author:** Senior Software Architect & Technology Research Analyst
> **Last Updated:** March 2025
> **Version:** 1.0.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Comparison Matrix](#2-platform-comparison-matrix)
3. [Deep-Dive Analysis by Platform](#3-deep-dive-analysis-by-platform)
   - [Flutter](#31-flutter)
   - [React Native](#32-react-native)
   - [Swift — Native iOS](#33-swift--native-ios)
   - [Kotlin — Native Android](#34-kotlin--native-android)
   - [Kotlin Multiplatform (KMP)](#35-kotlin-multiplatform-kmp)
   - [.NET MAUI](#36-net-maui)
   - [Ionic / PWA / Hybrid](#37-ionic--pwa--hybrid)
4. [Pros & Cons Summary](#4-pros--cons-summary)
5. [Decision Framework](#5-decision-framework)
6. [Medal Recommendations](#6-medal-recommendations)
7. [🏆 Final Verdict](#7--final-verdict)
8. [Recommended Tech Stack](#8-recommended-tech-stack)
9. [Emerging Technologies to Watch](#9-emerging-technologies-to-watch)
10. [Flutter Beginner Guide — Complete Setup to First App](#10-flutter-beginner-guide--complete-setup-to-first-app)
    - [What is Flutter?](#101-what-is-flutter)
    - [System Requirements](#102-system-requirements)
    - [Installation — Windows](#103-installation--windows)
    - [Installation — macOS](#104-installation--macos)
    - [Installation — Linux](#105-installation--linux)
    - [IDE Setup](#106-ide-setup)
    - [Verify Installation with flutter doctor](#107-verify-installation-with-flutter-doctor)
    - [Creating Your First Project](#108-creating-your-first-project)
    - [Understanding Project Structure](#109-understanding-project-structure)
    - [Dart Language Essentials](#1010-dart-language-essentials)
    - [Flutter Core Concepts](#1011-flutter-core-concepts)
    - [Building Your First Real App](#1012-building-your-first-real-app)
    - [Running & Debugging](#1013-running--debugging)
    - [State Management Basics](#1014-state-management-basics)
    - [Navigation Basics](#1015-navigation-basics)
    - [Working with APIs](#1016-working-with-apis)
    - [Best Practices for Beginners](#1017-best-practices-for-beginners)
    - [Learning Roadmap](#1018-learning-roadmap)
    - [Useful Resources](#1019-useful-resources)

---

## 1. Executive Summary

Choosing the right mobile development platform in 2025 is a decision that affects team velocity, product quality, hiring costs, and long-term maintainability. This guide cuts through the noise with opinionated, data-backed recommendations.

**The short version:**
- **Most teams → Flutter.** Single codebase, best-in-class UI quality, excellent performance.
- **React/JS teams → React Native + Expo.** Fastest ramp-up for web developers.
- **Performance-critical / hardware-intensive → Native Swift + Kotlin.**
- **Enterprise with .NET → .NET MAUI.**
- **Large org with existing native apps → Kotlin Multiplatform (KMP).**

---

## 2. Platform Comparison Matrix

| Platform | Language | Performance | Dev UX | UI/UX | Ecosystem | Scalability | Hiring | Longevity | Best For |
|----------|----------|-------------|--------|-------|-----------|-------------|--------|-----------|----------|
| **Flutter** | Dart | ⭐⭐⭐⭐½ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐½ | ⭐⭐⭐⭐½ | ⭐⭐⭐⭐½ | ⭐⭐⭐⭐½ | **Consumer, startup, multi-platform** |
| **React Native** | TypeScript | ⭐⭐⭐½ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **Web-first teams, MVPs** |
| **Swift (Native iOS)** | Swift | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **AR, HealthKit, premium iOS** |
| **Kotlin (Native Android)** | Kotlin | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **Hardware-intensive Android** |
| **KMP** | Kotlin | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **Large teams, logic sharing** |
| **.NET MAUI** | C# | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **Microsoft/enterprise shops** |
| **Ionic / PWA** | TypeScript | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **Internal tools, B2B CRUD** |

---

## 3. Deep-Dive Analysis by Platform

### 3.1 Flutter

**Language:** Dart | **Backed by:** Google

Flutter renders every pixel itself using its own Impeller/Skia engine — it does not use native widgets at all. This is both its superpower and its most debated characteristic.

**Performance:** Near-native. 60/120fps with the Impeller engine (replacing Skia from Flutter 3.x). No JavaScript bridge means zero bridge-crossing overhead. Memory footprint is slightly higher than pure native but negligible in most production apps.

**Developer Experience:** Hot reload gives sub-second UI feedback loops. Dart takes 3–5 days to become productive in for any developer with prior OOP experience. The widget tree model is opinionated but consistent. Tooling (`flutter doctor`, `flutter pub`) is polished and reliable.

**UI/UX:** This is Flutter's crown jewel. Pixel-perfect consistency across iOS, Android, Web, and Desktop from a single codebase. Custom design systems are a first-class use case.

**Real-World Adoption:**
- Google Pay
- eBay Motors
- BMW connected car app
- Alibaba Xianyu (50M+ users)
- ByteDance apps
- Nubank (50M+ users, Brazil)
- Grab

**When NOT to use Flutter:**
- Deep platform-specific integrations (ARKit/ARCore, CarPlay, HealthKit at low levels) require platform channels which adds friction.
- If your team is 100% JavaScript specialists with zero appetite to learn Dart.
- Apps requiring direct hardware access (Bluetooth LE edge cases, ultra-low-latency audio).

---

### 3.2 React Native

**Language:** TypeScript | **Backed by:** Meta

React Native maps JavaScript components to actual native widgets. Since the New Architecture (Fabric + JSI, stable in 2024), the old JavaScript bridge has been eliminated, significantly boosting performance.

**Performance:** With New Architecture enabled, very solid for 95%+ of apps. Occasional frame drops in complex animations. JavaScript GC pauses can cause jank in extreme scenarios.

**Developer Experience:** Largest talent pool of any cross-platform framework. Any React developer can be productive within a week. Expo has dramatically lowered the barrier to entry for new projects in 2025.

**UI/UX:** Uses real native widgets, so platform-specific behavior is automatically correct. Less pixel-perfect cross-platform consistency compared to Flutter. Complex custom animations require `react-native-reanimated`.

**Real-World Adoption:**
- Meta (Facebook, Instagram)
- Microsoft (Xbox app, Office mobile)
- Shopify
- Discord
- Coinbase
- Walmart
- Tesla

**When NOT to use React Native:**
- Heavy 3D/game-adjacent UIs.
- Apps requiring consistent pixel-perfect design across all platforms.
- Apps where animation smoothness is non-negotiable (e.g., live trading terminals with charts).

---

### 3.3 Swift — Native iOS

**Language:** Swift | **Backed by:** Apple

**Performance:** Unmatched for iOS. Direct access to every Apple platform API the day it ships. Mandatory for AR/VR, real-time audio processing, computational photography, and platform ML frameworks (Core ML).

**Developer Experience:** SwiftUI has modernized iOS UI development dramatically. Declarative, type-safe, and increasingly similar in mental model to React/Flutter. Xcode Previews provide live UI feedback. Best-in-class profiling tools (Instruments).

**When NOT to use Native iOS alone:**
- When you have a small team that cannot afford to maintain separate iOS and Android codebases.
- If your app doesn't need bleeding-edge Apple platform features.
- When feature parity across iOS and Android is critical and your team is small.

---

### 3.4 Kotlin — Native Android

**Language:** Kotlin | **Backed by:** JetBrains + Google

Jetpack Compose (stable since 2021, mature by 2023) brings a declarative UI paradigm that mirrors SwiftUI, making modern Android development genuinely enjoyable. Compose Multiplatform is gradually extending this to other platforms.

**Real-World Adoption:** Every major Android-first app. Google's own suite. WhatsApp, Instagram (partial), TikTok (core logic).

**When NOT to use Native Android alone:** Same reasoning as native iOS — dual-codebase maintenance cost is significant without a strong specific reason.

---

### 3.5 Kotlin Multiplatform (KMP)

**Language:** Kotlin | **Backed by:** JetBrains + Google

A fundamentally different philosophy: share business logic (networking, data models, domain logic, repositories) across platforms, but write native UI for each (SwiftUI on iOS, Compose on Android). This is NOT a UI framework.

**Key distinction:** KMP targets developers who want the best of both worlds — code sharing where it matters (logic) without compromising on UI quality. JetBrains made KMP stable in late 2023; Google officially endorsed it as the preferred logic-sharing approach.

**Real-World Adoption:**
- Netflix (early adopter)
- McDonald's
- VMware
- Cash App (Block)

**When NOT to use KMP:**
- Small teams or MVPs — dual-codebase UI overhead kills velocity.
- If your iOS team doesn't know Swift and doesn't want to learn.
- Overkill when a simpler cross-platform framework would suffice.

---

### 3.6 .NET MAUI

**Language:** C# | **Backed by:** Microsoft

The successor to Xamarin. Targets iOS, Android, macOS, and Windows from a single C# codebase. The dominant choice in Microsoft-centric enterprises — if your backend is .NET, your team knows C#, and you're building B2B/enterprise apps, MAUI is a pragmatic choice.

**When NOT to use .NET MAUI:**
- Consumer apps with high design standards.
- Startups or any team without existing C# expertise.
- Teams wanting access to the widest available library ecosystem.

---

### 3.7 Ionic / PWA / Hybrid

**Language:** TypeScript | **Backed by:** Ionic/Community

Ionic wraps a web app in a WebView. Performance is passable for simple CRUD apps but shows under load. Progressive Web Apps (PWAs) have solid browser support in 2025, but iOS/Safari still lags (push notifications partially supported, background sync limited).

**Best use cases:**
- Internal enterprise tools.
- Forms-heavy B2B apps.
- Rapid prototyping where app-store distribution isn't needed.

**When NOT to use Hybrid/PWA:**
- Any consumer app where perceived quality matters.
- Anything requiring smooth animations.
- Apps needing hardware access beyond basic camera/GPS.

---

## 4. Pros & Cons Summary

### Flutter

| ✅ Pros | ❌ Cons |
|---------|---------|
| Single codebase → iOS, Android, Web, Desktop | Dart is a niche language (smaller talent pool than JS) |
| Pixel-perfect custom UI | App binary size slightly larger than native |
| Consistent 60/120fps via Impeller | Platform channels add friction for deep OS integrations |
| Hot reload — fastest UI iteration | Google has historically abandoned products |
| Growing enterprise adoption | |

### React Native

| ✅ Pros | ❌ Cons |
|---------|---------|
| Largest talent pool (any React dev) | Animation jank vs Flutter in complex UIs |
| Expo simplifies setup dramatically | Two rendering engines to debug |
| npm ecosystem: millions of packages | Breaking changes between major versions historically painful |
| Code sharing with React web apps | Less consistent pixel-perfect UI cross-platform |
| New Architecture eliminates JS bridge | |

### Native (Swift + Kotlin)

| ✅ Pros | ❌ Cons |
|---------|---------|
| Maximum performance | Two codebases = 2× maintenance cost |
| Day-1 access to new OS features | Requires iOS AND Android specialists |
| Full hardware API access | Feature parity hard to maintain across platforms |
| Best-in-class debugging/profiling | Higher cost per feature |
| Platform UX conventions automatically correct | |

### KMP

| ✅ Pros | ❌ Cons |
|---------|---------|
| Share business logic, networking, data models | Requires two separate UI codebases |
| Native UI on both platforms | Steep learning curve for iOS teams unfamiliar with Kotlin |
| Google-endorsed for Android | Smaller ecosystem than Flutter/RN |
| Best architectural approach for large teams | Overkill for small teams |

### .NET MAUI

| ✅ Pros | ❌ Cons |
|---------|---------|
| Natural for .NET/C# enterprise teams | No mindshare outside .NET ecosystem |
| Covers Windows desktop + mobile in one codebase | UI rendering quality below Flutter/native |
| Strong Visual Studio tooling | Smaller community |
| Good for LOB/internal apps | Xamarin legacy baggage |

### Ionic / PWA

| ✅ Pros | ❌ Cons |
|---------|---------|
| Any web dev can build immediately | Performance ceiling: WebView is fundamentally limited |
| Fastest to market for simple apps | Feels like a web app, not a mobile app |
| No app store distribution needed (PWA) | iOS PWA support still lagging |
| Full npm ecosystem | Not suitable for performance-sensitive use cases |

---

## 5. Decision Framework

```
Starting a new mobile app?
│
├─ Hardware-intensive / AR / HealthKit?
│  └─ YES → Native: Swift (iOS) + Kotlin (Android)
│
├─ Team is primarily React/JS + budget/deadline constrained?
│  └─ YES → React Native + Expo
│
├─ Small team or solo? Need iOS + Android + Web + Desktop?
│  └─ YES → Flutter (best overall choice)
│
├─ Existing .NET/C# enterprise team + Windows desktop needed?
│  └─ YES → .NET MAUI (or Blazor Hybrid)
│
├─ Large team + native UI critical + complex shared business logic?
│  └─ YES → Kotlin Multiplatform (KMP)
│
└─ None of the above → Flutter (default recommendation)
```

---

## 6. Medal Recommendations

### 🥇 Best Overall — Flutter

Flutter wins in 2025 because it solves the hardest problem in mobile development: delivering a consistent, beautiful, high-performance experience across multiple platforms from a single codebase, without compromising on UI quality. The one-time cost of learning Dart is outweighed by years of productivity gains. Impeller has addressed prior rendering criticisms. Google's structural dependency (Fuchsia OS uses Flutter) creates strong long-term viability signals.

### 🥈 Best for Startups / MVPs — React Native + Expo

If you're moving fast and your team already knows React, React Native with Expo is the fastest path to a production app. The New Architecture makes most prior performance arguments against RN obsolete. The talent pool is unmatched. Ship fast, validate, then optimize.

### 🥉 Best for Performance-Critical Apps — Swift (iOS) + Kotlin (Android)

Any app in AR, real-time audio, computational photography, health monitoring, or advanced gaming needs native. Platform frameworks like ARKit, RealityKit, Core ML, and HealthKit don't have equivalent cross-platform abstractions.

### 🏢 Best for Enterprise Scale

- **New enterprise products:** Flutter
- **Existing native apps that need logic sharing:** KMP
- **Microsoft-stack enterprises:** .NET MAUI

---

## 7. 🏆 Final Verdict

> **If you could only choose one stack in 2025+: Flutter + Dart**

**The case, bluntly stated:**

1. **The talent pool fear is overstated.** Dart takes a week to learn for any developer who knows an OOP language. Flutter engineers are increasingly available.

2. **The Google abandonment fear is rational but mitigated.** Flutter is the only framework that can build for Fuchsia (Google's next-gen OS). Google Pay and Google's own first-party apps run on Flutter.

3. **The cross-platform coverage is unmatched.** Mobile + Web + Desktop from one codebase. Most competitors deliver 2 of 3 credibly.

4. **The UI quality ceiling is higher than any other cross-platform option.** Nubank, BMW, and eBay ship premium experiences in Flutter. The "it looks like a cross-platform app" criticism does not hold in 2025.

5. **In 90%+ of app categories, end users cannot distinguish a well-built Flutter app from a native app.**

---

## 8. Recommended Tech Stack

### Frontend (Flutter)

| Layer | Technology | Notes |
|-------|-----------|-------|
| State Management | Riverpod 2.x | Preferred; Bloc for complex enterprise apps |
| Navigation | `go_router` | Officially endorsed by Flutter team |
| HTTP Client | `dio` + `retrofit` | Type-safe API clients with interceptors |
| Local Database | `Hive` / `Isar` | Key-value or structured local storage |
| Code Generation | `freezed` + `json_serializable` | Immutable models, JSON parsing |
| Testing | `flutter_test` + `mocktail` + `patrol` | Unit, widget, integration tests |
| Analytics | PostHog Flutter SDK | Or Firebase Analytics |
| Crash Reporting | Sentry | Production crash monitoring |

### Backend

| Layer | Technology | Notes |
|-------|-----------|-------|
| Core API | Node.js (TypeScript) / Go | Fastify for Node, Gin for Go |
| Auth | Supabase Auth | Saves months vs rolling your own |
| Realtime | Supabase Realtime / Socket.io | WebSocket-based live data |
| Background Jobs | BullMQ (Redis-backed) | Queue-based background processing |
| Push Notifications | FCM (Android) + APNs (iOS) | Via Firebase |

### Data Layer

| Layer | Technology | Notes |
|-------|-----------|-------|
| Primary DB | PostgreSQL via Supabase | DB + auth + storage + realtime in one |
| Cache | Redis / Upstash | Serverless Redis option available |
| Object Storage | Cloudflare R2 | Cheaper than S3 for egress costs |
| Search | Algolia / Typesense | Typesense = open-source alternative |
| Analytics | PostHog / Amplitude | Product analytics |

### DevOps & CI/CD

| Tool | Purpose |
|------|---------|
| Codemagic | Flutter-native CI/CD |
| GitHub Actions | Supplementary automation |
| Fastlane | Code signing + app store delivery |
| Firebase App Distribution | Beta testing distribution |

---

## 9. Emerging Technologies to Watch

- **Compose Multiplatform (JetBrains):** Kotlin-based UI framework extending to iOS and Desktop. Could challenge Flutter by 2026.
- **Flutter WASM:** Flutter now compiles to WebAssembly for web targets. Maturing in 2025.
- **On-Device AI:** Gemini Nano (Android), Apple Intelligence (iOS) — plan for these as integration requirements from day one.
- **AI-generated app scaffolding:** Tools like Bolt.new and v0 can bootstrap React Native/Expo stacks automatically, lowering the entry barrier further for web developers entering mobile.

---

---

# 10. Flutter Beginner Guide — Complete Setup to First App

> **Goal:** Take a complete beginner from zero to a working Flutter app, running on both Android and iOS, with a solid mental model of how Flutter works.

---

## 10.1 What is Flutter?

Flutter is an open-source UI framework created by Google that lets you build natively compiled applications for mobile (iOS & Android), web, and desktop — all from a **single codebase** written in the **Dart** programming language.

### How Flutter works (the key insight)

Unlike React Native (which maps to native widgets) or Ionic (which uses a WebView), Flutter **draws every pixel itself** using its own rendering engine (Impeller/Skia). This means:

- 🎨 Your UI looks identical on every platform
- ⚡ 60/120fps performance without platform widget translation overhead
- 🔧 Total control over every pixel of your UI

### Core terminology

| Term | Meaning |
|------|---------|
| **Widget** | Every UI element in Flutter is a widget (buttons, text, padding, layouts — everything) |
| **StatelessWidget** | A widget whose content never changes after being built |
| **StatefulWidget** | A widget that can change its appearance in response to user interactions or data changes |
| **Widget Tree** | The hierarchy of nested widgets that describes your entire UI |
| **BuildContext** | A handle to the location of a widget in the widget tree |
| **Scaffold** | A base visual structure widget providing AppBar, Body, FloatingActionButton, Drawer, etc. |
| **pub.dev** | Flutter/Dart's package repository (equivalent to npm for JavaScript) |
| **pubspec.yaml** | Your project's configuration file — lists dependencies, assets, fonts |

---

## 10.2 System Requirements

### Windows

| Requirement | Minimum |
|-------------|---------|
| OS | Windows 10 64-bit or later |
| RAM | 8 GB (16 GB recommended) |
| Disk Space | 10 GB free (SDK + Android Studio + emulator) |
| Tools | Git for Windows 2.27+ |

### macOS

| Requirement | Minimum |
|-------------|---------|
| OS | macOS 12 (Monterey) or later |
| RAM | 8 GB (16 GB recommended) |
| Disk Space | 15 GB free (Xcode + Android tools) |
| Additional | Xcode 14+ (for iOS development) |

### Linux

| Requirement | Minimum |
|-------------|---------|
| OS | Ubuntu 22.04 LTS or equivalent 64-bit |
| RAM | 8 GB |
| Tools | `bash`, `curl`, `git`, `unzip`, `xz-utils`, `zip`, `libglu1-mesa` |

---

## 10.3 Installation — Windows

### Step 1: Install Git

Download and install [Git for Windows](https://git-scm.com/download/win). Accept default settings.

Verify:
```bash
git --version
# Expected: git version 2.x.x
```

### Step 2: Download Flutter SDK

1. Visit [flutter.dev/install](https://flutter.dev/install)
2. Download the latest stable `.zip` for Windows (e.g., `flutter_windows_3.x.x-stable.zip`)
3. Extract to a path **without spaces or special characters**

```
✅ Recommended: C:\flutter
❌ Avoid:  C:\Program Files\flutter
❌ Avoid:  C:\Users\My Name\Desktop\flutter
```

### Step 3: Add Flutter to PATH

1. Search for **"Edit the system environment variables"** in the Start menu
2. Click **Environment Variables**
3. Under **User variables**, find `Path` → click **Edit**
4. Click **New** → add `C:\flutter\bin`
5. Click **OK** through all dialogs

### Step 4: Verify Flutter is accessible

Open a **new** Command Prompt or PowerShell:
```bash
flutter --version
```

You should see output like:
```
Flutter 3.x.x • channel stable • https://github.com/flutter/flutter.git
Framework • revision xxxxxxxx
Engine • revision xxxxxxxx
Tools • Dart 3.x.x • DevTools 2.x.x
```

---

## 10.4 Installation — macOS

### Step 1: Install Homebrew (recommended)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Step 2: Install Flutter via Homebrew (simplest method)

```bash
brew install --cask flutter
```

OR download manually:
1. Visit [flutter.dev/install](https://flutter.dev/install)
2. Download the `.tar.xz` for macOS (Intel or Apple Silicon — pick correctly!)
3. Extract and move to a permanent location

```bash
# Create destination folder
mkdir -p ~/development

# Extract (adjust filename to your downloaded version)
tar xf ~/Downloads/flutter_macos_arm64_3.x.x-stable.tar.xz -C ~/development/
```

### Step 3: Add Flutter to PATH

Add this line to your shell config file:

**For zsh (default on macOS)** — edit `~/.zshrc`:
```bash
echo 'export PATH="$HOME/development/flutter/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**For bash** — edit `~/.bash_profile`:
```bash
echo 'export PATH="$HOME/development/flutter/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

### Step 4: Install Xcode (for iOS development)

```bash
# Install Xcode from Mac App Store, then:
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```

Accept the Xcode license:
```bash
sudo xcodebuild -license accept
```

Install CocoaPods (required for iOS Flutter plugins):
```bash
sudo gem install cocoapods
```

### Step 5: Verify

```bash
flutter --version
```

---

## 10.5 Installation — Linux

### Step 1: Install dependencies

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip xz-utils zip libglu1-mesa
```

### Step 2: Download and extract Flutter

```bash
# Create folder
mkdir -p ~/development
cd ~/development

# Download (get latest URL from flutter.dev/install)
wget https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.x.x-stable.tar.xz

# Extract
tar xf flutter_linux_3.x.x-stable.tar.xz
```

### Step 3: Add to PATH

```bash
echo 'export PATH="$HOME/development/flutter/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## 10.6 IDE Setup

You have two main options. **VS Code is recommended for beginners** due to its simplicity; Android Studio is better once you need the full emulator management UI.

### Option A: Visual Studio Code (Recommended for Beginners)

1. Download [VS Code](https://code.visualstudio.com/)
2. Open VS Code → press `Ctrl+Shift+X` (Extensions panel)
3. Search for and install:
   - **Flutter** (by Dart Code) — installs Dart extension automatically
4. Restart VS Code

**Key VS Code shortcuts for Flutter:**
| Action | Shortcut |
|--------|----------|
| Open Command Palette | `Ctrl+Shift+P` / `Cmd+Shift+P` |
| Hot Reload | `Ctrl+S` (while debug session running) |
| Full Restart | `Shift+F5`, then `F5` |
| Run without debugging | `Ctrl+F5` |
| Flutter: New Project | Command Palette → "Flutter: New Project" |

### Option B: Android Studio

1. Download [Android Studio](https://developer.android.com/studio)
2. Run the installer and complete the setup wizard (installs Android SDK automatically)
3. Open Android Studio → **Plugins** → search "Flutter" → Install → also install Dart when prompted
4. Restart Android Studio

### Setting Up Android Emulator (both IDEs)

1. Open Android Studio
2. Go to **Tools → Device Manager** (or AVD Manager)
3. Click **Create Device**
4. Select a device (e.g., Pixel 7) → Click **Next**
5. Select a system image — download **API 34 (Android 14)** or latest
6. Click **Next** → **Finish**

To start the emulator:
```bash
flutter emulators --launch <emulator_id>
# Or simply click the play button in Android Studio's Device Manager
```

### Setting Up iOS Simulator (macOS only)

```bash
# Install iOS Simulator via Xcode
open -a Simulator
# Or from Xcode: Xcode menu → Open Developer Tool → Simulator
```

---

## 10.7 Verify Installation with `flutter doctor`

This is the most important verification step. Run it in your terminal:

```bash
flutter doctor
```

**Expected output (all checkmarks):**
```
Doctor summary (to see all details, run flutter doctor -v):
[✓] Flutter (Channel stable, 3.x.x, on macOS 14.x)
[✓] Android toolchain - develop for Android devices (Android SDK version 34.x.x)
[✓] Xcode - develop for iOS and macOS (Xcode 15.x)
[✓] Chrome - develop for the web
[✓] Android Studio (version 2023.x)
[✓] VS Code (version 1.x.x)
[✓] Connected device (1 available)
[✓] Network resources

• No issues found!
```

### Common Issues and Fixes

**Issue:** `[!] Android toolchain - Missing cmdline-tools`
```bash
# Fix: Open Android Studio → SDK Manager → SDK Tools tab
# Check: Android SDK Command-line Tools (latest) → Apply
```

**Issue:** `[!] Xcode - CocoaPods not installed`
```bash
sudo gem install cocoapods
# If that fails (Apple Silicon):
brew install cocoapods
```

**Issue:** `[!] Android licenses not accepted`
```bash
flutter doctor --android-licenses
# Press 'y' to accept each license
```

**Issue:** `flutter: command not found`
- Recheck your PATH variable — open a new terminal window after editing

---

## 10.8 Creating Your First Project

### Method 1: Command Line (Recommended for learning)

```bash
# Navigate to where you want your projects
cd ~/Documents

# Create a new Flutter app
flutter create my_first_app

# Open the project
cd my_first_app

# Open in VS Code
code .
```

### Method 2: VS Code

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: **Flutter: New Project**
3. Select: **Application**
4. Choose a folder for your project
5. Enter a project name (lowercase, underscores only: `my_first_app`)

### Method 3: Android Studio

1. **File → New → New Flutter Project**
2. Select **Flutter Application** → Next
3. Set project name, location, and verify Flutter SDK path
4. Click **Finish**

### Project naming rules

```
✅ my_first_app
✅ todo_list
✅ shopping_cart
❌ MyFirstApp      (no camelCase)
❌ my-first-app    (no hyphens)
❌ My First App    (no spaces)
```

---

## 10.9 Understanding Project Structure

After creating a project, you'll see this structure:

```
my_first_app/
├── android/                  # Android-specific native code
├── ios/                      # iOS-specific native code
├── lib/                      # ← YOUR APP LIVES HERE
│   └── main.dart             # Entry point of your app
├── test/                     # Unit and widget tests
│   └── widget_test.dart
├── web/                      # Web platform files
├── linux/                    # Linux desktop files
├── macos/                    # macOS desktop files
├── windows/                  # Windows desktop files
├── pubspec.yaml              # ← DEPENDENCIES & CONFIG
├── pubspec.lock              # Locked dependency versions
├── analysis_options.yaml     # Lint rules
└── README.md
```

### Key files explained

**`lib/main.dart`** — The entry point of your app. Every Flutter app starts here.

**`pubspec.yaml`** — Your project's manifest. Defines:
```yaml
name: my_first_app
description: My first Flutter application.
version: 1.0.0+1                # version: major.minor.patch+build_number

environment:
  sdk: ">=3.0.0 <4.0.0"        # Dart SDK constraint

dependencies:                   # Packages your app needs
  flutter:
    sdk: flutter
  http: ^1.2.0                  # Example: add HTTP package

dev_dependencies:               # Packages for testing/development only
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
  assets:                       # Declare images/files your app uses
    - assets/images/
  fonts:                        # Declare custom fonts
    - family: MyFont
      fonts:
        - asset: assets/fonts/MyFont-Regular.ttf
```

---

## 10.10 Dart Language Essentials

Dart is the language Flutter uses. It's easy to learn — especially if you know JavaScript, Java, or C#. Here are the essentials you need to start building Flutter apps.

### Variables and Types

```dart
// Strongly typed — always specify or let Dart infer the type
String name = "Alice";
int age = 30;
double height = 1.75;
bool isLoggedIn = true;

// Type inference with 'var'
var city = "Mumbai";    // Dart infers: String
var score = 100;        // Dart infers: int

// Constants
const double pi = 3.14159;   // Compile-time constant
final DateTime now = DateTime.now();  // Runtime constant (assigned once)

// Null safety — types are non-nullable by default
String name = "Alice";   // Cannot be null
String? nickname;        // CAN be null (notice the ?)
```

### Functions

```dart
// Basic function
String greet(String name) {
  return "Hello, $name!";
}

// Arrow syntax (for single-expression functions)
String greet(String name) => "Hello, $name!";

// Named parameters (Flutter uses these extensively)
void showCard({required String title, String subtitle = "No subtitle"}) {
  print("$title: $subtitle");
}

// Calling with named parameters:
showCard(title: "News", subtitle: "Breaking story");
showCard(title: "Events");  // subtitle uses default value
```

### String interpolation

```dart
String name = "Flutter";
int version = 3;

// Use $ for simple variables
print("I love $name");

// Use ${} for expressions
print("Flutter version ${version + 1} coming soon");
print("Name has ${name.length} characters");
```

### Lists, Maps, and Sets

```dart
// List (ordered, allows duplicates)
List<String> fruits = ["Apple", "Banana", "Cherry"];
fruits.add("Mango");
fruits[0];             // "Apple"
fruits.length;         // 4

// Map (key-value pairs)
Map<String, int> scores = {
  "Alice": 95,
  "Bob": 87,
};
scores["Alice"];       // 95
scores["Charlie"] = 100;  // Add new entry

// Set (unordered, no duplicates)
Set<String> tags = {"flutter", "dart", "mobile"};
```

### Classes

```dart
class User {
  final String name;
  final String email;
  int age;

  // Constructor
  User({required this.name, required this.email, required this.age});

  // Named constructor
  User.guest() : name = "Guest", email = "guest@example.com", age = 0;

  // Method
  String greet() => "Hi, I'm $name!";

  // Getter
  bool get isAdult => age >= 18;
}

// Usage
final user = User(name: "Alice", email: "alice@example.com", age: 25);
print(user.greet());    // Hi, I'm Alice!
print(user.isAdult);    // true
```

### Async / Await (critical for API calls)

```dart
// A Future represents a value that will be available in the future
Future<String> fetchUserName() async {
  // Simulate network delay
  await Future.delayed(Duration(seconds: 2));
  return "Alice";
}

// Calling an async function
void main() async {
  print("Fetching...");
  String name = await fetchUserName();  // Waits for the Future to complete
  print("Got: $name");
}

// Handling errors
Future<void> loadData() async {
  try {
    String data = await fetchFromApi();
    print(data);
  } catch (e) {
    print("Error: $e");
  }
}
```

---

## 10.11 Flutter Core Concepts

### Everything is a Widget

In Flutter, the entire UI is built by composing widgets. Buttons, text, images, padding, rows, columns — all widgets. Think of it like building with LEGO bricks.

```dart
// A simple widget tree
Scaffold(                          // App skeleton
  appBar: AppBar(                  // Top bar
    title: Text("My App"),         // Text widget
  ),
  body: Center(                    // Center alignment widget
    child: Column(                 // Vertical layout
      children: [
        Text("Hello, World!"),     // Text
        SizedBox(height: 16),      // Empty space
        ElevatedButton(            // Button
          onPressed: () {},
          child: Text("Tap me"),
        ),
      ],
    ),
  ),
);
```

### StatelessWidget vs StatefulWidget

**StatelessWidget** — for UI that never changes:

```dart
class WelcomeCard extends StatelessWidget {
  final String userName;

  const WelcomeCard({super.key, required this.userName});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Text("Welcome, $userName!"),
      ),
    );
  }
}
```

**StatefulWidget** — for UI that needs to react to changes:

```dart
class CounterWidget extends StatefulWidget {
  const CounterWidget({super.key});

  @override
  State<CounterWidget> createState() => _CounterWidgetState();
}

class _CounterWidgetState extends State<CounterWidget> {
  int _count = 0;  // This is the STATE

  void _increment() {
    setState(() {    // ← Always call setState when changing state
      _count++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text("Count: $_count", style: TextStyle(fontSize: 24)),
        ElevatedButton(
          onPressed: _increment,
          child: Text("Increment"),
        ),
      ],
    );
  }
}
```

> **Rule:** `setState()` tells Flutter "something changed, please rebuild this widget."

### Essential Layout Widgets

```dart
// Column — stacks children vertically
Column(
  mainAxisAlignment: MainAxisAlignment.center,    // Vertical alignment
  crossAxisAlignment: CrossAxisAlignment.start,   // Horizontal alignment
  children: [Widget1(), Widget2(), Widget3()],
)

// Row — places children horizontally
Row(
  mainAxisAlignment: MainAxisAlignment.spaceBetween,
  children: [Widget1(), Widget2()],
)

// Stack — overlays children on top of each other
Stack(
  children: [
    BackgroundImage(),
    Positioned(bottom: 16, right: 16, child: FloatingText()),
  ],
)

// Container — versatile box widget
Container(
  width: 200,
  height: 100,
  padding: EdgeInsets.all(16),
  margin: EdgeInsets.symmetric(vertical: 8),
  decoration: BoxDecoration(
    color: Colors.blue,
    borderRadius: BorderRadius.circular(12),
    boxShadow: [BoxShadow(blurRadius: 8, color: Colors.black26)],
  ),
  child: Text("Inside a container"),
)

// Padding — adds space around a widget
Padding(
  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
  child: Text("Padded text"),
)

// SizedBox — fixed-size space or fixed-size box
SizedBox(height: 16)                    // Vertical spacer
SizedBox(width: 8)                      // Horizontal spacer
SizedBox(width: 200, height: 100, child: MyWidget())  // Fixed size box

// Expanded — fills remaining space in Row/Column
Row(
  children: [
    Expanded(child: TextField()),       // Takes all available horizontal space
    SizedBox(width: 8),
    ElevatedButton(onPressed: () {}, child: Text("Send")),
  ],
)
```

### Common UI Widgets

```dart
// Text
Text(
  "Hello Flutter!",
  style: TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: Colors.blue,
  ),
)

// Image
Image.asset("assets/images/logo.png")
Image.network("https://example.com/photo.jpg")

// Icon
Icon(Icons.favorite, color: Colors.red, size: 32)

// Button variants
ElevatedButton(onPressed: () {}, child: Text("Elevated"))
TextButton(onPressed: () {}, child: Text("Text"))
OutlinedButton(onPressed: () {}, child: Text("Outlined"))
IconButton(onPressed: () {}, icon: Icon(Icons.share))
FloatingActionButton(onPressed: () {}, child: Icon(Icons.add))

// TextField
TextField(
  decoration: InputDecoration(
    labelText: "Email",
    hintText: "Enter your email",
    border: OutlineInputBorder(),
    prefixIcon: Icon(Icons.email),
  ),
  onChanged: (value) => print(value),
)

// Card
Card(
  elevation: 4,
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  child: Padding(
    padding: EdgeInsets.all(16),
    child: Text("Card content"),
  ),
)

// ListView (scrollable list)
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) {
    return ListTile(
      leading: Icon(Icons.star),
      title: Text(items[index]),
      subtitle: Text("Subtitle"),
      onTap: () {},
    );
  },
)
```

---

## 10.12 Building Your First Real App

Let's build a **Task Manager app** with the ability to add tasks, mark them complete, and delete them. This will teach you: StatefulWidget, TextField, ListView, and basic state management.

### Complete Code

Open `lib/main.dart` and replace everything with this:

```dart
import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

// Root of the application
class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Task Manager',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const TaskScreen(),
    );
  }
}

// Task model
class Task {
  final String id;
  String title;
  bool isCompleted;

  Task({
    required this.id,
    required this.title,
    this.isCompleted = false,
  });
}

// Main screen
class TaskScreen extends StatefulWidget {
  const TaskScreen({super.key});

  @override
  State<TaskScreen> createState() => _TaskScreenState();
}

class _TaskScreenState extends State<TaskScreen> {
  // State: list of tasks
  final List<Task> _tasks = [
    Task(id: '1', title: 'Learn Flutter widgets'),
    Task(id: '2', title: 'Build my first app'),
    Task(id: '3', title: 'Deploy to app stores'),
  ];

  // Controller for the text input
  final TextEditingController _textController = TextEditingController();

  // Add a new task
  void _addTask() {
    final title = _textController.text.trim();
    if (title.isEmpty) return;

    setState(() {
      _tasks.add(Task(
        id: DateTime.now().toString(),
        title: title,
      ));
    });

    _textController.clear();  // Clear the input
  }

  // Toggle task completion
  void _toggleTask(String id) {
    setState(() {
      final task = _tasks.firstWhere((t) => t.id == id);
      task.isCompleted = !task.isCompleted;
    });
  }

  // Delete a task
  void _deleteTask(String id) {
    setState(() {
      _tasks.removeWhere((t) => t.id == id);
    });
  }

  @override
  void dispose() {
    // Always dispose controllers to free memory
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final completedCount = _tasks.where((t) => t.isCompleted).length;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: const Text('Task Manager'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                '$completedCount / ${_tasks.length} done',
                style: const TextStyle(fontSize: 14),
              ),
            ),
          ),
        ],
      ),

      body: Column(
        children: [
          // Input area
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    decoration: const InputDecoration(
                      hintText: 'Add a new task...',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                    onSubmitted: (_) => _addTask(),  // Add on Enter key
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _addTask,
                  child: const Text('Add'),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Task list
          Expanded(
            child: _tasks.isEmpty
                ? const Center(
                    child: Text(
                      'No tasks yet!\nAdd one above.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.grey,
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: _tasks.length,
                    itemBuilder: (context, index) {
                      final task = _tasks[index];
                      return TaskTile(
                        task: task,
                        onToggle: () => _toggleTask(task.id),
                        onDelete: () => _deleteTask(task.id),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

// Separate widget for each task row
class TaskTile extends StatelessWidget {
  final Task task;
  final VoidCallback onToggle;
  final VoidCallback onDelete;

  const TaskTile({
    super.key,
    required this.task,
    required this.onToggle,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Checkbox(
        value: task.isCompleted,
        onChanged: (_) => onToggle(),
      ),
      title: Text(
        task.title,
        style: TextStyle(
          decoration: task.isCompleted
              ? TextDecoration.lineThrough
              : TextDecoration.none,
          color: task.isCompleted ? Colors.grey : null,
        ),
      ),
      trailing: IconButton(
        icon: const Icon(Icons.delete_outline, color: Colors.red),
        onPressed: onDelete,
      ),
    );
  }
}
```

### Running the app

```bash
# With a device/emulator connected:
flutter run

# Target a specific platform:
flutter run -d android
flutter run -d ios
flutter run -d chrome    # Run as web app
flutter run -d macos     # Run as macOS desktop app

# For production builds:
flutter build apk        # Android APK
flutter build appbundle  # Android App Bundle (recommended for Play Store)
flutter build ios        # iOS (requires Xcode)
flutter build web        # Web app
```

---

## 10.13 Running & Debugging

### Hot Reload vs Hot Restart vs Full Restart

| Action | What it does | Preserves State? | When to use |
|--------|-------------|-----------------|-------------|
| **Hot Reload** (`r` in terminal or `Ctrl+S` in VS Code) | Reapplies code changes to running app | ✅ Yes | UI tweaks, style changes |
| **Hot Restart** (`R` in terminal) | Restarts app with new code | ❌ No | Logic changes, new state variables |
| **Full Restart** (Stop + Run) | Full cold start | ❌ No | Native plugin changes, manifest changes |

### Debugging Tools

```bash
# Check connected devices
flutter devices

# Run in verbose mode (for troubleshooting)
flutter run -v

# Analyze code for errors and warnings
flutter analyze

# Run tests
flutter test

# Check for outdated packages
flutter pub outdated

# Upgrade all packages to latest compatible versions
flutter pub upgrade

# Clean build cache (fixes many strange build errors)
flutter clean
flutter pub get
```

### Flutter DevTools

DevTools is a powerful browser-based debugging suite built into Flutter:

```bash
# Launch DevTools
flutter run --profile     # Or press 'd' while running
# Then open the provided URL in Chrome
```

DevTools lets you:
- 🔍 Inspect the widget tree visually
- 📊 Profile CPU and memory usage
- 🎨 See layout boxes and padding
- 🌐 Monitor network requests
- 📝 View logs and errors

---

## 10.14 State Management Basics

For simple apps, `setState()` is sufficient. As apps grow, you need a better solution. Here are the two most recommended approaches:

### Provider (Simple — built into Flutter team recommendations)

```bash
# Add to pubspec.yaml
flutter pub add provider
```

```dart
// Step 1: Create a ChangeNotifier class (your app state)
import 'package:flutter/foundation.dart';

class CounterState extends ChangeNotifier {
  int _count = 0;
  int get count => _count;

  void increment() {
    _count++;
    notifyListeners();  // Tells Flutter to rebuild listening widgets
  }
}
```

```dart
// Step 2: Wrap your app with ChangeNotifierProvider
import 'package:provider/provider.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => CounterState(),
      child: MyApp(),
    ),
  );
}
```

```dart
// Step 3: Read/update state in any widget
class CounterPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Read the state (rebuilds when state changes)
    final counter = context.watch<CounterState>();

    return Column(
      children: [
        Text('Count: ${counter.count}'),
        ElevatedButton(
          // Trigger state change (doesn't rebuild this widget)
          onPressed: () => context.read<CounterState>().increment(),
          child: Text('Increment'),
        ),
      ],
    );
  }
}
```

### Riverpod (Recommended for production apps)

```bash
flutter pub add flutter_riverpod
```

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Define a provider
final counterProvider = StateNotifierProvider<CounterNotifier, int>((ref) {
  return CounterNotifier();
});

class CounterNotifier extends StateNotifier<int> {
  CounterNotifier() : super(0);
  void increment() => state++;
}

// Wrap app with ProviderScope
void main() {
  runApp(ProviderScope(child: MyApp()));
}

// Consume in a widget (extend ConsumerWidget instead of StatelessWidget)
class CounterPage extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(counterProvider);
    return Column(
      children: [
        Text('Count: $count'),
        ElevatedButton(
          onPressed: () => ref.read(counterProvider.notifier).increment(),
          child: Text('Increment'),
        ),
      ],
    );
  }
}
```

---

## 10.15 Navigation Basics

### Simple navigation between screens

```dart
// Navigate to a new screen
Navigator.push(
  context,
  MaterialPageRoute(builder: (context) => SecondScreen()),
);

// Go back
Navigator.pop(context);

// Pass data to the next screen
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => DetailScreen(itemId: "42"),
  ),
);

// Return data from a screen
final result = await Navigator.push(
  context,
  MaterialPageRoute(builder: (context) => SelectionScreen()),
);
print("User selected: $result");
```

### go_router (Recommended for production)

```bash
flutter pub add go_router
```

```dart
import 'package:go_router/go_router.dart';

// Define your routes
final router = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => HomeScreen(),
    ),
    GoRoute(
      path: '/detail/:id',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return DetailScreen(id: id);
      },
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => SettingsScreen(),
    ),
  ],
);

// Use in MaterialApp
MaterialApp.router(routerConfig: router)

// Navigate anywhere in your app
context.go('/');                    // Navigate (replace current)
context.push('/detail/42');         // Navigate (push on stack)
context.pop();                      // Go back
```

---

## 10.16 Working with APIs

### Adding the HTTP package

```bash
flutter pub add http
```

### Making a GET request

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String _baseUrl = "https://jsonplaceholder.typicode.com";

  // Fetch a list of posts
  Future<List<Post>> getPosts() async {
    final url = Uri.parse("$_baseUrl/posts");

    try {
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => Post.fromJson(json)).toList();
      } else {
        throw Exception("Failed to load: ${response.statusCode}");
      }
    } catch (e) {
      throw Exception("Network error: $e");
    }
  }
}

// Post model
class Post {
  final int id;
  final String title;
  final String body;

  Post({required this.id, required this.title, required this.body});

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id'],
      title: json['title'],
      body: json['body'],
    );
  }
}
```

### Displaying API data in UI with FutureBuilder

```dart
class PostsScreen extends StatelessWidget {
  final ApiService _api = ApiService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Posts")),
      body: FutureBuilder<List<Post>>(
        future: _api.getPosts(),
        builder: (context, snapshot) {
          // Loading state
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }

          // Error state
          if (snapshot.hasError) {
            return Center(child: Text("Error: ${snapshot.error}"));
          }

          // Success state
          final posts = snapshot.data!;
          return ListView.builder(
            itemCount: posts.length,
            itemBuilder: (context, index) {
              final post = posts[index];
              return ListTile(
                leading: CircleAvatar(child: Text("${post.id}")),
                title: Text(post.title),
                subtitle: Text(post.body, maxLines: 2, overflow: TextOverflow.ellipsis),
              );
            },
          );
        },
      ),
    );
  }
}
```

---

## 10.17 Best Practices for Beginners

### Code Organization

```
lib/
├── main.dart               # Entry point only — keep this minimal
├── app.dart                # MaterialApp configuration
├── models/                 # Data classes
│   ├── user.dart
│   └── post.dart
├── services/               # API calls, database, storage
│   └── api_service.dart
├── providers/              # State management
│   └── auth_provider.dart
├── screens/                # Full-page screens
│   ├── home/
│   │   └── home_screen.dart
│   └── detail/
│       └── detail_screen.dart
├── widgets/                # Reusable, smaller widgets
│   ├── task_tile.dart
│   └── loading_indicator.dart
└── utils/                  # Constants, helpers
    └── constants.dart
```

### Do's and Don'ts

**DO:**
- ✅ Extract reusable UI into separate widget classes
- ✅ Always call `dispose()` on controllers (TextEditingController, AnimationController)
- ✅ Use `const` constructors wherever possible — they improve performance
- ✅ Use named parameters for widgets with multiple arguments
- ✅ Run `flutter analyze` regularly to catch issues early
- ✅ Write descriptive names: `_taskListState`, not `_state`
- ✅ Keep `build()` methods short and readable

**DON'T:**
- ❌ Put business logic inside `build()` methods
- ❌ Use `setState()` at the top level for every app — learn a state management solution
- ❌ Nest more than 3–4 levels of widgets inline — extract to named widgets
- ❌ Ignore null safety warnings
- ❌ Use deprecated `withOpacity` — use `Color.withValues(alpha:)` in newer Flutter
- ❌ Forget to handle loading and error states in UI

### Performance tips

```dart
// Use const constructors — prevents unnecessary rebuilds
const Text("Static text")          // ✅ Good
Text("Static text")                 // ❌ Rebuilds every time

// Use ListView.builder for long lists — not ListView with children
ListView.builder(                   // ✅ Lazy loading
  itemCount: 1000,
  itemBuilder: (context, index) => Item(index),
)
// NOT:
ListView(children: items.map((i) => Item(i)).toList())  // ❌ Builds all at once

// Keep widgets small and focused
class UserAvatar extends StatelessWidget { ... }   // ✅ Extract reusable parts

// Use RepaintBoundary for complex, frequently updating widgets
RepaintBoundary(child: MyComplexChart())
```

---

## 10.18 Learning Roadmap

### Phase 1 — Foundation (Weeks 1–2)
- Dart basics: types, functions, classes, null safety
- Async/await and Futures
- Resource: [dart.dev/guides](https://dart.dev/guides)

### Phase 2 — Flutter Core (Weeks 3–5)
- Widget tree mental model
- StatelessWidget vs StatefulWidget
- Essential layout widgets (Row, Column, Stack, Container)
- Common UI widgets (Text, Image, Button, TextField)
- Resource: [flutter.dev/learn](https://flutter.dev/learn)

### Phase 3 — State & Data (Weeks 6–8)
- Provider or Riverpod state management
- Repository pattern for data access
- HTTP API calls with the `http` package
- Local storage with Hive or SharedPreferences
- Resource: [riverpod.dev](https://riverpod.dev)

### Phase 4 — Advanced Flutter (Weeks 9–12)
- Navigation with `go_router`
- Custom animations (AnimatedContainer, Hero, AnimationController)
- Platform-specific code and platform channels
- Performance profiling with Flutter DevTools
- App flavors (dev/staging/prod environments)

### Phase 5 — Production (Weeks 13–16)
- Unit tests, widget tests, integration tests
- CI/CD with Codemagic or GitHub Actions
- App signing and store submission (App Store + Play Console)
- Crash reporting with Sentry
- Analytics with PostHog or Firebase

---

## 10.19 Useful Resources

### Official

| Resource | URL |
|----------|-----|
| Flutter Documentation | [docs.flutter.dev](https://docs.flutter.dev) |
| Flutter Samples | [flutter.github.io/samples](https://flutter.github.io/samples) |
| Dart Language Tour | [dart.dev/language](https://dart.dev/language) |
| DartPad (online playground) | [dartpad.dev](https://dartpad.dev) |
| pub.dev (package registry) | [pub.dev](https://pub.dev) |
| Flutter YouTube Channel | [youtube.com/@flutterdev](https://www.youtube.com/@flutterdev) |

### Community

| Resource | Description |
|----------|-------------|
| Flutter Community on Medium | High-quality articles from practitioners |
| r/FlutterDev (Reddit) | Active community, good Q&A |
| Flutter Discord | Official Discord server |
| Stack Overflow `[flutter]` tag | 150k+ questions answered |
| FlutterFlow | Visual Flutter builder (good for learning how widgets compose) |

### Recommended Packages to Learn

| Package | Purpose | Install |
|---------|---------|---------|
| `go_router` | Navigation | `flutter pub add go_router` |
| `riverpod` | State management | `flutter pub add flutter_riverpod` |
| `dio` | Advanced HTTP client | `flutter pub add dio` |
| `hive_flutter` | Local key-value storage | `flutter pub add hive_flutter` |
| `freezed` | Immutable data classes | `flutter pub add freezed` |
| `cached_network_image` | Image caching | `flutter pub add cached_network_image` |
| `google_fonts` | 1000+ Google Fonts | `flutter pub add google_fonts` |
| `flutter_svg` | SVG image support | `flutter pub add flutter_svg` |
| `intl` | Dates, numbers, i18n | `flutter pub add intl` |
| `shared_preferences` | Simple key-value storage | `flutter pub add shared_preferences` |

---

*This guide was compiled using official Flutter documentation (docs.flutter.dev), community best practices, and real-world production experience.*

*Flutter version referenced: 3.x.x (stable channel) — always verify with the latest at [flutter.dev](https://flutter.dev)*
