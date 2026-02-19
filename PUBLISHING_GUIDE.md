# Publishing Guide: Ledger App to iOS App Store and Google Play Store

This guide walks you through the complete process of publishing your Ledger accounting app to both the Apple App Store and Google Play Store using **Expo Application Services (EAS)**.

---

## Prerequisites

Before you begin, make sure you have the following:

| Requirement | iOS (App Store) | Android (Play Store) |
|---|---|---|
| **Developer Account** | Apple Developer Program ($99/year) | Google Play Console ($25 one-time) |
| **Computer** | macOS required for iOS builds | Any OS |
| **EAS CLI** | Required | Required |
| **App Icon** | Already included (1024x1024) | Already included (adaptive icon) |

---

## Step 1: Install EAS CLI

Open your terminal and install the Expo Application Services command-line tool:

```bash
npm install -g eas-cli
eas login
```

You will need a free Expo account. Create one at [expo.dev](https://expo.dev) if you do not already have one.

---

## Step 2: Configure EAS Build

Run the following command in your project directory to create an `eas.json` configuration file:

```bash
eas build:configure
```

This generates a file like the following. You can customize it as needed:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

---

## Step 3: Build for Production

### iOS Build

```bash
eas build --platform ios --profile production
```

During the first build, EAS will prompt you to log in with your Apple Developer account and will handle provisioning profiles and certificates automatically. The build runs in the cloud, so you do not need a Mac for the build itself (though you need one for certain Apple Developer portal tasks).

### Android Build

```bash
eas build --platform android --profile production
```

EAS will generate a signing keystore automatically on the first build. Keep this keystore safe, as you will need it for all future updates.

### Build Both Platforms

```bash
eas build --platform all --profile production
```

---

## Step 4: Create Store Listings

### Apple App Store (App Store Connect)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) and sign in with your Apple Developer account.
2. Click the "+" button and select "New App."
3. Fill in the required information:

| Field | Recommended Value |
|---|---|
| **App Name** | Ledger - Smart Bookkeeping |
| **Primary Language** | English (U.S.) or French |
| **Bundle ID** | Select the one matching your `app.config.ts` |
| **SKU** | ledger-bookkeeping-2026 |

4. Prepare the following assets:

| Asset | Specification |
|---|---|
| **Screenshots** | 6.7" (iPhone 15 Pro Max): 1290 x 2796 px |
| **Screenshots** | 6.5" (iPhone 14 Plus): 1284 x 2778 px |
| **App Icon** | 1024 x 1024 px (already in your project) |
| **Description** | See suggested text below |
| **Keywords** | accounting, bookkeeping, ledger, finance, CFA, expense tracker |
| **Category** | Finance |
| **Subcategory** | Business |

### Google Play Store (Play Console)

1. Go to [Google Play Console](https://play.google.com/console) and sign in.
2. Click "Create app" and fill in the details.
3. Prepare the following:

| Asset | Specification |
|---|---|
| **Feature Graphic** | 1024 x 500 px |
| **Screenshots** | Minimum 2, recommended 8 (phone + tablet) |
| **App Icon** | 512 x 512 px (auto-generated from your icon) |
| **Short Description** | Max 80 characters |
| **Full Description** | Max 4000 characters |
| **Category** | Finance |
| **Content Rating** | Complete the questionnaire (IARC) |

---

## Step 5: Submit to Stores

### Submit to App Store

```bash
eas submit --platform ios --profile production
```

EAS will prompt you for your App Store Connect credentials and automatically upload the build. After submission, go to App Store Connect to:

1. Select the uploaded build.
2. Complete the "App Review Information" section.
3. Set pricing (Free or Paid).
4. Submit for review.

Apple review typically takes **1-3 business days**.

### Submit to Google Play

```bash
eas submit --platform android --profile production
```

You will need to provide your Google Play service account JSON key. Follow the [Expo documentation on Google Service Account](https://docs.expo.dev/submit/android/) to set this up.

After submission:

1. Go to Play Console and complete the store listing.
2. Set up pricing and distribution.
3. Complete the content rating questionnaire.
4. Submit for review.

Google review typically takes **1-7 business days** for new apps.

---

## Step 6: Suggested Store Description

### English

> **Ledger - Smart Bookkeeping**
>
> Simple and powerful accounting for small businesses and entrepreneurs. Track your income and expenses, manage categories, and view detailed reports — all from your phone.
>
> **Key Features:**
> - Record income and expenses with one tap
> - Organize transactions by category (Food, Transport, Salary, Business, and more)
> - View daily, weekly, monthly, and yearly reports
> - Income vs Expense comparison charts
> - Category breakdown analysis
> - Support for CFA Franc, Naira, Cedi, Dollar, Euro, and more
> - French and English language support
> - Export your data as CSV
> - Works offline — your data stays on your device
> - Clean, modern interface designed for one-handed use
>
> Perfect for shop owners, market vendors, freelancers, and anyone who needs to keep track of their money. No internet required.

### French

> **Ledger - Comptabilité Intelligente**
>
> Une comptabilité simple et puissante pour les petites entreprises et les entrepreneurs. Suivez vos revenus et dépenses, gérez vos catégories et consultez des rapports détaillés — le tout depuis votre téléphone.
>
> **Fonctionnalités principales :**
> - Enregistrez revenus et dépenses en un seul clic
> - Organisez les transactions par catégorie
> - Consultez les rapports quotidiens, hebdomadaires, mensuels et annuels
> - Graphiques comparatifs revenus vs dépenses
> - Analyse par catégorie
> - Support du Franc CFA, Naira, Cedi, Dollar, Euro et plus
> - Interface en français et en anglais
> - Exportez vos données en CSV
> - Fonctionne hors ligne
> - Interface moderne et intuitive

---

## Step 7: Post-Launch Updates

To push updates after your app is live:

```bash
# For JavaScript-only changes (instant update, no review needed):
eas update --branch production --message "Bug fixes and improvements"

# For native changes (requires new build + store review):
eas build --platform all --profile production
eas submit --platform all --profile production
```

**EAS Update** (over-the-air updates) lets you push JavaScript changes instantly without going through store review. This is ideal for bug fixes, content updates, and minor feature additions.

---

## Cost Summary

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Program | $99 | Annual |
| Google Play Console | $25 | One-time |
| Expo (Free tier) | $0 | Monthly |
| Expo (Production tier) | $99 | Monthly (optional, for more builds) |

The Expo free tier includes a limited number of builds per month, which is sufficient for getting started. You can upgrade later as your app grows.

---

## Helpful Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policy Center](https://play.google.com/about/developer-content-policy/)
- [Expo EAS Update (OTA Updates)](https://docs.expo.dev/eas-update/introduction/)
