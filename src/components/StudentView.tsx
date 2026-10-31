import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Utensils,
  XCircle,
} from 'lucide-react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CartItem,
  clampString,
  decodeOrderItemDetail,
  encodeOrderItemDetail,
  formatCurrency,
  MenuItem,
  Order,
  Outlet,
  PaymentMethod,
  PickupSlot,
  UserProfile,
} from '../types';
import { MealArtwork } from './MealArtwork';
import { DemoPaymentModal } from './DemoPaymentModal';

interface StudentViewProps {
  userProfile: UserProfile;
  outlets: Outlet[];
  menuItems: MenuItem[];
  pickupSlots: PickupSlot[];
  studentOrders: Order[];
  isSeeding: boolean;
  onSeedSampleData: () => Promise<void>;
}

const ORDER_STEPS = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup' },
  { key: 'picked_up', label: 'Picked Up' },
] as const;

export const StudentView: React.FC<StudentViewProps> = ({
  userProfile,
  outlets,
  menuItems,
  pickupSlots,
  studentOrders,
  isSeeding,
  onSeedSampleData,
}) => {
  const activeOutlets = useMemo(
    () => outlets.filter((o) => o.isActive),
    [outlets]
  );

  const [selectedOutletId, setSelectedOutletId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'menu' | 'orders'>('menu');

  // Cart state (locked to a single outlet per pickup order)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [bannerFeedback, setBannerFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const cartOutletId = cart.length > 0 ? cart[0].menuItem.outletId : null;
  const cartOutlet = useMemo(
    () => outlets.find((o) => o.id === cartOutletId) || null,
    [outlets, cartOutletId]
  );

  const outletSlots = useMemo(() => {
    const targetOutletId =
      cartOutletId || (selectedOutletId !== 'all' ? selectedOutletId : activeOutlets[0]?.id);
    if (!targetOutletId) return [];
    return pickupSlots
      .filter((s) => s.outletId === targetOutletId && s.isActive)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [pickupSlots, cartOutletId, selectedOutletId, activeOutlets]);

  const selectedSlot = useMemo(
    () => outletSlots.find((s) => s.id === selectedSlotId) || null,
    [outletSlots, selectedSlotId]
  );

  const filteredMenuItems = useMemo(() => {
    return menuItems
      .filter((item) => item.isPublished)
      .filter((item) =>
        selectedOutletId === 'all' ? true : item.outletId === selectedOutletId
      )
      .filter((item) => (vegOnly ? item.isVeg : true))
      .filter((item) => (hideSoldOut ? !item.isSoldOut : true))
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.outletName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      });
  }, [menuItems, selectedOutletId, vegOnly, hideSoldOut, searchQuery]);

  const totalCartUnits = useMemo(
    () => cart.reduce((acc, c) => acc + c.quantity, 0),
    [cart]
  );

  const mealSalesValue = useMemo(
    () => Math.round(cart.reduce((acc, c) => acc + c.menuItem.price * c.quantity, 0)),
    [cart]
  );

  const commissionRate = cartOutlet ? cartOutlet.commissionRate : 8;
  const platformCommission = Math.round((mealSalesValue * commissionRate) / 100);
  const totalPayable = mealSalesValue + platformCommission;

  const addToCart = (item: MenuItem) => {
    if (item.isSoldOut) {
      setBannerFeedback({
        type: 'warning',
        message: `"${item.name}" is currently marked Sold Out by the vendor.`,
      });
      return;
    }

    setCart((prev) => {
      if (prev.length > 0 && prev[0].menuItem.outletId !== item.outletId) {
        // Switching outlets resets cart to the new outlet's item
        setBannerFeedback({
          type: 'warning',
          message: `Switched cart to ${item.outletName} (each pickup order belongs to one outlet).`,
        });
        setSelectedSlotId('');
        return [{ menuItem: item, quantity: 1 }];
      }

      const existingIndex = prev.findIndex((c) => c.menuItem.id === item.id);
      if (existingIndex > -1) {
        const currentQty = prev[existingIndex].quantity;
        if (currentQty >= 10) return prev;
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], quantity: currentQty + 1 };
        return updated;
      }

      if (prev.length >= 10) {
        setBannerFeedback({
          type: 'warning',
          message: 'Maximum 10 distinct meal items per pickup order.',
        });
        return prev;
      }

      return [...prev, { menuItem: item, quantity: 1 }];
    });

    // Auto-select first available slot for this outlet if none chosen
    const availableSlot = pickupSlots.find(
      (s) => s.outletId === item.outletId && s.isActive && s.bookedCount < s.maxCapacity
    );
    if (availableSlot && (!selectedSlotId || cartOutletId !== item.outletId)) {
      setSelectedSlotId(availableSlot.id);
    }
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const handleRepeatOrder = (pastOrder: Order) => {
    const targetOutlet = outlets.find((o) => o.id === pastOrder.outletId && o.isActive);
    if (!targetOutlet) {
      setBannerFeedback({
        type: 'error',
        message: `Outlet "${pastOrder.outletName}" is currently offline.`,
      });
      return;
    }

    const parsedItems = pastOrder.itemsDetail.map(decodeOrderItemDetail);
    const nextCart: CartItem[] = [];
    const soldOutNames: string[] = [];

    for (const parsed of parsedItems) {
      const liveItem = menuItems.find(
        (m) => m.id === parsed.itemId && m.outletId === pastOrder.outletId && m.isPublished
      );
      if (!liveItem || liveItem.isSoldOut) {
        soldOutNames.push(parsed.name);
      } else {
        nextCart.push({
          menuItem: liveItem,
          quantity: Math.min(10, Math.max(1, parsed.quantity)),
        });
      }
    }

    if (nextCart.length === 0) {
      setBannerFeedback({
        type: 'error',
        message: `Cannot repeat Order ${pastOrder.orderNumber}: all items (${soldOutNames.join(', ')}) are currently Sold Out.`,
      });
      return;
    }

    setCart(nextCart);
    setSelectedOutletId(pastOrder.outletId);

    // Pick same slot if available, else first open slot
    const preferredSlot = pickupSlots.find(
      (s) =>
        s.id === pastOrder.slotId &&
        s.isActive &&
        s.bookedCount < s.maxCapacity
    );
    const fallbackSlot = pickupSlots.find(
      (s) =>
        s.outletId === pastOrder.outletId &&
        s.isActive &&
        s.bookedCount < s.maxCapacity
    );
    setSelectedSlotId(preferredSlot?.id || fallbackSlot?.id || '');
    setActiveSubTab('menu');

    if (soldOutNames.length > 0) {
      setBannerFeedback({
        type: 'warning',
        message: `Loaded available items from ${pastOrder.orderNumber}. Skipped Sold-Out item(s): ${soldOutNames.join(', ')}.`,
      });
    } else {
      setBannerFeedback({
        type: 'success',
        message: `Repeated Order ${pastOrder.orderNumber} into your cart! Select your pickup slot and confirm checkout.`,
      });
    }
  };

  const handleConfirmDemoOrder = async (
    paymentMethod: PaymentMethod,
    paymentRef: string
  ) => {
    if (!cartOutlet || !selectedSlot || cart.length === 0) return;

    if (selectedSlot.bookedCount >= selectedSlot.maxCapacity) {
      setBannerFeedback({
        type: 'error',
        message: `Pickup slot ${selectedSlot.label} just reached full capacity (${selectedSlot.maxCapacity}/${selectedSlot.maxCapacity}). Please choose another slot.`,
      });
      setIsPaymentModalOpen(false);
      return;
    }

    setIsSubmittingOrder(true);
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const orderNumber = `MM-${Math.floor(1000 + Math.random() * 9000)}`;
    const pickupCode = `${Math.floor(1000 + Math.random() * 9000)}`;

    const itemsSummary = clampString(
      cart.map((c) => `${c.quantity}x ${c.menuItem.name.replace('[SAMPLE MEAL] ', '')}`).join(', '),
      1,
      600,
      'Campus Meal Order'
    );

    const itemsDetail = cart
      .slice(0, 10)
      .map((c) =>
        encodeOrderItemDetail(
          c.menuItem.id,
          c.menuItem.name,
          c.quantity,
          c.menuItem.price
        )
      );

    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', orderId);
      const slotRef = doc(db, 'pickupSlots', selectedSlot.id);

      batch.set(orderRef, {
        id: orderId,
        orderNumber,
        studentId: userProfile.uid,
        studentName: clampString(userProfile.displayName, 1, 100, 'Campus Student'),
        studentEmail: clampString(userProfile.email, 3, 150, 'student@campus.edu'),
        outletId: cartOutlet.id,
        outletName: clampString(cartOutlet.name, 1, 120, 'Partner Outlet'),
        vendorId: cartOutlet.vendorId,
        slotId: selectedSlot.id,
        slotLabel: clampString(selectedSlot.label, 1, 80, 'Pickup Window'),
        itemsSummary,
        itemsDetail,
        totalQuantity: Math.min(50, Math.max(1, totalCartUnits)),
        mealSalesValue,
        commissionRate,
        platformCommission,
        totalPayable,
        paymentMethod,
        paymentStatus: 'paid_demo',
        paymentRef: clampString(paymentRef, 1, 80, 'DEMO-TXN-1001'),
        status: 'placed',
        pickupCode,
        notes: clampString(orderNotes, 0, 250, ''),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(slotRef, {
        bookedCount: selectedSlot.bookedCount + 1,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      setCart([]);
      setOrderNotes('');
      setIsPaymentModalOpen(false);
      setActiveSubTab('orders');
      setBannerFeedback({
        type: 'success',
        message: `Order ${orderNumber} placed! Show Pickup PIN ${pickupCode} at ${cartOutlet.name} during ${selectedSlot.label}.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    if (order.status !== 'placed') return;

    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', order.id);
      batch.update(orderRef, {
        status: 'cancelled',
        paymentStatus: 'refunded_demo',
        updatedAt: serverTimestamp(),
      });

      const matchingSlot = pickupSlots.find((s) => s.id === order.slotId);
      if (matchingSlot && matchingSlot.bookedCount > 0) {
        const slotRef = doc(db, 'pickupSlots', matchingSlot.id);
        batch.update(slotRef, {
          bookedCount: matchingSlot.bookedCount - 1,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setBannerFeedback({
        type: 'warning',
        message: `Order ${order.orderNumber} cancelled and demo payment refunded. Slot capacity restored.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const activeOrders = useMemo(
    () =>
      studentOrders.filter(
        (o) => o.status !== 'picked_up' && o.status !== 'cancelled'
      ),
    [studentOrders]
  );

  return (
    <div className="space-y-8 pb-24">
      {/* Feedback Notification Bar */}
      {bannerFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-4 text-sm ${
            bannerFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : bannerFeedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{bannerFeedback.message}</span>
          <button
            type="button"
            onClick={() => setBannerFeedback(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Student Mode Navigation & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <p className="text-xs text-stone-500">
            <span>Student Portal</span>
            <span aria-hidden="true"> · </span>
            <span>Signed in as {userProfile.displayName}</span>
          </p>
          <h2 className="text-2xl font-bold text-stone-900 mt-0.5">
            Campus Partner Outlets &amp; Pickup Slots
          </h2>
        </div>

        {/* Interactive Mode Switcher (Menu vs My Orders & History) */}
        <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('menu')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
              activeSubTab === 'menu'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Browse Meals ({filteredMenuItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('orders')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
              activeSubTab === 'orders'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              My Orders &amp; History ({studentOrders.length})
              {activeOrders.length > 0 ? ` · ${activeOrders.length} Active` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* Empty Catalog Prompt (First Run Classroom Demo Seeder) */}
      {outlets.length === 0 && (
        <div className="p-8 rounded-2xl bg-white border border-stone-200 text-center space-y-4">
          <Store className="w-10 h-10 text-amber-700 mx-auto" />
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-stone-900">
              Load Classroom Demonstration Outlets &amp; Meals
            </h3>
            <p className="text-sm text-stone-600">
              Populate the database with 4 clearly labelled sample campus outlets, 12 sample meals (including sold-out items), and 12 timed pickup slots.
            </p>
          </div>
          <button
            type="button"
            onClick={onSeedSampleData}
            disabled={isSeeding}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isSeeding ? 'Loading Sample Data...' : 'Load Sample Outlets & Meals'}
            </span>
          </button>
        </div>
      )}

      {activeSubTab === 'menu' && outlets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 8 COLUMNS: Partner Outlets + Filter Bar + Meal Grid */}
          <div className="lg:col-span-8 space-y-6">
            {/* Partner Outlet Selector Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-700">
                  1. Choose Partner Campus Outlet
                </h3>
                {selectedOutletId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedOutletId('all')}
                    className="text-xs font-semibold text-amber-800 hover:underline"
                  >
                    Show All Outlets
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeOutlets.map((outlet) => {
                  const isSelected = selectedOutletId === outlet.id;
                  const slotsForOutlet = pickupSlots.filter(
                    (s) => s.outletId === outlet.id && s.isActive
                  );
                  const openSlotsCount = slotsForOutlet.filter(
                    (s) => s.bookedCount < s.maxCapacity
                  ).length;

                  return (
                    <button
                      key={outlet.id}
                      type="button"
                      onClick={() =>
                        setSelectedOutletId(isSelected ? 'all' : outlet.id)
                      }
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                          : 'bg-white text-stone-900 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          isSelected ? 'text-amber-300' : 'text-stone-500'
                        }`}
                      >
                        <span>{outlet.cuisine}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">{outlet.prepTimeMinutes} min prep</span>
                      </div>
                      <div className="text-base font-bold mt-1">{outlet.name}</div>
                      <div
                        className={`text-xs mt-1 ${
                          isSelected ? 'text-stone-300' : 'text-stone-500'
                        }`}
                      >
                        <span>{outlet.campusZone}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">
                          {openSlotsCount}/{slotsForOutlet.length} slots open
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">
                          {outlet.commissionRate}% platform fee
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search & Dietary / Sold-Out Filters */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sample meals, bowls, wraps, dosas..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVegOnly((v) => !v)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    vegOnly
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {vegOnly ? '✓ Pure Veg Only' : 'Pure Veg Only'}
                </button>
                <button
                  type="button"
                  onClick={() => setHideSoldOut((h) => !h)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    hideSoldOut
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {hideSoldOut ? '✓ Hiding Sold Out' : 'Hide Sold Out'}
                </button>
              </div>
            </div>

            {/* Meal Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {filteredMenuItems.map((item) => {
                const inCart = cart.find((c) => c.menuItem.id === item.id);
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col justify-between transition-transform ${
                      item.isSoldOut ? 'opacity-75' : 'hover:-translate-y-0.5'
                    }`}
                  >
                    <div>
                      <MealArtwork
                        imageKey={item.imageKey}
                        title={item.name}
                        className="h-44 w-full border-b border-stone-100"
                      />
                      <div className="p-5 space-y-2">
                        {/* Clean Unboxed Metadata with Typographic Separators */}
                        <div className="text-xs text-stone-500">
                          <span
                            className={
                              item.isVeg
                                ? 'text-emerald-700 font-semibold'
                                : 'text-amber-800 font-semibold'
                            }
                          >
                            {item.isVeg ? 'Vegetarian' : 'Contains Chicken'}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>{item.category}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">
                            {item.calories} kcal
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-stone-900 leading-snug">
                          {item.name}
                        </h4>

                        <p className="text-xs text-stone-500">
                          <span>{item.outletName}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">
                            {item.prepMinutes} min prep
                          </span>
                        </p>

                        <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Price & Action Footer */}
                    <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-3 border-t border-stone-100">
                      <div>
                        <div className="text-base font-bold font-mono text-stone-900 tabular-nums">
                          {formatCurrency(item.price)}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          Meal sales value
                        </div>
                      </div>

                      {item.isSoldOut ? (
                        <button
                          type="button"
                          disabled
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 text-stone-500 text-xs font-semibold cursor-not-allowed whitespace-nowrap shrink-0"
                        >
                          Sold Out
                        </button>
                      ) : inCart ? (
                        <div className="flex items-center gap-2 bg-stone-900 text-white rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-stone-800 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-xs font-bold px-2 tabular-nums">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-stone-800 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Meal</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT 4 COLUMNS: Contiguous Pickup Slot & Checkout Module */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
            <div className="p-6 rounded-2xl bg-white border border-stone-200 space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3.5">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-700" />
                  <h3 className="text-base font-bold text-stone-900">
                    Pickup Tray &amp; Slot
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-medium text-stone-500 hover:text-rose-700"
                  >
                    Clear Tray
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm font-medium text-stone-700">
                    Your pickup tray is empty
                  </p>
                  <p className="text-xs text-stone-500">
                    Add any available meal from a sample partner outlet to choose a 15-minute pickup slot.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selected Outlet Label */}
                  {cartOutlet && (
                    <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200/70">
                      <div className="font-semibold text-stone-900">
                        {cartOutlet.name}
                      </div>
                      <div className="mt-0.5">{cartOutlet.campusZone}</div>
                    </div>
                  )}

                  {/* Itemized Cart List */}
                  <div className="divide-y divide-stone-100">
                    {cart.map((c) => (
                      <div
                        key={c.menuItem.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-stone-900 truncate">
                            {c.menuItem.name.replace('[SAMPLE MEAL] ', '')}
                          </div>
                          <div className="text-xs font-mono text-stone-500 tabular-nums">
                            {formatCurrency(c.menuItem.price)} × {c.quantity} ={' '}
                            {formatCurrency(c.menuItem.price * c.quantity)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(c.menuItem.id, -1)}
                            className="min-h-[36px] min-w-[36px] rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-100"
                            aria-label="Decrease item"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-xs font-bold w-5 text-center tabular-nums">
                            {c.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(c.menuItem.id, 1)}
                            className="min-h-[36px] min-w-[36px] rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-100"
                            aria-label="Increase item"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pickup Slot Selector with Real-Time Capacity Enforcement */}
                  <div className="space-y-2.5 pt-2 border-t border-stone-100">
                    <label className="block text-xs font-semibold text-stone-800">
                      2. Select Pickup Time Slot (Capacity Enforced)
                    </label>
                    <div className="space-y-2">
                      {outletSlots.map((slot) => {
                        const isFull = slot.bookedCount >= slot.maxCapacity;
                        const spotsLeft = Math.max(0, slot.maxCapacity - slot.bookedCount);
                        const isChosen = selectedSlotId === slot.id;

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={isFull}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                              isFull
                                ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                                : isChosen
                                ? 'bg-stone-900 border-stone-900 text-white'
                                : 'bg-white border-stone-200 text-stone-800 hover:bg-stone-50'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold font-mono">
                                {slot.label}
                              </div>
                              <div
                                className={`text-[11px] mt-0.5 ${
                                  isFull
                                    ? 'text-rose-600 font-semibold'
                                    : isChosen
                                    ? 'text-amber-300'
                                    : 'text-stone-500'
                                }`}
                              >
                                {isFull
                                  ? 'Slot Full — Capacity Reached'
                                  : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} remaining`}
                              </div>
                            </div>
                            <div className="text-xs font-mono font-semibold tabular-nums shrink-0">
                              {slot.bookedCount}/{slot.maxCapacity}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Dietary Note */}
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Pickup / Spice Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      maxLength={200}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g., Less spicy, no raw onion"
                      className="w-full h-10 px-3 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
                    />
                  </div>

                  {/* Explicit Separation of Meal Sales Value vs Platform Commission */}
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-700">
                      <span>Meal Sales Value (To Outlet)</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrency(mealSalesValue)}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Platform Commission ({commissionRate}%)</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrency(platformCommission)}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-stone-200 flex justify-between text-sm font-bold text-stone-900">
                      <span>Total Demo Payable</span>
                      <span className="font-mono text-amber-800 tabular-nums">
                        {formatCurrency(totalPayable)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      !selectedSlot ||
                      selectedSlot.bookedCount >= selectedSlot.maxCapacity
                    }
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <span>
                      Proceed to Demo Payment · {formatCurrency(totalPayable)}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MY ORDERS, LIVE TRACKING & REPEAT ORDERING TAB */}
      {activeSubTab === 'orders' && (
        <div className="space-y-6">
          {studentOrders.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-3">
              <Clock className="w-8 h-8 text-stone-400 mx-auto" />
              <h3 className="text-base font-bold text-stone-900">
                No Orders Placed Yet
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Browse meals from our sample campus outlets, choose a pickup slot, and complete the demonstration checkout to track your live order status here.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubTab('menu')}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
              >
                Browse Sample Outlets
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {studentOrders.map((order) => {
                const currentStepIndex = ORDER_STEPS.findIndex(
                  (s) => s.key === order.status
                );

                return (
                  <div
                    key={order.id}
                    className="p-6 rounded-2xl bg-white border border-stone-200 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                      <div>
                        <div className="text-xs text-stone-500">
                          <span className="font-mono font-bold text-stone-900">
                            Order {order.orderNumber}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>{order.outletName}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono">{order.paymentRef}</span>
                        </div>
                        <h4 className="text-base font-bold text-stone-900 mt-1">
                          {order.itemsSummary}
                        </h4>
                        <div className="text-xs text-stone-600 mt-1">
                          <span>Pickup Window: </span>
                          <strong className="font-mono text-stone-900">
                            {order.slotLabel}
                          </strong>
                        </div>
                      </div>

                      {/* Counter Pickup PIN Verification Box */}
                      <div className="flex items-center gap-4 self-start sm:self-center">
                        <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-right">
                          <div className="text-[11px] text-amber-900 font-medium">
                            Pickup PIN
                          </div>
                          <div className="text-lg font-mono font-bold text-amber-900 tracking-wider tabular-nums">
                            {order.pickupCode}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Order Status Progress Bar */}
                    {order.status === 'cancelled' ? (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium flex items-center gap-2">
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>
                          Order Cancelled · Demo Payment Refunded ({order.paymentStatus})
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {ORDER_STEPS.map((step, idx) => {
                          const isDone = idx <= currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          return (
                            <div
                              key={step.key}
                              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                                isCurrent
                                  ? 'bg-stone-900 border-stone-900 text-white font-bold'
                                  : isDone
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                                  : 'bg-stone-50 border-stone-200 text-stone-400'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{step.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Financial Split & Action Controls (Repeat Order / Cancel Order) */}
                    <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-stone-600 font-mono tabular-nums">
                        <span>Meal Value: {formatCurrency(order.mealSalesValue)}</span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          Platform Fee ({order.commissionRate}%):{' '}
                          {formatCurrency(order.platformCommission)}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <strong className="text-stone-900">
                          Total Paid (Demo): {formatCurrency(order.totalPayable)}
                        </strong>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {order.status === 'placed' && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(order)}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            Cancel Order
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRepeatOrder(order)}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Repeat Order</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Demonstration Payment Modal */}
      {cartOutlet && selectedSlot && (
        <DemoPaymentModal
          isOpen={isPaymentModalOpen}
          outlet={cartOutlet}
          slot={selectedSlot}
          cart={cart}
          notes={orderNotes}
          isSubmitting={isSubmittingOrder}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirmPayment={handleConfirmDemoOrder}
        />
      )}
    </div>
  );
};
