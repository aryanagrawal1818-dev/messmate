/**
 * Firestore Security Rules Test Suite (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Privilege Escalation on Registration',
    collection: 'users/attacker_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'attacker@edu.in', email_verified: true },
    payload: {
      uid: 'attacker_1',
      displayName: 'Attacker',
      email: 'attacker@edu.in',
      role: 'admin',
      assignedOutletId: 'none',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on User Update',
    collection: 'users/student_1',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@edu.in', email_verified: true },
    payload: {
      displayName: 'Student One',
      isVerifiedVendor: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User PII Scraping',
    collection: 'users/student_2',
    operation: 'get',
    auth: { uid: 'student_1', email: 'student1@edu.in', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Email Write Attempt',
    collection: 'orders/order_unverified',
    operation: 'create',
    auth: { uid: 'student_1', email: 'student1@edu.in', email_verified: false },
    payload: { studentId: 'student_1', status: 'placed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Orphaned Menu Item Creation',
    collection: 'menuItems/item_orphan',
    operation: 'create',
    auth: { uid: 'vendor_1', email: 'vendor1@edu.in', email_verified: true },
    payload: { outletId: 'non_existent_outlet', vendorId: 'vendor_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Cross-Vendor Menu Tampering',
    collection: 'menuItems/item_outlet_1',
    operation: 'update',
    auth: { uid: 'vendor_2', email: 'vendor2@edu.in', email_verified: true },
    payload: { isSoldOut: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Pickup Slot Capacity Overflow',
    collection: 'pickupSlots/slot_1',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@edu.in', email_verified: true },
    payload: { bookedCount: 999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Order Identity Spoofing',
    collection: 'orders/order_spoof',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'attacker@edu.in', email_verified: true },
    payload: { studentId: 'victim_student', status: 'placed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Financial Commission Tampering on Update',
    collection: 'orders/order_1',
    operation: 'update',
    auth: { uid: 'vendor_1', email: 'vendor1@edu.in', email_verified: true },
    payload: { mealSalesValue: 5000, platformCommission: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Re-Opening',
    collection: 'orders/order_completed',
    operation: 'update',
    auth: { uid: 'vendor_1', email: 'vendor1@edu.in', email_verified: true },
    payload: { status: 'preparing' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Student Skipping Order State to Ready For Pickup',
    collection: 'orders/order_1',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@edu.in', email_verified: true },
    payload: { status: 'ready_for_pickup' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Denial-of-Wallet Oversized Array Payload',
    collection: 'orders/order_huge',
    operation: 'create',
    auth: { uid: 'student_1', email: 'student1@edu.in', email_verified: true },
    payload: { itemsDetail: new Array(25).fill('item|name|1|100') },
    expectedResult: 'PERMISSION_DENIED',
  },
];
