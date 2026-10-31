/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Store,
  UserCheck,
  UtensilsCrossed,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  sanitizeErrorMessage,
} from './firebase';
import {
  clampString,
  MenuItem,
  Order,
  Outlet,
  PickupSlot,
  UserProfile,
  UserRole,
} from './types';
import { seedClassroomSampleData, SAMPLE_OUTLETS, SAMPLE_MEALS } from './data/sampleCatalog';
import { StudentView } from './components/StudentView';
import { VendorView } from './components/VendorView';
import { AdminView } from './components/AdminView';
import { MealArtwork } from './components/MealArtwork';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isInitializingProfile, setIsInitializingProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileInitError, setProfileInitError] = useState<string | null>(null);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Active portal view for classroom demonstration
  const [activePortal, setActivePortal] = useState<UserRole>('student');

  // Firestore synced collections
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [pickupSlots, setPickupSlots] = useState<PickupSlot[]>([]);
  const [studentOrders, setStudentOrders] = useState<Order[]>([]);
  const [vendorOrders, setVendorOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const [isSeeding, setIsSeeding] = useState(false);
  const hasAutoSeededRef = useRef(false);

  const isBootstrappedAdmin = useMemo(
    () =>
      Boolean(
        firebaseUser?.email &&
          firebaseUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
          firebaseUser.emailVerified
      ),
    [firebaseUser]
  );

  // 1. Non-throwing Auth State Listener — always settles authReady = true
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(
      auth,
      (user) => {
        setFirebaseUser(user);
        if (!user) {
          setUserProfile(null);
          setProfileInitError(null);
          setListenerError(null);
          setIsInitializingProfile(false);
        }
        setAuthReady(true);
      },
      (err) => {
        const msg = handleFirestoreError(err, OperationType.GET, 'auth/state');
        setAuthError(msg);
        setIsInitializingProfile(false);
        setAuthReady(true);
      }
    );

    return () => unsubAuth();
  }, []);

  // 2. Non-throwing UserProfile Initialization & Profile Snapshot Listener (re-runs on retryCount)
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setIsInitializingProfile(false);
      return;
    }

    let isCancelled = false;
    let unsubProfile: (() => void) | undefined;

    const initializeAndListenProfile = async () => {
      setIsInitializingProfile(true);
      setProfileInitError(null);

      try {
        // Attempt token refresh first so expired/disabled token service errors surface clearly
        await firebaseUser.getIdToken(false);

        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (isCancelled) return;

        const defaultRole: UserRole =
          firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
            ? 'admin'
            : 'student';

        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName: clampString(
              firebaseUser.displayName ||
                firebaseUser.email?.split('@')[0] ||
                'Campus Student',
              1,
              100,
              'Campus Student'
            ),
            email: clampString(
              firebaseUser.email || 'student@campus.edu',
              3,
              150,
              'student@campus.edu'
            ),
            role: defaultRole,
            assignedOutletId: 'none',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          setUserProfile(snap.data() as UserProfile);
        }

        if (isCancelled) return;

        unsubProfile = onSnapshot(
          userRef,
          (profileSnap) => {
            if (isCancelled) return;
            if (profileSnap.exists()) {
              setUserProfile(profileSnap.data() as UserProfile);
              setProfileInitError(null);
            }
            setIsInitializingProfile(false);
          },
          (err) => {
            if (isCancelled) return;
            const msg = handleFirestoreError(
              err,
              OperationType.GET,
              'users/profile'
            );
            setProfileInitError(msg);
            setIsInitializingProfile(false);
          }
        );
      } catch (err) {
        if (isCancelled) return;
        const msg = handleFirestoreError(
          err,
          OperationType.WRITE,
          'users/profile'
        );
        setProfileInitError(msg);
      } finally {
        if (!isCancelled) {
          setIsInitializingProfile(false);
        }
      }
    };

    initializeAndListenProfile();

    return () => {
      isCancelled = true;
      if (unsubProfile) unsubProfile();
    };
  }, [authReady, firebaseUser, retryCount]);

  // 3. Real-Time Collection Listeners (Non-throwing, re-attached on retryCount)
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) {
      setOutlets([]);
      setMenuItems([]);
      setPickupSlots([]);
      setStudentOrders([]);
      setVendorOrders([]);
      setAllOrders([]);
      setAllUsers([]);
      return;
    }

    setListenerError(null);

    // Outlets listener (matching Firestore list rules)
    const outletsQuery = isBootstrappedAdmin
      ? collection(db, 'outlets')
      : query(collection(db, 'outlets'), where('isActive', '==', true));

    const unsubOutlets = onSnapshot(
      outletsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Outlet);
        setOutlets(list);

        // Auto-seed sample classroom catalog on first empty state
        if (list.length === 0 && !hasAutoSeededRef.current && firebaseUser.emailVerified) {
          hasAutoSeededRef.current = true;
          seedClassroomSampleData(
            firebaseUser.uid,
            firebaseUser.displayName || 'Campus Partner Operator'
          ).catch((e) => {
            console.warn('Initial sample seed deferred:', sanitizeErrorMessage(e));
          });
        }
      },
      (err) => {
        const msg = handleFirestoreError(err, OperationType.LIST, 'outlets');
        setListenerError(msg);
      }
    );

    // MenuItems listener
    const menuQuery = isBootstrappedAdmin
      ? collection(db, 'menuItems')
      : query(collection(db, 'menuItems'), where('isPublished', '==', true));

    const unsubMenu = onSnapshot(
      menuQuery,
      (snap) => {
        setMenuItems(snap.docs.map((d) => d.data() as MenuItem));
      },
      (err) => {
        const msg = handleFirestoreError(err, OperationType.LIST, 'menuItems');
        setListenerError(msg);
      }
    );

    // PickupSlots listener
    const slotsQuery = isBootstrappedAdmin
      ? collection(db, 'pickupSlots')
      : query(collection(db, 'pickupSlots'), where('isActive', '==', true));

    const unsubSlots = onSnapshot(
      slotsQuery,
      (snap) => {
        setPickupSlots(snap.docs.map((d) => d.data() as PickupSlot));
      },
      (err) => {
        const msg = handleFirestoreError(err, OperationType.LIST, 'pickupSlots');
        setListenerError(msg);
      }
    );

    // Student's own orders listener (strictly isolated by studentId == uid)
    const studentOrdersQuery = query(
      collection(db, 'orders'),
      where('studentId', '==', firebaseUser.uid)
    );
    const unsubStudentOrders = onSnapshot(
      studentOrdersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Order);
        list.sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
        setStudentOrders(list);
      },
      (err) => {
        const msg = handleFirestoreError(err, OperationType.LIST, 'orders (student)');
        setListenerError(msg);
      }
    );

    // Vendor's own outlet orders listener (strictly isolated by vendorId == uid)
    const vendorOrdersQuery = query(
      collection(db, 'orders'),
      where('vendorId', '==', firebaseUser.uid)
    );
    const unsubVendorOrders = onSnapshot(
      vendorOrdersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Order);
        list.sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
        setVendorOrders(list);
      },
      (err) => {
        const msg = handleFirestoreError(err, OperationType.LIST, 'orders (vendor)');
        setListenerError(msg);
      }
    );

    // Admin platform-wide orders & users listeners
    let unsubAllOrders: (() => void) | undefined;
    let unsubAllUsers: (() => void) | undefined;

    if (isBootstrappedAdmin) {
      unsubAllOrders = onSnapshot(
        collection(db, 'orders'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as Order);
          list.sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
          );
          setAllOrders(list);
        },
        (err) => {
          const msg = handleFirestoreError(err, OperationType.LIST, 'orders (admin)');
          setListenerError(msg);
        }
      );

      unsubAllUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
        },
        (err) => {
          const msg = handleFirestoreError(err, OperationType.LIST, 'users (admin)');
          setListenerError(msg);
        }
      );
    }

    return () => {
      unsubOutlets();
      unsubMenu();
      unsubSlots();
      unsubStudentOrders();
      unsubVendorOrders();
      if (unsubAllOrders) unsubAllOrders();
      if (unsubAllUsers) unsubAllUsers();
    };
  }, [authReady, firebaseUser, userProfile, isBootstrappedAdmin, retryCount]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setProfileInitError(null);
    setListenerError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        handleFirestoreError(err, OperationType.GET, 'auth/google-popup')
      );
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    setProfileInitError(null);
    setListenerError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(handleFirestoreError(err, OperationType.GET, 'auth/signout'));
    } finally {
      setUserProfile(null);
      setActivePortal('student');
    }
  };

  const handleRetryInitialization = useCallback(async () => {
    setAuthError(null);
    setProfileInitError(null);
    setListenerError(null);
    hasAutoSeededRef.current = false;

    if (auth.currentUser) {
      setIsInitializingProfile(true);
      try {
        await auth.currentUser.getIdToken(true);
      } catch (err) {
        const msg = handleFirestoreError(err, OperationType.GET, 'auth/token-refresh');
        setProfileInitError(msg);
        setIsInitializingProfile(false);
        return;
      }
    }

    setRetryCount((prev) => prev + 1);
  }, []);

  const handleSeedData = async () => {
    if (!firebaseUser) return;
    setIsSeeding(true);
    try {
      const result = await seedClassroomSampleData(
        firebaseUser.uid,
        firebaseUser.displayName || 'Campus Partner Operator'
      );
      if (!result.ok && result.error) {
        setListenerError(result.error);
      } else {
        setListenerError(null);
      }
    } catch (err) {
      setListenerError(
        handleFirestoreError(err, OperationType.WRITE, 'sample-catalog-seed')
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const activeErrorMessage = authError || profileInitError || listenerError;
  const showSignedOutCatalog = !firebaseUser || !userProfile;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (single text element) */}
        <a
          href="#top"
          className="text-xl font-bold tracking-tight text-stone-900 font-display whitespace-nowrap shrink-0"
        >
          MessMate
        </a>

        {/* Zone 2: 4 Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <a
            href="#outlets"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Sample Outlets
          </a>
          <a
            href="#workflow"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Pickup Flow
          </a>
          <a
            href="#accounting"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Split Commission
          </a>
          <a
            href="#workspace"
            className="hover:text-stone-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Live Portal
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          {firebaseUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* LOADING SETTLEMENT BANNER */}
        {(!authReady || (firebaseUser && isInitializingProfile && !userProfile)) && (
          <div className="p-6 rounded-2xl bg-white border border-stone-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-700 animate-spin shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Connecting to MessMate Cloud Database...
                </h2>
                <p className="text-xs text-stone-500">
                  Verifying Google session and loading your Firestore account profile.
                </p>
              </div>
            </div>
            {firebaseUser && (
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            )}
          </div>
        )}

        {/* RETRYABLE ERROR UI (Shown on Auth, Token Service, Profile Init, or Listener Failure) */}
        {activeErrorMessage && (
          <div
            role="alert"
            className="p-6 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-950 space-y-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-rose-950">
                  Account Profile or Cloud Connection Could Not Initialize
                </h2>
                <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                  {activeErrorMessage}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleRetryInitialization}
                disabled={isInitializingProfile}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isInitializingProfile ? 'animate-spin' : ''}`}
                />
                <span>
                  {isInitializingProfile
                    ? 'Retrying Profile & Listeners...'
                    : 'Retry Profile & Database Connection'}
                </span>
              </button>

              {firebaseUser && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-900 border border-stone-300 text-xs font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* SIGNED-OUT LANDING & CLASSROOM PREVIEW (Also kept visible if profile initialization fails) */}
        {showSignedOutCatalog && (
          <div className="space-y-14">
            {/* Split Hero Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 p-8 sm:p-10 rounded-3xl bg-white border border-stone-200 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-amber-800">
                    Campus Meal Ordering &amp; Timed Pickup Platform · Classroom Demonstration
                  </p>
                  <h1 className="text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight leading-[1.1]">
                    Skip the lecture-break queue. Pre-order campus meals by pickup slot.
                  </h1>
                  <p className="text-base text-stone-600 leading-relaxed max-w-2xl">
                    Sign in with Google to browse clearly labelled sample outlets, reserve a 15-minute pickup window with live capacity limits, test the sandbox payment flow, and demonstrate separate Student, Vendor, and Administrator portals.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
                  {firebaseUser ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleRetryInitialization}
                        disabled={isInitializingProfile}
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isInitializingProfile ? 'animate-spin' : ''}`}
                        />
                        <span>Retry Loading Live Workspace</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="min-h-[48px] px-5 py-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <span>Sign in with Google to Start Demo</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <div className="text-xs text-stone-500">
                    <div>Accounts, menus &amp; orders persist in Cloud Firestore</div>
                    <div>Zero real money collected · Split commission ledger</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-3xl bg-white border border-stone-200 overflow-hidden flex flex-col justify-between">
                <MealArtwork
                  imageKey="paneer_tikka_bowl"
                  title="Smoky Paneer Tikka Rice Bowl"
                  className="h-64 lg:h-full w-full"
                />
                <div className="p-6 border-t border-stone-100 bg-white space-y-1">
                  <div className="text-xs text-stone-500">
                    <span>[SAMPLE OUTLET] Spice Route Express</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono">Slot 12:30 PM – 12:45 PM</span>
                  </div>
                  <div className="text-base font-bold text-stone-900">
                    Smoky Paneer Tikka Rice Bowl · ₹160 Meal Value + ₹13 Platform Fee
                  </div>
                </div>
              </div>
            </section>

            {/* Full-Width 3-Role Architecture Strip */}
            <section id="workflow" className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-white border border-stone-200 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                  <span>01. Student Portal</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Browse sample outlets, filter out sold-out items, pick a 15-minute slot with live capacity checks, complete a sandbox checkout, track order status, and repeat past orders in one tap.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-stone-200 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <Store className="w-4 h-4 text-amber-700" />
                  <span>02. Vendor Portal</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Scoped strictly to the vendor&apos;s own outlet. Toggle dishes Sold Out or In Stock, adjust pickup slot capacity, advance kitchen statuses, and verify 4-digit student pickup PINs.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-stone-200 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>03. Administrator Console</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Audit the platform-wide financial ledger keeping net vendor meal sales value strictly separate from platform commission, manage partner outlets, and assign user roles.
                </p>
              </div>
            </section>

            {/* Preview of Sample Outlets & Meals */}
            <section id="outlets" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-stone-500">
                    Classroom Demonstration Catalog
                  </p>
                  <h2 className="text-2xl font-bold text-stone-900">
                    Sample Partner Outlets &amp; Signature Meals
                  </h2>
                </div>
                <p className="text-xs text-stone-500">
                  {firebaseUser
                    ? 'Resolve the cloud connection banner above and click Retry to place live Firestore orders'
                    : 'Sign in with Google above to place live orders and test role switching'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {SAMPLE_OUTLETS.map((outlet) => {
                  const previewMeal = SAMPLE_MEALS.find(
                    (m) => m.outletId === outlet.id
                  );
                  return (
                    <div
                      key={outlet.id}
                      className="rounded-2xl bg-white border border-stone-200 overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <MealArtwork
                          imageKey={outlet.imageKey}
                          title={outlet.name}
                          className="h-40 w-full border-b border-stone-100"
                        />
                        <div className="p-5 space-y-2">
                          <div className="text-xs text-stone-500">
                            <span>{outlet.cuisine}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono">{outlet.prepTimeMinutes}m</span>
                          </div>
                          <h3 className="text-base font-bold text-stone-900">
                            {outlet.name}
                          </h3>
                          <p className="text-xs text-stone-500">{outlet.campusZone}</p>
                          {previewMeal && (
                            <p className="text-xs text-stone-600 pt-1">
                              Featured: {previewMeal.name.replace('[SAMPLE MEAL] ', '')} (₹{previewMeal.price})
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="px-5 pb-4 pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 font-mono">
                        <span>Commission: {outlet.commissionRate}%</span>
                        <span>3 Pickup Slots</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* SIGNED-IN WORKSPACE */}
        {firebaseUser && userProfile && (
          <div id="workspace" className="space-y-6">
            {/* Workspace Role Switcher Toolbar (Below Header per Top Bar Contract) */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {userProfile.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-stone-500">
                    <span>Account Role: </span>
                    <strong className="text-stone-900 uppercase">
                      {userProfile.role}
                    </strong>
                    <span aria-hidden="true"> · </span>
                    <span>{userProfile.email}</span>
                  </div>
                  <div className="text-sm font-bold text-stone-900">
                    Classroom Demonstration Role Switcher
                  </div>
                </div>
              </div>

              {/* Role Portal Selector Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl flex-wrap">
                <button
                  type="button"
                  onClick={() => setActivePortal('student')}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activePortal === 'student'
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  <span>Student Portal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePortal('vendor')}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activePortal === 'vendor'
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Vendor Portal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePortal('admin')}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activePortal === 'admin'
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Administrator Console</span>
                </button>
              </div>
            </div>

            {/* Active Portal View */}
            {activePortal === 'student' && (
              <StudentView
                userProfile={userProfile}
                outlets={outlets}
                menuItems={menuItems}
                pickupSlots={pickupSlots}
                studentOrders={studentOrders}
                isSeeding={isSeeding}
                onSeedSampleData={handleSeedData}
              />
            )}

            {activePortal === 'vendor' && (
              <VendorView
                userProfile={userProfile}
                outlets={outlets}
                menuItems={menuItems}
                pickupSlots={pickupSlots}
                vendorOrders={vendorOrders}
              />
            )}

            {activePortal === 'admin' && (
              <AdminView
                userProfile={userProfile}
                outlets={outlets}
                allOrders={isBootstrappedAdmin ? allOrders : studentOrders}
                allUsers={
                  isBootstrappedAdmin
                    ? allUsers
                    : [userProfile]
                }
                isSeeding={isSeeding}
                onSeedSampleData={handleSeedData}
              />
            )}
          </div>
        )}
      </main>

      {/* QUIET FOOTER */}
      <footer
        id="accounting"
        className="border-t border-stone-200 bg-white px-6 py-6 text-xs text-stone-500"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong className="text-stone-900 font-display">MessMate</strong> · Student Meal-Ordering &amp; Timed Pickup Platform
          </div>
          <div className="flex items-center gap-4">
            <span>Sample Outlets &amp; Meals for Classroom Demo</span>
            <span aria-hidden="true">·</span>
            <span>Meal Sales Value Separated from Platform Commission</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
