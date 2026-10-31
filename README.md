# MessMate — Campus Meal-Ordering & Pickup Web App

**Live Production App:** [https://messmate-flame.vercel.app](https://messmate-flame.vercel.app)

MessMate is a mobile-friendly student meal-ordering and scheduled pickup web application built with **React 19, TypeScript, Tailwind CSS v4, and Firebase (Google Authentication + Cloud Firestore)**.

## Key Features & Role-Based UI Access

1. **Google Sign-In & Persistent Cloud Database (`messmate-campus`)**:
   - Students, vendors, and administrators sign in with Google (`signInWithPopup`).
   - Accounts (`users`), partner outlets (`outlets`), menus (`menuItems`), timed pickup slots (`pickupSlots`), and orders (`orders`) are persisted in the `(default)` Cloud Firestore database of the user-owned Firebase Spark project **`messmate-campus`** so all data remains available after logout.
   - Client SDK configuration is stored in `/firebase-web-config.json` (imported by `src/firebase.ts`), keeping it isolated from `/firebase-applet-config.json`.
2. **Strict Role-Derived Portal Access (Student, Vendor, Administrator)**:
   - Allowed workspace tabs and rendered portal views derive directly from the authenticated Firestore `users/{uid}` profile role:
     - **Student Accounts (`role: "student"`)**: Default role on registration for non-admin accounts. Displays **only** the **Student Portal** (browse `[SAMPLE OUTLET]` and `[SAMPLE MEAL]` entries, filter vegetarian or available items, select a 15-minute pickup slot with live capacity limits, complete the demonstration checkout, track live order status, cancel placed orders, and repeat past orders in one tap). Cannot view or render Vendor or Administrator portals.
     - **Vendor Accounts (`role: "vendor"`)**: Displays **only** the **Vendor Portal** scoped to the vendor's assigned/owned outlet (toggle `Mark Sold Out` / `Mark In Stock`, adjust pickup-slot capacities, and advance kitchen order statuses with 4-digit Pickup PIN verification). Cannot view or render Student or Administrator portals.
     - **Administrator Accounts (`role: "admin"`, including bootstrap admin `aryanagrawal1818@gmail.com`)**: Displays all three portal tabs (**Student Portal**, **Vendor Portal**, and **Administrator Console**) in the Classroom Demonstration Role Switcher so the administrator can demonstrate the complete end-to-end platform, audit the split financial ledger, manage partner outlets and commission rates, and assign user roles.
3. **Demonstration Payment Flow & Split Financial Accounting**:
   - Simulated checkout supporting **Demo UPI**, **Campus Smart Card**, and **Demo NetBanking** without charging real money.
   - Every order explicitly separates **Net Meal Sales Value** (credited 100% to the partner outlet) from **Platform Commission** (`commissionRate`% MessMate fee).

---

## Firebase Console Setup (`messmate-campus` Spark Project)

The client app connects to the external Firebase Spark project **`messmate-campus`** (`projectId: "messmate-campus"`, `(default)` Firestore database). In the [Firebase Console](https://console.firebase.google.com/project/messmate-campus):

### 1. Google Sign-In Provider
- Enabled under **Build → Authentication → Sign-in method → Google**.

### 2. Authorized Domains for Google OAuth Popups
Under **Build → Authentication → Settings → Authorized domains**, ensure the following domains are listed:
- Production Vercel domain:
  `messmate-flame.vercel.app`
- AI Studio Development Preview domain:
  `ais-dev-7qg3xwjmz3qizsyeza4uwp-954411381984.asia-east1.run.app`
- AI Studio Shared Preview domain:
  `ais-pre-7qg3xwjmz3qizsyeza4uwp-954411381984.asia-east1.run.app`

*(Note: `localhost` and `messmate-campus.firebaseapp.com` are authorized by default.)*

### 3. `(default)` Firestore Database & Security Rules
- The `(default)` Firestore database uses the security rules in `/firestore.rules` (published via **Firestore Database → Rules**).

---

## Local Development

```bash
npm install
npm run dev
```

## Deploying to GitHub & Vercel (No `GEMINI_API_KEY` Required)

1. Push or sync this repository to GitHub.
2. Import or redeploy the repository in [Vercel](https://vercel.com) (`https://messmate-flame.vercel.app`).
3. **No environment variables or `GEMINI_API_KEY` are required on Vercel**: MessMate has no AI model features and reads its public Firebase Web SDK configuration directly from `/firebase-web-config.json`.
4. Vercel automatically uses `vercel.json` (`buildCommand: "npm run build"`, `outputDirectory: "dist"`, SPA rewrite `/(.*) -> /index.html`).
