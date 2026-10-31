import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Plus,
  Store,
  Utensils,
  XCircle,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  clampString,
  formatCurrency,
  MenuItem,
  Order,
  OrderStatus,
  Outlet,
  PickupSlot,
  UserProfile,
} from '../types';
import { MealArtwork } from './MealArtwork';

interface VendorViewProps {
  userProfile: UserProfile;
  outlets: Outlet[];
  menuItems: MenuItem[];
  pickupSlots: PickupSlot[];
  vendorOrders: Order[];
}

export const VendorView: React.FC<VendorViewProps> = ({
  userProfile,
  outlets,
  menuItems,
  pickupSlots,
  vendorOrders,
}) => {
  // Outlets owned by or explicitly assigned to this vendor profile
  const myOutlets = useMemo(
    () =>
      outlets.filter(
        (o) =>
          o.vendorId === userProfile.uid ||
          (userProfile.assignedOutletId !== 'none' &&
            o.id === userProfile.assignedOutletId)
      ),
    [outlets, userProfile.uid, userProfile.assignedOutletId]
  );

  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    myOutlets[0]?.id || ''
  );
  const [vendorTab, setVendorTab] = useState<'orders' | 'menu' | 'slots'>('orders');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New meal form state
  const [newMealName, setNewMealName] = useState('');
  const [newMealCategory, setNewMealCategory] = useState('Signature Bowls');
  const [newMealPrice, setNewMealPrice] = useState('150');
  const [newMealCalories, setNewMealCalories] = useState('480');
  const [newMealPrep, setNewMealPrep] = useState('10');
  const [newMealDesc, setNewMealDesc] = useState('');
  const [newMealVeg, setNewMealVeg] = useState(true);
  const [newMealImageKey, setNewMealImageKey] = useState('paneer_tikka_bowl');

  // New pickup slot form state
  const [newSlotLabel, setNewSlotLabel] = useState('01:15 PM – 01:30 PM');
  const [newSlotStart, setNewSlotStart] = useState('13:15');
  const [newSlotEnd, setNewSlotEnd] = useState('13:30');
  const [newSlotCap, setNewSlotCap] = useState('12');

  const activeOutlet = useMemo(() => {
    return (
      myOutlets.find((o) => o.id === selectedOutletId) || myOutlets[0] || null
    );
  }, [myOutlets, selectedOutletId]);

  const myOutletMenu = useMemo(() => {
    if (!activeOutlet) return [];
    return menuItems.filter(
      (m) => m.outletId === activeOutlet.id && m.vendorId === userProfile.uid
    );
  }, [menuItems, activeOutlet, userProfile.uid]);

  const myOutletSlots = useMemo(() => {
    if (!activeOutlet) return [];
    return pickupSlots
      .filter(
        (s) => s.outletId === activeOutlet.id && s.vendorId === userProfile.uid
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [pickupSlots, activeOutlet, userProfile.uid]);

  const myOutletOrders = useMemo(() => {
    if (!activeOutlet) return [];
    return vendorOrders.filter(
      (o) => o.outletId === activeOutlet.id && o.vendorId === userProfile.uid
    );
  }, [vendorOrders, activeOutlet, userProfile.uid]);

  // Financial Metrics for Active Outlet (Strictly Separating Vendor Meal Sales from Platform Commission)
  const validOrders = useMemo(
    () => myOutletOrders.filter((o) => o.status !== 'cancelled'),
    [myOutletOrders]
  );

  const vendorNetSales = useMemo(
    () => validOrders.reduce((acc, o) => acc + o.mealSalesValue, 0),
    [validOrders]
  );

  const platformCommissionTotal = useMemo(
    () => validOrders.reduce((acc, o) => acc + o.platformCommission, 0),
    [validOrders]
  );

  // Classroom helper: Claim a sample outlet as the current vendor operator
  const handleClaimSampleOutlet = async (sampleOutlet: Outlet) => {
    try {
      // Step 1: Claim parent sample outlet
      const outletRef = doc(db, 'outlets', sampleOutlet.id);
      await updateDoc(outletRef, {
        vendorId: userProfile.uid,
        vendorName: clampString(userProfile.displayName, 1, 100, 'Campus Vendor'),
        updatedAt: serverTimestamp(),
      });

      // Step 2: Sync child sample menuItems & pickupSlots to this vendorId
      const childBatch = writeBatch(db);
      const itemsToSync = menuItems.filter(
        (m) => m.outletId === sampleOutlet.id && m.isSample
      );
      for (const item of itemsToSync) {
        childBatch.update(doc(db, 'menuItems', item.id), {
          vendorId: userProfile.uid,
          updatedAt: serverTimestamp(),
        });
      }
      const slotsToSync = pickupSlots.filter(
        (s) => s.outletId === sampleOutlet.id
      );
      for (const slot of slotsToSync) {
        childBatch.update(doc(db, 'pickupSlots', slot.id), {
          vendorId: userProfile.uid,
          updatedAt: serverTimestamp(),
        });
      }
      await childBatch.commit();

      setSelectedOutletId(sampleOutlet.id);
      setStatusMessage(
        `Assigned your account as the operator for ${sampleOutlet.name}. You now manage only this outlet's menu, slots, and orders.`
      );
    } catch (err) {
      setStatusMessage(
        handleFirestoreError(err, OperationType.UPDATE, `outlets/${sampleOutlet.id}`)
      );
    }
  };

  const handleAdvanceOrderStatus = async (
    order: Order,
    nextStatus: OrderStatus
  ) => {
    try {
      const orderRef = doc(db, 'orders', order.id);
      if (nextStatus === 'cancelled') {
        await updateDoc(orderRef, {
          status: 'cancelled',
          paymentStatus: 'refunded_demo',
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(orderRef, {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
      setStatusMessage(
        `Order ${order.orderNumber} updated to "${nextStatus.replace(/_/g, ' ')}".`
      );
    } catch (err) {
      setStatusMessage(
        handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`)
      );
    }
  };

  const handleToggleSoldOut = async (item: MenuItem) => {
    try {
      const ref = doc(db, 'menuItems', item.id);
      await updateDoc(ref, {
        isSoldOut: !item.isSoldOut,
        updatedAt: serverTimestamp(),
      });
      setStatusMessage(
        `"${item.name}" is now marked ${!item.isSoldOut ? 'SOLD OUT' : 'IN STOCK'}.`
      );
    } catch (err) {
      setStatusMessage(
        handleFirestoreError(err, OperationType.UPDATE, `menuItems/${item.id}`)
      );
    }
  };

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet || !newMealName.trim()) return;

    const itemId = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const priceNum = Math.min(10000, Math.max(1, Math.round(Number(newMealPrice) || 120)));
    const calNum = Math.min(4000, Math.max(0, Math.round(Number(newMealCalories) || 450)));
    const prepNum = Math.min(120, Math.max(1, Math.round(Number(newMealPrep) || 10)));

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'menuItems', itemId), {
        id: itemId,
        outletId: activeOutlet.id,
        outletName: activeOutlet.name,
        vendorId: userProfile.uid,
        name: clampString(newMealName, 1, 120, 'Campus Special Meal'),
        category: clampString(newMealCategory, 1, 60, 'Signature Bowls'),
        description: clampString(
          newMealDesc || 'Freshly prepared campus meal.',
          1,
          400,
          'Freshly prepared campus meal.'
        ),
        price: priceNum,
        isVeg: newMealVeg,
        isSoldOut: false,
        isPublished: true,
        isSample: true,
        calories: calNum,
        prepMinutes: prepNum,
        imageKey: newMealImageKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      setNewMealName('');
      setNewMealDesc('');
      setStatusMessage(`Added "${newMealName}" to ${activeOutlet.name}.`);
    } catch (err) {
      setStatusMessage(
        handleFirestoreError(err, OperationType.CREATE, `menuItems/${itemId}`)
      );
    }
  };

  const handleAdjustSlotCapacity = async (slot: PickupSlot, delta: number) => {
    const nextCap = Math.min(
      500,
      Math.max(Math.max(1, slot.bookedCount), slot.maxCapacity + delta)
    );
    if (nextCap === slot.maxCapacity) return;

    try {
      await updateDoc(doc(db, 'pickupSlots', slot.id), {
        maxCapacity: nextCap,
        updatedAt: serverTimestamp(),
      });
      setStatusMessage(
        `Updated capacity for ${slot.label} to ${slot.bookedCount}/${nextCap}.`
      );
    } catch (err) {
      setStatusMessage(
        handleFirestoreError(err, OperationType.UPDATE, `pickupSlots/${slot.id}`)
      );
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet || !newSlotLabel.trim()) return;

    const slotId = `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const maxCap = Math.min(500, Math.max(1, Math.round(Number(newSlotCap) || 12)));

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'pickupSlots', slotId), {
        id: slotId,
        outletId: activeOutlet.id,
        vendorId: userProfile.uid,
        label: clampString(newSlotLabel, 1, 80, '01:15 PM – 01:30 PM'),
        startTime: clampString(newSlotStart, 1, 20, '13:15'),
        endTime: clampString(newSlotEnd, 1, 20, '13:30'),
        maxCapacity: maxCap,
        bookedCount: 0,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setStatusMessage(`Added pickup slot "${newSlotLabel}" with capacity ${maxCap}.`);
    } catch (err) {
      setStatusMessage(
        handleFirestoreError(err, OperationType.CREATE, `pickupSlots/${slotId}`)
      );
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {statusMessage && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-4">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Outlet Scoped Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs text-stone-500">
            <span>Vendor Portal · Isolated Outlet Scope</span>
            <span aria-hidden="true"> · </span>
            <span>Operator: {userProfile.displayName}</span>
          </p>
          <h2 className="text-2xl font-bold text-stone-900 mt-0.5">
            {activeOutlet ? activeOutlet.name : 'Select Partner Outlet to Manage'}
          </h2>
        </div>

        {myOutlets.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-stone-500 font-medium">
              Your Assigned Outlets:
            </span>
            {myOutlets.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedOutletId(o.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                  activeOutlet?.id === o.id
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {o.name.replace('[SAMPLE OUTLET] ', '')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* If current user doesn't manage a sample outlet yet, let them claim one for the classroom demo */}
      {myOutlets.length === 0 && (
        <div className="p-6 rounded-2xl bg-white border border-stone-200 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-900">
              Bind Your Account to a Classroom Sample Outlet
            </h3>
            <p className="text-xs text-stone-600">
              Vendors manage only their own menus, pickup slots, and orders. Select one of the sample campus outlets below to assign your account ({userProfile.email}) as its operator for the demonstration:
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {outlets
              .filter((o) => o.isSample)
              .map((sample) => (
                <div
                  key={sample.id}
                  className="p-4 rounded-xl border border-stone-200 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-bold text-stone-900">
                      {sample.name}
                    </div>
                    <div className="text-xs text-stone-500">{sample.campusZone}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClaimSampleOutlet(sample)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    Manage This Outlet
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeOutlet && (
        <>
          {/* Outlet Financial & Queue Metrics (Meal Sales Value Strictly Separated from Platform Commission) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-stone-200">
              <div className="text-xs text-stone-500">
                Vendor Net Meal Sales Value (100% Yours)
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1 tabular-nums">
                {formatCurrency(vendorNetSales)}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                Excludes platform commission · {validOrders.length} active/completed orders
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200">
              <div className="text-xs text-stone-500">
                Platform Service Commission ({activeOutlet.commissionRate}% Separate Ledger)
              </div>
              <div className="text-2xl font-bold font-mono text-amber-800 mt-1 tabular-nums">
                {formatCurrency(platformCommissionTotal)}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                Collected separately by MessMate platform
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200">
              <div className="text-xs text-stone-500">
                Menu &amp; Slot Status ({activeOutlet.name.replace('[SAMPLE OUTLET] ', '')})
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-1 tabular-nums">
                {myOutletMenu.filter((m) => !m.isSoldOut).length}/{myOutletMenu.length} In Stock
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {myOutletMenu.filter((m) => m.isSoldOut).length} Sold Out · {myOutletSlots.length} Pickup Slots
              </div>
            </div>
          </div>

          {/* Vendor Workspace Section Switcher */}
          <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setVendorTab('orders')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                vendorTab === 'orders'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Incoming Orders ({myOutletOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setVendorTab('menu')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                vendorTab === 'menu'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Menu &amp; Sold-Out Control ({myOutletMenu.length})
            </button>
            <button
              type="button"
              onClick={() => setVendorTab('slots')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                vendorTab === 'slots'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Pickup Slot Capacity ({myOutletSlots.length})
            </button>
          </div>

          {/* TAB 1: INCOMING ORDERS FOR THIS OUTLET */}
          {vendorTab === 'orders' && (
            <div className="space-y-4">
              {myOutletOrders.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
                  <Clock className="w-8 h-8 text-stone-400 mx-auto" />
                  <h3 className="text-base font-bold text-stone-900">
                    No Orders Yet for {activeOutlet.name}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Place a sample order in Student View for this outlet to demonstrate live kitchen fulfillment here.
                  </p>
                </div>
              ) : (
                myOutletOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl bg-white border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs text-stone-500">
                        <span className="font-mono font-bold text-stone-900">
                          {order.orderNumber}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>Student: {order.studentName}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">
                          Pickup PIN: <strong>{order.pickupCode}</strong>
                        </span>
                      </div>

                      <div className="text-base font-bold text-stone-900">
                        {order.itemsSummary}
                      </div>

                      <div className="text-xs text-stone-600">
                        <span>Slot: </span>
                        <strong className="font-mono">{order.slotLabel}</strong>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">
                          Vendor Meal Value: {formatCurrency(order.mealSalesValue)}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono text-stone-500">
                          Platform Fee: {formatCurrency(order.platformCommission)}
                        </span>
                      </div>

                      {order.notes && (
                        <div className="text-xs text-amber-800 font-medium">
                          Note: &ldquo;{order.notes}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Kitchen Fulfillment Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {order.status === 'placed' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdvanceOrderStatus(order, 'preparing')
                            }
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap"
                          >
                            Start Preparing
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdvanceOrderStatus(order, 'cancelled')
                            }
                            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold whitespace-nowrap"
                          >
                            Reject &amp; Refund
                          </button>
                        </>
                      )}

                      {order.status === 'preparing' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAdvanceOrderStatus(order, 'ready_for_pickup')
                          }
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          Mark Ready for Pickup
                        </button>
                      )}

                      {order.status === 'ready_for_pickup' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAdvanceOrderStatus(order, 'picked_up')
                          }
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          Verify PIN ({order.pickupCode}) &amp; Complete Pickup
                        </button>
                      )}

                      {order.status === 'picked_up' && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Picked Up &amp; Settled</span>
                        </span>
                      )}

                      {order.status === 'cancelled' && (
                        <span className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          <span>Cancelled (Demo Refunded)</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: MENU & SOLD-OUT MANAGER */}
          {vendorTab === 'menu' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8 space-y-4">
                <h3 className="text-sm font-semibold text-stone-700">
                  Manage Meals &amp; One-Tap Sold-Out Availability
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myOutletMenu.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <MealArtwork
                          imageKey={item.imageKey}
                          title={item.name}
                          className="h-36 w-full border-b border-stone-100"
                        />
                        <div className="p-4 space-y-1.5">
                          <div className="text-xs text-stone-500">
                            <span>{item.category}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono">
                              {formatCurrency(item.price)}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-stone-900">
                            {item.name}
                          </h4>
                          <p className="text-xs text-stone-500 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            item.isSoldOut ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {item.isSoldOut ? 'Status: Sold Out' : 'Status: In Stock'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleSoldOut(item)}
                          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                            item.isSoldOut
                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                              : 'bg-rose-700 hover:bg-rose-800 text-white'
                          }`}
                        >
                          {item.isSoldOut ? 'Mark In Stock' : 'Mark Sold Out'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Meal Form */}
              <form
                onSubmit={handleAddMeal}
                className="lg:col-span-4 p-5 rounded-2xl bg-white border border-stone-200 space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Utensils className="w-4 h-4 text-amber-700" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Add New Meal to {activeOutlet.name.replace('[SAMPLE OUTLET] ', '')}
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Meal Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newMealName}
                    onChange={(e) => setNewMealName(e.target.value)}
                    placeholder="[SAMPLE MEAL] Masala Paneer Roll"
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      required
                      value={newMealCategory}
                      onChange={(e) => setNewMealCategory(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Meal Price (INR)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      required
                      value={newMealPrice}
                      onChange={(e) => setNewMealPrice(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Calories (kcal)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={3000}
                      value={newMealCalories}
                      onChange={(e) => setNewMealCalories(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Prep Time (min)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={newMealPrep}
                      onChange={(e) => setNewMealPrep(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Illustration Style
                  </label>
                  <select
                    value={newMealImageKey}
                    onChange={(e) => setNewMealImageKey(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs bg-white"
                  >
                    <option value="paneer_tikka_bowl">Tandoor Rice Bowl</option>
                    <option value="crispy_chicken_wrap">Artisan Wrap / Roll</option>
                    <option value="masala_dosa_platter">South Indian Platter</option>
                    <option value="berry_acai_bowl">Smoothie Bowl &amp; Brew</option>
                    <option value="chole_kulche">Baked Kulcha Platter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={newMealDesc}
                    onChange={(e) => setNewMealDesc(e.target.value)}
                    placeholder="Ingredients and portion details..."
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={newMealVeg}
                    onChange={(e) => setNewMealVeg(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span>Pure Vegetarian Dish</span>
                </label>

                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Meal to Outlet Menu</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: PICKUP SLOT CAPACITY MANAGER */}
          {vendorTab === 'slots' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8 space-y-3">
                <h3 className="text-sm font-semibold text-stone-700">
                  Pickup Windows &amp; Live Capacity Controls
                </h3>
                {myOutletSlots.map((slot) => {
                  const isFull = slot.bookedCount >= slot.maxCapacity;
                  return (
                    <div
                      key={slot.id}
                      className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-bold font-mono text-stone-900">
                          {slot.label}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          <span className="font-mono tabular-nums">
                            Booked: {slot.bookedCount} / {slot.maxCapacity} max orders
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span
                            className={
                              isFull
                                ? 'text-rose-700 font-semibold'
                                : 'text-emerald-700 font-semibold'
                            }
                          >
                            {isFull ? 'Slot Full' : 'Open for Student Booking'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustSlotCapacity(slot, -1)}
                          disabled={slot.maxCapacity <= Math.max(1, slot.bookedCount)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 whitespace-nowrap"
                        >
                          -1 Max Capacity
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustSlotCapacity(slot, 1)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 whitespace-nowrap"
                        >
                          +1 Max Capacity
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Pickup Slot Form */}
              <form
                onSubmit={handleAddSlot}
                className="lg:col-span-4 p-5 rounded-2xl bg-white border border-stone-200 space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Store className="w-4 h-4 text-amber-700" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Add 15-Minute Pickup Slot
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Slot Display Label
                  </label>
                  <input
                    type="text"
                    required
                    value={newSlotLabel}
                    onChange={(e) => setNewSlotLabel(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Start (24h)
                    </label>
                    <input
                      type="text"
                      required
                      value={newSlotStart}
                      onChange={(e) => setNewSlotStart(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      End (24h)
                    </label>
                    <input
                      type="text"
                      required
                      value={newSlotEnd}
                      onChange={(e) => setNewSlotEnd(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Max Order Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={newSlotCap}
                    onChange={(e) => setNewSlotCap(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Pickup Slot</span>
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};
