import React, { useState } from 'react';
import { CheckCircle2, CreditCard, Landmark, ShieldCheck, Smartphone, X } from 'lucide-react';
import { CartItem, formatCurrency, Outlet, PaymentMethod, PickupSlot } from '../types';

interface DemoPaymentModalProps {
  isOpen: boolean;
  outlet: Outlet;
  slot: PickupSlot;
  cart: CartItem[];
  notes: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirmPayment: (method: PaymentMethod, paymentRef: string) => Promise<void>;
}

export const DemoPaymentModal: React.FC<DemoPaymentModalProps> = ({
  isOpen,
  outlet,
  slot,
  cart,
  notes,
  isSubmitting,
  onClose,
  onConfirmPayment,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('demo_upi');
  const [upiHandle, setUpiHandle] = useState('student@campusuat');
  const [campusCardId, setCampusCardId] = useState('MM-2026-8841');

  if (!isOpen) return null;

  const mealSalesValue = Math.round(
    cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0)
  );
  const commissionRate = outlet.commissionRate;
  const platformCommission = Math.round((mealSalesValue * commissionRate) / 100);
  const totalPayable = mealSalesValue + platformCommission;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const prefix =
      selectedMethod === 'demo_upi'
        ? 'DEMO-UPI'
        : selectedMethod === 'demo_campus_card'
        ? 'DEMO-CARD'
        : 'DEMO-BANK';
    await onConfirmPayment(selectedMethod, `${prefix}-${randomDigits}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="w-full min-w-0 max-w-lg rounded-t-3xl sm:rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col my-auto">
        {/* Top bar (Pinned) */}
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-stone-200 bg-stone-50">
          <div>
            <p className="text-xs font-medium text-amber-800">
              Classroom Demonstration Checkout · No Real Money Collected
            </p>
            <h3 className="text-lg font-bold text-stone-900 mt-0.5">
              Simulated Payment Gateway
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
            aria-label="Close payment modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form with Bounded Scrollable Body + Pinned Footer */}
        <form
          onSubmit={handlePay}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
            {/* Outlet & Pickup Window Summary */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <div className="text-xs text-stone-500">
                <span>{outlet.name}</span>
                <span aria-hidden="true"> · </span>
                <span>{outlet.campusZone}</span>
              </div>
              <div className="text-sm font-semibold text-stone-900">
                Pickup Slot: <span className="font-mono">{slot.label}</span>
              </div>
              {notes.trim() && (
                <p className="text-xs text-stone-600 pt-0.5">
                  Kitchen Note: &ldquo;{notes.trim()}&rdquo;
                </p>
              )}
            </div>

            {/* Strict Financial Separation Breakdown */}
            <div className="p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="text-xs font-semibold text-stone-700">
                Split Settlement Breakdown (Vendor vs Platform)
              </div>
              <div className="flex items-center justify-between text-sm text-stone-700">
                <span>Net Meal Sales Value (100% to Outlet)</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(mealSalesValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-stone-600">
                <span>
                  Platform Service Commission ({commissionRate}% MessMate Fee)
                </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(platformCommission)}
                </span>
              </div>
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-base font-bold text-stone-900">
                <span>Total Demonstration Payable</span>
                <span className="font-mono text-lg text-amber-700 tabular-nums">
                  {formatCurrency(totalPayable)}
                </span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700">
                Choose Demonstration Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('demo_upi')}
                  className={`min-h-[58px] p-2.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                    selectedMethod === 'demo_upi'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="text-xs font-semibold whitespace-nowrap">
                    Demo UPI
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('demo_campus_card')}
                  className={`min-h-[58px] p-2.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                    selectedMethod === 'demo_campus_card'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs font-semibold whitespace-nowrap">
                    Campus Card
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('demo_netbanking')}
                  className={`min-h-[58px] p-2.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                    selectedMethod === 'demo_netbanking'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  <span className="text-xs font-semibold whitespace-nowrap">
                    NetBanking
                  </span>
                </button>
              </div>
            </div>

            {/* Simulated Input Field */}
            {selectedMethod === 'demo_upi' && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Simulated UPI VPA (Sandbox Only)
                </label>
                <input
                  type="text"
                  value={upiHandle}
                  onChange={(e) => setUpiHandle(e.target.value)}
                  required
                  className="w-full h-10 px-3.5 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            )}

            {selectedMethod === 'demo_campus_card' && (
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Simulated Student Smart Card Number
                </label>
                <input
                  type="text"
                  value={campusCardId}
                  onChange={(e) => setCampusCardId(e.target.value)}
                  required
                  className="w-full h-10 px-3.5 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            )}

            {selectedMethod === 'demo_netbanking' && (
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600">
                Sandbox Bank:{' '}
                <strong className="text-stone-900">
                  Campus State Bank — Test Environment
                </strong>
                . Instant approval will be simulated on confirmation.
              </div>
            )}

            {/* Classroom sandbox assurance */}
            <div className="flex items-start gap-2.5 text-xs text-stone-600 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
              <ShieldCheck className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <span>
                This is a classroom demonstration payment flow. No real bank,
                card, or UPI account is charged. Meal sales value (
                {formatCurrency(mealSalesValue)}) and platform commission (
                {formatCurrency(platformCommission)}) are recorded in separate
                database fields.
              </span>
            </div>
          </div>

          {/* Pinned Bottom Action Bar */}
          <div className="shrink-0 px-5 sm:px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[46px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-w-0 w-full sm:w-auto min-h-[46px] px-3 sm:px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-normal sm:whitespace-nowrap shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isSubmitting
                  ? 'Confirming Demo Order...'
                  : `Approve Demo Payment · ${formatCurrency(totalPayable)}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
