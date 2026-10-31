import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface SampleOutletSeed {
  id: string;
  name: string;
  campusZone: string;
  cuisine: string;
  description: string;
  commissionRate: number;
  isActive: boolean;
  isSample: boolean;
  prepTimeMinutes: number;
  imageKey: string;
}

export interface SampleMenuSeed {
  id: string;
  outletId: string;
  outletName: string;
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
}

export interface SampleSlotSeed {
  id: string;
  outletId: string;
  label: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  isActive: boolean;
}

export const SAMPLE_OUTLETS: SampleOutletSeed[] = [
  {
    id: 'outlet_spice_route',
    name: '[SAMPLE OUTLET] Spice Route Express',
    campusZone: 'North Academic Block · Counter B1',
    cuisine: 'North Indian Bowls & Tandoor',
    description:
      'Classroom sample partner outlet serving freshly grilled paneer tikka bowls, homestyle rajma chawal, and baked Amritsari kulchas between lectures.',
    commissionRate: 8,
    isActive: true,
    isSample: true,
    prepTimeMinutes: 12,
    imageKey: 'paneer_tikka_bowl',
  },
  {
    id: 'outlet_green_bowl',
    name: '[SAMPLE OUTLET] Green Bowl Studio',
    campusZone: 'Student Activity Center · Ground Floor',
    cuisine: 'Artisan Wraps, Salads & Protein Bowls',
    description:
      'Classroom sample partner outlet crafting warm whole-wheat wraps, Mediterranean falafel rolls, and high-protein quinoa bowls.',
    commissionRate: 10,
    isActive: true,
    isSample: true,
    prepTimeMinutes: 10,
    imageKey: 'crispy_chicken_wrap',
  },
  {
    id: 'outlet_dakshin_tiffin',
    name: '[SAMPLE OUTLET] Dakshin Tiffin Room',
    campusZone: 'Hostel Enclave Plaza · Counter C3',
    cuisine: 'South Indian Dosas, Idli & Filter Coffee',
    description:
      'Classroom sample partner outlet famous for crisp golden masala dosas, steaming podi idlis, and brass-davara South Indian filter coffee.',
    commissionRate: 7,
    isActive: true,
    isSample: true,
    prepTimeMinutes: 8,
    imageKey: 'masala_dosa_platter',
  },
  {
    id: 'outlet_brew_bite',
    name: '[SAMPLE OUTLET] Brew & Bite Roastery',
    campusZone: 'Central Library Courtyard · Kiosk A2',
    cuisine: 'Smoothie Bowls, Sourdough & Cold Brew',
    description:
      'Classroom sample partner outlet for quick library break snacks, berry acai bowls, sourdough toasties, and house-steeped cold brew.',
    commissionRate: 12,
    isActive: true,
    isSample: true,
    prepTimeMinutes: 7,
    imageKey: 'berry_acai_bowl',
  },
];

export const SAMPLE_MEALS: SampleMenuSeed[] = [
  // Outlet 1: Spice Route Express
  {
    id: 'meal_sr_paneer_tikka',
    outletId: 'outlet_spice_route',
    outletName: '[SAMPLE OUTLET] Spice Route Express',
    name: '[SAMPLE MEAL] Smoky Paneer Tikka Rice Bowl',
    category: 'Signature Bowls',
    description:
      'Char-grilled malai paneer cubes over aromatic jeera basmati rice with mint chutney, pickled red onions, and roasted bell peppers.',
    price: 160,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 540,
    prepMinutes: 12,
    imageKey: 'paneer_tikka_bowl',
  },
  {
    id: 'meal_sr_rajma_chawal',
    outletId: 'outlet_spice_route',
    outletName: '[SAMPLE OUTLET] Spice Route Express',
    name: '[SAMPLE MEAL] Homestyle Jammu Rajma Chawal',
    category: 'Signature Bowls',
    description:
      'Slow-simmered red kidney beans in spiced tomato-ginger gravy served with aged basmati rice, boondi raita, and lemon wedge.',
    price: 130,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 490,
    prepMinutes: 10,
    imageKey: 'rajma_chawal_bowl',
  },
  {
    id: 'meal_sr_chole_kulche',
    outletId: 'outlet_spice_route',
    outletName: '[SAMPLE OUTLET] Spice Route Express',
    name: '[SAMPLE MEAL] Baked Amritsari Chole Kulche',
    category: 'Tandoor Platters',
    description:
      'Two crisp potato-stuffed baked kulchas paired with tangy pindi chole, tamarind-date chutney, and pickled green chillies.',
    price: 145,
    isVeg: true,
    isSoldOut: true, // Pre-marked Sold Out to demonstrate sold-out badge immediately
    isPublished: true,
    isSample: true,
    calories: 610,
    prepMinutes: 14,
    imageKey: 'chole_kulche',
  },

  // Outlet 2: Green Bowl Studio
  {
    id: 'meal_gb_chicken_wrap',
    outletId: 'outlet_green_bowl',
    outletName: '[SAMPLE OUTLET] Green Bowl Studio',
    name: '[SAMPLE MEAL] Herb Grilled Chicken & Avocado Wrap',
    category: 'Artisan Wraps',
    description:
      'Warm whole-wheat tortilla loaded with herb-roasted chicken breast, smashed avocado, charred corn, romaine, and chipotle yogurt dressing.',
    price: 180,
    isVeg: false,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 510,
    prepMinutes: 10,
    imageKey: 'crispy_chicken_wrap',
  },
  {
    id: 'meal_gb_falafel_wrap',
    outletId: 'outlet_green_bowl',
    outletName: '[SAMPLE OUTLET] Green Bowl Studio',
    name: '[SAMPLE MEAL] Crispy Chickpea Falafel & Hummus Roll',
    category: 'Artisan Wraps',
    description:
      'Baked herb falafel, roasted garlic hummus, pickled turnips, cucumber ribbons, and tahini drizzle in a multigrain flatbread.',
    price: 150,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 460,
    prepMinutes: 9,
    imageKey: 'mediterranean_falafel_wrap',
  },
  {
    id: 'meal_gb_quinoa_power',
    outletId: 'outlet_green_bowl',
    outletName: '[SAMPLE OUTLET] Green Bowl Studio',
    name: '[SAMPLE MEAL] Harvest Quinoa & Edamame Power Bowl',
    category: 'Protein Bowls',
    description:
      'Tri-color quinoa, steamed edamame, roasted sweet potato, baby spinach, toasted pumpkin seeds, and lemon-herb vinaigrette.',
    price: 190,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 430,
    prepMinutes: 8,
    imageKey: 'protein_quinoa_salad',
  },

  // Outlet 3: Dakshin Tiffin Room
  {
    id: 'meal_dt_masala_dosa',
    outletId: 'outlet_dakshin_tiffin',
    outletName: '[SAMPLE OUTLET] Dakshin Tiffin Room',
    name: '[SAMPLE MEAL] Ghee Roast Benne Masala Dosa',
    category: 'South Indian Tiffin',
    description:
      'Crisp fermented rice-lentil crepe roasted with pure ghee, spiced potato palya, fresh coconut chutney, tomato kara chutney, and hot sambar.',
    price: 120,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 470,
    prepMinutes: 8,
    imageKey: 'masala_dosa_platter',
  },
  {
    id: 'meal_dt_podi_idli',
    outletId: 'outlet_dakshin_tiffin',
    outletName: '[SAMPLE OUTLET] Dakshin Tiffin Room',
    name: '[SAMPLE MEAL] Mini Ghee Podi Idli & Medu Vada Combo',
    category: 'South Indian Tiffin',
    description:
      'Ten bite-sized steamed idlis tossed in roasted lentil gunpowder and sesame oil, served with one crispy medu vada and sambar.',
    price: 110,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 410,
    prepMinutes: 7,
    imageKey: 'idli_vada_tiffin',
  },
  {
    id: 'meal_dt_filter_coffee',
    outletId: 'outlet_dakshin_tiffin',
    outletName: '[SAMPLE OUTLET] Dakshin Tiffin Room',
    name: '[SAMPLE MEAL] Chikmagalur Degree Filter Coffee & Banana Cake',
    category: 'Beverages & Sides',
    description:
      'Rich decoction brewed from Chikmagalur Arabica-Robusta peaberry beans with frothed milk, paired with a warm slice of walnut banana cake.',
    price: 85,
    isVeg: true,
    isSoldOut: true, // Pre-marked Sold Out for immediate demonstration
    isPublished: true,
    isSample: true,
    calories: 290,
    prepMinutes: 5,
    imageKey: 'filter_coffee_combo',
  },

  // Outlet 4: Brew & Bite Roastery
  {
    id: 'meal_bb_acai_bowl',
    outletId: 'outlet_brew_bite',
    outletName: '[SAMPLE OUTLET] Brew & Bite Roastery',
    name: '[SAMPLE MEAL] Wild Berry Acai & Honey Granola Bowl',
    category: 'Smoothie Bowls',
    description:
      'Chilled organic acai and mixed berry blend topped with house-baked oat granola, sliced banana, chia seeds, and roasted almonds.',
    price: 200,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 390,
    prepMinutes: 6,
    imageKey: 'berry_acai_bowl',
  },
  {
    id: 'meal_bb_avocado_sourdough',
    outletId: 'outlet_brew_bite',
    outletName: '[SAMPLE OUTLET] Brew & Bite Roastery',
    name: '[SAMPLE MEAL] Sourdough Avocado & Chili Flake Toast',
    category: 'All-Day Toasties',
    description:
      'Artisan 36-hour fermented country sourdough topped with seasoned Hass avocado mash, cherry tomatoes, feta crumbles, and cold-pressed olive oil.',
    price: 175,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 420,
    prepMinutes: 8,
    imageKey: 'avocado_toast_egg',
  },
  {
    id: 'meal_bb_cold_brew',
    outletId: 'outlet_brew_bite',
    outletName: '[SAMPLE OUTLET] Brew & Bite Roastery',
    name: '[SAMPLE MEAL] 18-Hour Steeped Vanilla Oat Cold Brew',
    category: 'Beverages & Sides',
    description:
      'Smooth low-acidity single-origin cold brew coffee over crystal ice with a splash of barista oat milk and Madagascar vanilla bean.',
    price: 140,
    isVeg: true,
    isSoldOut: false,
    isPublished: true,
    isSample: true,
    calories: 145,
    prepMinutes: 4,
    imageKey: 'filter_coffee_combo',
  },
];

export const SAMPLE_PICKUP_SLOTS: SampleSlotSeed[] = [
  // Spice Route Express slots (includes 1 FULL slot to demonstrate capacity lock)
  {
    id: 'slot_sr_1215',
    outletId: 'outlet_spice_route',
    label: '12:15 PM – 12:30 PM (Lunch Rush)',
    startTime: '12:15',
    endTime: '12:30',
    maxCapacity: 10,
    bookedCount: 10, // FULL slot for immediate classroom demonstration!
    isActive: true,
  },
  {
    id: 'slot_sr_1230',
    outletId: 'outlet_spice_route',
    label: '12:30 PM – 12:45 PM',
    startTime: '12:30',
    endTime: '12:45',
    maxCapacity: 12,
    bookedCount: 9, // Filling fast (3 spots left)
    isActive: true,
  },
  {
    id: 'slot_sr_1245',
    outletId: 'outlet_spice_route',
    label: '12:45 PM – 01:00 PM',
    startTime: '12:45',
    endTime: '13:00',
    maxCapacity: 15,
    bookedCount: 4,
    isActive: true,
  },

  // Green Bowl Studio slots
  {
    id: 'slot_gb_1215',
    outletId: 'outlet_green_bowl',
    label: '12:15 PM – 12:30 PM',
    startTime: '12:15',
    endTime: '12:30',
    maxCapacity: 8,
    bookedCount: 8, // FULL slot
    isActive: true,
  },
  {
    id: 'slot_gb_1230',
    outletId: 'outlet_green_bowl',
    label: '12:30 PM – 12:45 PM',
    startTime: '12:30',
    endTime: '12:45',
    maxCapacity: 12,
    bookedCount: 5,
    isActive: true,
  },
  {
    id: 'slot_gb_1300',
    outletId: 'outlet_green_bowl',
    label: '01:00 PM – 01:15 PM',
    startTime: '13:00',
    endTime: '13:15',
    maxCapacity: 12,
    bookedCount: 2,
    isActive: true,
  },

  // Dakshin Tiffin Room slots
  {
    id: 'slot_dt_1200',
    outletId: 'outlet_dakshin_tiffin',
    label: '12:00 PM – 12:15 PM',
    startTime: '12:00',
    endTime: '12:15',
    maxCapacity: 15,
    bookedCount: 14, // 1 spot left!
    isActive: true,
  },
  {
    id: 'slot_dt_1215',
    outletId: 'outlet_dakshin_tiffin',
    label: '12:15 PM – 12:30 PM',
    startTime: '12:15',
    endTime: '12:30',
    maxCapacity: 15,
    bookedCount: 6,
    isActive: true,
  },
  {
    id: 'slot_dt_1230',
    outletId: 'outlet_dakshin_tiffin',
    label: '12:30 PM – 12:45 PM',
    startTime: '12:30',
    endTime: '12:45',
    maxCapacity: 15,
    bookedCount: 3,
    isActive: true,
  },

  // Brew & Bite Roastery slots
  {
    id: 'slot_bb_1230',
    outletId: 'outlet_brew_bite',
    label: '12:30 PM – 12:45 PM',
    startTime: '12:30',
    endTime: '12:45',
    maxCapacity: 10,
    bookedCount: 7,
    isActive: true,
  },
  {
    id: 'slot_bb_1245',
    outletId: 'outlet_brew_bite',
    label: '12:45 PM – 01:00 PM',
    startTime: '12:45',
    endTime: '13:00',
    maxCapacity: 12,
    bookedCount: 2,
    isActive: true,
  },
  {
    id: 'slot_bb_1600',
    outletId: 'outlet_brew_bite',
    label: '04:00 PM – 04:15 PM (Evening Break)',
    startTime: '16:00',
    endTime: '16:15',
    maxCapacity: 12,
    bookedCount: 1,
    isActive: true,
  },
];

/**
 * Seeds or resets the classroom sample outlets, meals, and pickup slots in Firestore.
 * Uses two sequential batches so parent `/outlets/{outletId}` documents exist in Firestore
 * before `/menuItems` and `/pickupSlots` verify `exists(/outlets/$(outletId))`.
 */
export async function seedClassroomSampleData(
  vendorUid: string,
  vendorDisplayName: string
): Promise<{ ok: boolean; error?: string }> {
  const safeVendorName = (vendorDisplayName || 'Campus Partner Operator').slice(0, 100);

  // Batch 1: Create/update parent outlets first so `exists()` rules pass on children
  try {
    const outletBatch = writeBatch(db);
    for (const outlet of SAMPLE_OUTLETS) {
      const ref = doc(db, 'outlets', outlet.id);
      outletBatch.set(ref, {
        ...outlet,
        vendorId: vendorUid,
        vendorName: safeVendorName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await outletBatch.commit();
  } catch (err) {
    const msg = handleFirestoreError(err, OperationType.WRITE, 'outlets');
    return { ok: false, error: msg };
  }

  // Batch 2: Create/update sample meals and pickup slots
  try {
    const childBatch = writeBatch(db);
    for (const meal of SAMPLE_MEALS) {
      const ref = doc(db, 'menuItems', meal.id);
      childBatch.set(ref, {
        ...meal,
        vendorId: vendorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const slot of SAMPLE_PICKUP_SLOTS) {
      const ref = doc(db, 'pickupSlots', slot.id);
      childBatch.set(ref, {
        ...slot,
        vendorId: vendorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await childBatch.commit();
    return { ok: true };
  } catch (err) {
    const msg = handleFirestoreError(err, OperationType.WRITE, 'menuItems_and_pickupSlots');
    return { ok: false, error: msg };
  }
}
