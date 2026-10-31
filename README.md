# MessMate — Campus Meal-Ordering & Pickup Web App

MessMate is a mobile-friendly student meal-ordering and scheduled pickup web application built with **React 19, TypeScript, Tailwind CSS v4, and Firebase (Google Authentication + Cloud Firestore)**.

## Key Features

1. **Google Sign-In & Persistent Cloud Database**:
   - Students, vendors, and administrators sign in with Google (`signInWithPopup`).
   - Accounts (`users`), partner outlets (`outlets`), menus (`menuItems`), timed pickup slots (`pickupSlots`), and orders (`orders`) are persisted in Cloud Firestore so all data remains available after logout.
2. **Role-Based Access Control (Student, Vendor, Administrator)**:
   - **Student Portal**: Browse clearly labelled `[SAMPLE OUTLET]` and `[SAMPLE MEAL]` entries, filter vegetarian or available items, select a 15-minute pickup slot with live capacity limits, complete the demonstration checkout, track live order status (`Order Placed` → `Preparing` → `Ready for Pickup` → `Picked Up`), cancel placed orders, and repeat past orders in one tap.
   - **Vendor Portal**: Vendors manage only their own assigned outlet's menu, sold-out status toggles (`Mark Sold Out` / `Mark In Stock`), pickup-slot capacities, and incoming order fulfillment queue with 4-digit Pickup PIN verification.
   - **Administrator Console**: Platform-wide split financial ledger, partner outlet & commission rate management, user role assignment, and one-click sample catalog reset for classroom demonstrations.
3. **Demonstration Payment Flow & Split Financial Accounting**:
   - Simulated checkout supporting **Demo UPI**, **Campus Smart Card**, and **Demo NetBanking** without charging real money.
   - Every order explicitly separates **Net Meal Sales Value** (credited 100% to the partner outlet) from **Platform Commission** (`commissionRate`% MessMate fee).

## Local Development

```bash
npm install
npm run dev
```

## Deploying to GitHub & Vercel

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Vercel automatically detects `vite` and `vercel.json` (`npm run build`, output directory `dist`).
4. Add your Vercel deployment domain to **Firebase Console → Authentication → Settings → Authorized domains** so Google Sign-In popups are authorized in production.
