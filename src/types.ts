import { Timestamp } from 'firebase/firestore';

export type UserRole = 'student' | 'vendor' | 'admin';

export type OrderStatus =
  | 'placed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'cancelled';

export type PaymentMethod = 'demo_upi' | 'demo_campus_card' | 'demo_netbanking';
export type PaymentStatus = 'paid_demo' | 'refunded_demo';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  assignedOutletId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Outlet {
  id: string;
  name: string;
  campusZone: string;
  cuisine: string;
  description: string;
  vendorId: string;
  vendorName: string;
  commissionRate: number;
  isActive: boolean;
  isSample: boolean;
  prepTimeMinutes: number;
  imageKey: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MenuItem {
  id: string;
  outletId: string;
  outletName: string;
  vendorId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  isVeg: boolean;
  isSoldOut: boolean;
  isPublished: boolean;
  isSample: boolean;
  calories: number;
  prepMinutes: number;
  imageKey: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PickupSlot {
  id: string;
  outletId: string;
  vendorId: string;
  label: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Order {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  outletId: string;
  outletName: string;
  vendorId: string;
  slotId: string;
  slotLabel: string;
  itemsSummary: string;
  itemsDetail: string[];
  totalQuantity: number;
  mealSalesValue: number;
  commissionRate: number;
  platformCommission: number;
  totalPayable: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRef: string;
  status: OrderStatus;
  pickupCode: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface ParsedOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// Validation & Sanitization Constraints (Mirrors firebase-blueprint.json & firestore.rules)
export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'id_fallback';
}

export function clampString(raw: string, minLen: number, maxLen: number, fallback = 'N/A'): string {
  const trimmed = raw.trim();
  if (trimmed.length < minLen) {
    return fallback.slice(0, maxLen);
  }
  return trimmed.slice(0, maxLen);
}

export function encodeOrderItemDetail(
  itemId: string,
  name: string,
  quantity: number,
  unitPrice: number
): string {
  const safeName = name.replace(/\|/g, '-').slice(0, 90);
  return `${sanitizeId(itemId)}|${safeName}|${Math.max(1, Math.round(quantity))}|${Math.round(unitPrice * 100) / 100}`.slice(0, 200);
}

export function decodeOrderItemDetail(encoded: string): ParsedOrderItem {
  const parts = encoded.split('|');
  return {
    itemId: parts[0] || '',
    name: parts[1] || 'Campus Meal',
    quantity: Number(parts[2]) || 1,
    unitPrice: Number(parts[3]) || 0,
  };
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2).replace(/\.00$/, '')}`;
}
