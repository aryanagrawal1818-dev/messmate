# MessMate — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity & Role Integrity (`users/{userId}`)**:
   - A non-admin user can only create their own `users/{userId}` document with `uid == request.auth.uid`, `role == 'student'`, and `assignedOutletId == 'none'`.
   - Non-admin users can never escalate their own `role` to `'vendor'` or `'admin'`.
   - Reading `/users/{userId}` is strictly restricted to the document owner (`request.auth.uid == userId`) or an administrator (`isAdmin()`), preventing PII (`email`) leakage.
2. **Outlet & Vendor Ownership (`outlets/{outletId}`, `menuItems/{itemId}`, `pickupSlots/{slotId}`)**:
   - Only administrators can create or delete partner outlets.
   - Vendors can only update outlets, menu items, and pickup slots where `vendorId == request.auth.uid` and the parent `outlets/{outletId}` exists and belongs to `request.auth.uid`.
   - Every `MenuItem` and `PickupSlot` creation must verify `exists(/databases/$(database)/documents/outlets/$(incoming().outletId))`.
3. **Pickup Slot Capacity Guard (`pickupSlots/{slotId}`)**:
   - `bookedCount` must always satisfy `0 <= bookedCount <= maxCapacity`.
   - Students booking or cancelling an order can only increment or decrement `bookedCount` by 1 (`incoming().bookedCount == existing().bookedCount + 1` or `existing().bookedCount - 1`) alongside `updatedAt == request.time`.
4. **Order Integrity, Financial Separation & Terminal State Locking (`orders/{orderId}`)**:
   - An order can only be created by a verified student where `studentId == request.auth.uid`, `status == 'placed'`, `paymentStatus == 'paid_demo'`, and both `outlets/{outletId}` and `pickupSlots/{slotId}` exist.
   - `mealSalesValue`, `platformCommission`, and `totalPayable` are validated separately (`mealSalesValue >= 0`, `platformCommission >= 0`, `totalPayable == mealSalesValue + platformCommission`) and are strictly immutable after creation.
   - Once an order reaches a terminal state (`status == 'picked_up'` or `status == 'cancelled'`), all further non-admin updates are blocked.
   - `allow list` on `/orders/{orderId}` strictly enforces `resource.data.studentId == request.auth.uid || resource.data.vendorId == request.auth.uid || isBootstrappedAdmin()` with zero `get()` or `exists()` calls.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Self-Privilege Escalation on Registration)**:
   - Path: `/users/attacker_1`
   - Operation: `create`
   - Payload: `{ uid: "attacker_1", displayName: "Attacker", email: "attacker@edu.in", role: "admin", assignedOutletId: "none", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED` (Non-admin cannot self-assign `role: 'admin'`).
2. **Payload 2 (Shadow Field Injection on User Update)**:
   - Path: `/users/student_1`
   - Operation: `update`
   - Payload: `{ displayName: "New Name", isVerifiedVendor: true, updatedAt: SERVER_TIME }`
   - Expected: `PERMISSION_DENIED` (`hasOnly` blocks ghost key `isVerifiedVendor`).
3. **Payload 3 (Cross-User PII Scraping)**:
   - Path: `/users/student_2`
   - Operation: `get` (as `student_1`)
   - Expected: `PERMISSION_DENIED` (PII isolation restricts `get` to owner or admin).
4. **Payload 4 (Unverified Email Write Attempt)**:
   - Path: `/orders/order_unverified`
   - Operation: `create` (with `email_verified: false`)
   - Expected: `PERMISSION_DENIED` (`isVerified()` blocks unverified tokens).
5. **Payload 5 (Orphaned Menu Item Creation)**:
   - Path: `/menuItems/item_orphan`
   - Operation: `create` (referencing non-existent `outletId: "ghost_outlet"`)
   - Expected: `PERMISSION_DENIED` (`exists()` check on parent outlet fails).
6. **Payload 6 (Cross-Vendor Menu Tampering)**:
   - Path: `/menuItems/item_outlet_1`
   - Operation: `update` (by `vendor_2` who does not own `outlet_1`)
   - Expected: `PERMISSION_DENIED` (`existing().vendorId == request.auth.uid` fails).
7. **Payload 7 (Pickup Slot Capacity Overflow)**:
   - Path: `/pickupSlots/slot_1`
   - Operation: `update` (`bookedCount` jumped by +5 or exceeding `maxCapacity`)
   - Expected: `PERMISSION_DENIED` (Step-by-1 and `<= maxCapacity` guard blocks write).
8. **Payload 8 (Order Identity Spoofing)**:
   - Path: `/orders/order_spoof`
   - Operation: `create` (by `attacker_1` with `studentId: "victim_student"`)
   - Expected: `PERMISSION_DENIED` (`incoming().studentId == request.auth.uid` fails).
9. **Payload 9 (Financial Commission Tampering on Update)**:
   - Path: `/orders/order_1`
   - Operation: `update` (student or vendor attempting to modify `mealSalesValue` or `platformCommission`)
   - Expected: `PERMISSION_DENIED` (Action-based `affectedKeys().hasOnly(...)` blocks financial field changes).
10. **Payload 10 (Terminal State Re-Opening)**:
    - Path: `/orders/order_completed` (where `existing().status == 'picked_up'`)
    - Operation: `update` (vendor attempting to revert `status` to `'preparing'`)
    - Expected: `PERMISSION_DENIED` (Terminal state lock prevents updates once `'picked_up'` or `'cancelled'`).
11. **Payload 11 (Student Skipping Order State to Picked Up)**:
    - Path: `/orders/order_1` (where `existing().status == 'placed'`)
    - Operation: `update` (student attempting to set `status: 'ready_for_pickup'`)
    - Expected: `PERMISSION_DENIED` (Students can only transition `'placed'` -> `'cancelled'`).
12. **Payload 12 (Denial-of-Wallet Oversized String / Unbounded Array)**:
    - Path: `/orders/order_huge`
    - Operation: `create` (with 25 elements in `itemsDetail` or a 5,000-char `notes` string)
    - Expected: `PERMISSION_DENIED` (`itemsDetail.size() <= 10` and `notes.size() <= 250` block payload).
