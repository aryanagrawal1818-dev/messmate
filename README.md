# MessMate — Campus Meal-Ordering & Pickup Web App

MessMate is a mobile-friendly student meal-ordering and scheduled pickup web application built with **React 19, TypeScript, Tailwind CSS v4, and Firebase (Google Authentication + Cloud Firestore)**.

## Key Features

1. **Google Sign-In & Persistent Cloud Database (`messmate-campus`)**:
   - Students, vendors, and administrators sign in with Google (`signInWithPopup`).
   - Accounts (`users`), partner outlets (`outlets`), menus (`menuItems`), timed pickup slots (`pickupSlots`), and orders (`orders`) are persisted in the `(default)` Cloud Firestore database of the user-owned Firebase Spark project **`messmate-campus`** so all data remains available after logout.
   - Client SDK configuration is stored in `/firebase-web-config.json` (imported by `src/firebase.ts`), keeping it isolated from `/firebase-applet-config.json`.
2. **Role-Based Access Control (Student, Vendor, Administrator)**:
   - **Student Portal**: Browse clearly labelled `[SAMPLE OUTLET]` and `[SAMPLE MEAL]` entries, filter vegetarian or available items, select a 15-minute pickup slot with live capacity limits, complete the demonstration checkout, track live order status (`Order Placed` → `Preparing` → `Ready for Pickup` → `Picked Up`), cancel placed orders, and repeat past orders in one tap.
   - **Vendor Portal**: Vendors manage only their own assigned outlet's menu, sold-out status toggles (`Mark Sold Out` / `Mark In Stock`), pickup-slot capacities, and incoming order fulfillment queue with 4-digit Pickup PIN verification.
   - **Administrator Console**: Platform-wide split financial ledger, partner outlet & commission rate management, user role assignment (`aryanagrawal1818@gmail.com` bootstrapped admin), and one-click sample catalog reset for classroom demonstrations.
3. **Demonstration Payment Flow & Split Financial Accounting**:
   - Simulated checkout supporting **Demo UPI**, **Campus Smart Card**, and **Demo NetBanking** without charging real money.
   - Every order explicitly separates **Net Meal Sales Value** (credited 100% to the partner outlet) from **Platform Commission** (`commissionRate`% MessMate fee).

---

## Firebase Console Setup (`messmate-campus` Spark Project)

Because the client app now points to the external Firebase Spark project **`messmate-campus`** (`projectId: "messmate-campus"`, `(default)` Firestore database), complete these steps in the [Firebase Console](https://console.firebase.google.com/project/messmate-campus):

### 1. Enable Google Sign-In Provider
1. Go to **Build → Authentication → Get started** (if not yet initialized).
2. Open the **Sign-in method** tab, select **Google**, toggle **Enable**, choose a project support email, and click **Save**.

### 2. Add Authorized Domains for Google OAuth Popups
In **Build → Authentication → Settings → Authorized domains**, click **Add domain** and add each hostname where you preview or host the app:
- AI Studio Development Preview domain:
  `ais-dev-7qg3xwjmz3qizsyeza4uwp-954411381984.asia-east1.run.app`
- AI Studio Shared Preview domain:
  `ais-pre-7qg3xwjmz3qizsyeza4uwp-954411381984.asia-east1.run.app`
- Your Vercel production/preview domain (once deployed):
  `<your-project-name>.vercel.app`

*(Note: `localhost` and `messmate-campus.firebaseapp.com` are authorized by default.)*

### 3. Create the `(default)` Firestore Database & Publish Security Rules
1. Go to **Build → Firestore Database** and create the **`(default)`** database (Standard/Native mode, Spark free tier).
2. Open the **Rules** tab in Firestore Database, paste the contents of `/firestore.rules` from this repository, and click **Publish**.

---

## Local Development

```bash
npm install
npm run dev
```

## Deploying to GitHub & Vercel (No `GEMINI_API_KEY` Required)

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. **No environment variables or `GEMINI_API_KEY` are required on Vercel**: MessMate has no AI model features and reads its public Firebase Web SDK configuration directly from `/firebase-web-config.json`.
4. Vercel automatically uses `vercel.json` (`buildCommand: "npm run build"`, `outputDirectory: "dist"`, SPA rewrite `/(.*) -> /index.html`).
5. After Vercel assigns your `.vercel.app` domain, add that domain to **Firebase Console (`messmate-campus`) → Authentication → Settings → Authorized domains**.
