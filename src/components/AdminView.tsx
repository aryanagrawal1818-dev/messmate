import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  clampString,
  formatCurrency,
  Order,
  Outlet,
  UserProfile,
  UserRole,
} from '../types';

interface AdminViewProps {
  userProfile: UserProfile;
  outlets: Outlet[];
  allOrders: Order[];
  allUsers: UserProfile[];
  isSeeding: boolean;
  onSeedSampleData: () => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({
  userProfile,
  outlets,
  allOrders,
  allUsers,
  isSeeding,
  onSeedSampleData,
}) => {
  const [adminTab, setAdminTab] = useState<'ledger' | 'outlets' | 'users'>('ledger');
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Outlet creation state
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletZone, setNewOutletZone] = useState('Academic Block D · Ground Floor');
  const [newOutletCuisine, setNewOutletCuisine] = useState('Campus Meals & Beverages');
  const [newOutletCommission, setNewOutletCommission] = useState('8');
  const [newOutletPrep, setNewOutletPrep] = useState('10');

  const settledOrders = useMemo(
    () => allOrders.filter((o) => o.status !== 'cancelled'),
    [allOrders]
  );

  const totalMealSalesValue = useMemo(
    () => settledOrders.reduce((acc, o) => acc + o.mealSalesValue, 0),
    [settledOrders]
  );

  const totalPlatformCommission = useMemo(
    () => settledOrders.reduce((acc, o) => acc + o.platformCommission, 0),
    [settledOrders]
  );

  const totalGrossProcessed = totalMealSalesValue + totalPlatformCommission;

  const handleUpdateCommissionRate = async (outlet: Outlet, nextRate: number) => {
    const clampedRate = Math.min(50, Math.max(0, Math.round(nextRate)));
    try {
      await updateDoc(doc(db, 'outlets', outlet.id), {
        commissionRate: clampedRate,
        updatedAt: serverTimestamp(),
      });
      setFeedback(
        `Updated platform commission for ${outlet.name} to ${clampedRate}%.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `outlets/${outlet.id}`);
    }
  };

  const handleToggleOutletActive = async (outlet: Outlet) => {
    try {
      await updateDoc(doc(db, 'outlets', outlet.id), {
        isActive: !outlet.isActive,
        updatedAt: serverTimestamp(),
      });
      setFeedback(
        `${outlet.name} is now ${!outlet.isActive ? 'Active' : 'Paused'}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `outlets/${outlet.id}`);
    }
  };

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName.trim()) return;

    const outletId = `outlet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rate = Math.min(50, Math.max(0, Math.round(Number(newOutletCommission) || 8)));
    const prep = Math.min(120, Math.max(1, Math.round(Number(newOutletPrep) || 10)));

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'outlets', outletId), {
        id: outletId,
        name: clampString(newOutletName, 1, 120, '[SAMPLE OUTLET] Campus Kitchen'),
        campusZone: clampString(newOutletZone, 1, 120, 'Main Campus'),
        cuisine: clampString(newOutletCuisine, 1, 80, 'Campus Dining'),
        description: 'Partner campus dining outlet created via Admin Portal.',
        vendorId: userProfile.uid,
        vendorName: clampString(userProfile.displayName, 1, 100, 'Platform Admin'),
        commissionRate: rate,
        isActive: true,
        isSample: true,
        prepTimeMinutes: prep,
        imageKey: 'paneer_tikka_bowl',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setNewOutletName('');
      setFeedback(`Created partner outlet "${newOutletName}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `outlets/${outletId}`);
    }
  };

  const handleUpdateUserRole = async (
    targetUser: UserProfile,
    nextRole: UserRole,
    assignedOutletId: string
  ) => {
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: nextRole,
        assignedOutletId: assignedOutletId || 'none',
        updatedAt: serverTimestamp(),
      });
      setFeedback(
        `Updated ${targetUser.displayName} (${targetUser.email}) to role "${nextRole}".`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between gap-4">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Admin Header & Classroom Sample Reset Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs text-stone-500">
            <span>Platform Administrator Console</span>
            <span aria-hidden="true"> · </span>
            <span>{userProfile.email}</span>
          </p>
          <h2 className="text-2xl font-bold text-stone-900 mt-0.5">
            MessMate Platform Governance &amp; Split Ledger
          </h2>
        </div>

        <button
          type="button"
          onClick={onSeedSampleData}
          disabled={isSeeding}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-900 text-xs font-semibold transition-colors inline-flex items-center gap-2 self-start whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
          <span>
            {isSeeding
              ? 'Resetting Sample Data...'
              : 'Reset Sample Outlets, Meals & Slots'}
          </span>
        </button>
      </div>

      {/* Top-Level Financial Split Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-stone-200">
          <div className="text-xs text-stone-500">
            Net Vendor Meal Sales Value (Credited to Outlets)
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900 mt-1 tabular-nums">
            {formatCurrency(totalMealSalesValue)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            100% pass-through meal revenue across {settledOrders.length} active/settled orders
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200">
          <div className="text-xs text-stone-500">
            Platform Commission Revenue (MessMate Fee)
          </div>
          <div className="text-2xl font-bold font-mono text-amber-800 mt-1 tabular-nums">
            {formatCurrency(totalPlatformCommission)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            Strictly separated from vendor meal sales value
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200">
          <div className="text-xs text-stone-500">
            Total Demo Checkout Volume (Meal Sales + Commission)
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900 mt-1 tabular-nums">
            {formatCurrency(totalGrossProcessed)}
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {allOrders.filter((o) => o.status === 'cancelled').length} cancelled/refunded demo orders excluded
          </div>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setAdminTab('ledger')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            adminTab === 'ledger'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Split Financial Ledger ({allOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('outlets')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            adminTab === 'outlets'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Partner Outlets &amp; Commission ({outlets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            adminTab === 'users'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Accounts &amp; RBAC Roles ({allUsers.length})</span>
        </button>
      </div>

      {/* TAB 1: OUTLET-BY-OUTLET & ORDER-BY-ORDER SPLIT LEDGER */}
      {adminTab === 'ledger' && (
        <div className="space-y-6">
          {/* Per-Outlet Settlement Table */}
          <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">
                Partner Outlet Settlement Summary (Meal Sales vs Platform Commission)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-3 px-5 font-semibold">Partner Outlet</th>
                    <th className="py-3 px-5 font-semibold">Orders</th>
                    <th className="py-3 px-5 font-semibold text-right">
                      Commission Rate
                    </th>
                    <th className="py-3 px-5 font-semibold text-right">
                      Net Meal Sales (Vendor)
                    </th>
                    <th className="py-3 px-5 font-semibold text-right">
                      Platform Commission
                    </th>
                    <th className="py-3 px-5 font-semibold text-right">
                      Total Demo Paid
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {outlets.map((outlet) => {
                    const outletOrders = settledOrders.filter(
                      (o) => o.outletId === outlet.id
                    );
                    const mealSum = outletOrders.reduce(
                      (s, o) => s + o.mealSalesValue,
                      0
                    );
                    const commSum = outletOrders.reduce(
                      (s, o) => s + o.platformCommission,
                      0
                    );

                    return (
                      <tr key={outlet.id} className="hover:bg-stone-50/70">
                        <td className="py-3.5 px-5 font-semibold text-stone-900">
                          {outlet.name}
                        </td>
                        <td className="py-3.5 px-5 font-mono tabular-nums text-stone-600">
                          {outletOrders.length}
                        </td>
                        <td className="py-3.5 px-5 font-mono tabular-nums text-right text-stone-600">
                          {outlet.commissionRate}%
                        </td>
                        <td className="py-3.5 px-5 font-mono tabular-nums text-right font-semibold text-stone-900">
                          {formatCurrency(mealSum)}
                        </td>
                        <td className="py-3.5 px-5 font-mono tabular-nums text-right font-semibold text-amber-800">
                          {formatCurrency(commSum)}
                        </td>
                        <td className="py-3.5 px-5 font-mono tabular-nums text-right font-bold text-stone-900">
                          {formatCurrency(mealSum + commSum)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* All Platform Orders Audit Table */}
          <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">
                All Platform Orders ({allOrders.length})
              </h3>
            </div>
            {allOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500">
                No orders recorded yet. Place a demonstration order from the Student Portal to see real-time split accounting.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                      <th className="py-3 px-4 font-semibold">Order #</th>
                      <th className="py-3 px-4 font-semibold">Student</th>
                      <th className="py-3 px-4 font-semibold">Outlet &amp; Slot</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">
                        Meal Sales
                      </th>
                      <th className="py-3 px-4 font-semibold text-right">
                        Commission
                      </th>
                      <th className="py-3 px-4 font-semibold text-right">
                        Total Demo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {allOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">
                          {order.orderNumber}
                        </td>
                        <td className="py-3 px-4 text-stone-700">
                          <div>{order.studentName}</div>
                          <div className="text-[11px] text-stone-400">
                            {order.studentEmail}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-stone-700">
                          <div className="font-medium">
                            {order.outletName.replace('[SAMPLE OUTLET] ', '')}
                          </div>
                          <div className="font-mono text-[11px] text-stone-500">
                            {order.slotLabel}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-800">
                          {order.status.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-stone-900">
                          {formatCurrency(order.mealSalesValue)}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right font-semibold text-amber-800">
                          {formatCurrency(order.platformCommission)}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right font-bold text-stone-900">
                          {formatCurrency(order.totalPayable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PARTNER OUTLETS & COMMISSION MANAGER */}
      {adminTab === 'outlets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            {outlets.map((outlet) => (
              <div
                key={outlet.id}
                className="p-5 rounded-2xl bg-white border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs text-stone-500">
                    <span>{outlet.campusZone}</span>
                    <span aria-hidden="true"> · </span>
                    <span>Operator: {outlet.vendorName}</span>
                  </div>
                  <h4 className="text-base font-bold text-stone-900">
                    {outlet.name}
                  </h4>
                  <div className="text-xs text-stone-600">
                    <span>Platform Commission: </span>
                    <strong className="font-mono">{outlet.commissionRate}%</strong>
                    <span aria-hidden="true"> · </span>
                    <span>
                      Status: {outlet.isActive ? 'Open on Campus' : 'Paused'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateCommissionRate(
                        outlet,
                        outlet.commissionRate - 1
                      )
                    }
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-mono font-semibold hover:bg-stone-50"
                  >
                    -1% Fee
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateCommissionRate(
                        outlet,
                        outlet.commissionRate + 1
                      )
                    }
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-mono font-semibold hover:bg-stone-50"
                  >
                    +1% Fee
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleOutletActive(outlet)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                      outlet.isActive
                        ? 'bg-stone-900 text-white'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {outlet.isActive ? 'Pause Outlet' : 'Activate Outlet'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateOutlet}
            className="lg:col-span-4 p-5 rounded-2xl bg-white border border-stone-200 space-y-4"
          >
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-3">
              Register New Partner Outlet
            </h3>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Outlet Name
              </label>
              <input
                type="text"
                required
                value={newOutletName}
                onChange={(e) => setNewOutletName(e.target.value)}
                placeholder="[SAMPLE OUTLET] Hostel Night Canteen"
                className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Campus Zone / Counter
              </label>
              <input
                type="text"
                required
                value={newOutletZone}
                onChange={(e) => setNewOutletZone(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Cuisine Specialty
              </label>
              <input
                type="text"
                required
                value={newOutletCuisine}
                onChange={(e) => setNewOutletCuisine(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  required
                  value={newOutletCommission}
                  onChange={(e) => setNewOutletCommission(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Avg Prep (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={newOutletPrep}
                  onChange={(e) => setNewOutletPrep(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-stone-300 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Partner Outlet</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: USER ACCOUNTS & RBAC DIRECTORY */}
      {adminTab === 'users' && (
        <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="text-sm font-bold text-stone-900">
              Registered Accounts &amp; Role-Based Access Control
            </h3>
          </div>
          <div className="divide-y divide-stone-100">
            {allUsers.map((u) => (
              <div
                key={u.uid}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-bold text-stone-900">
                    {u.displayName}
                  </div>
                  <div className="text-xs text-stone-500">
                    <span>{u.email}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono">Role: {u.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(['student', 'vendor', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        handleUpdateUserRole(u, r, u.assignedOutletId)
                      }
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        u.role === r
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      Set {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
