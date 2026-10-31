import React from 'react';

interface MealArtworkProps {
  imageKey: string;
  title: string;
  className?: string;
}

export const MealArtwork: React.FC<MealArtworkProps> = ({ imageKey, title, className = '' }) => {
  switch (imageKey) {
    case 'paneer_tikka_bowl':
      return (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-amber-100 via-orange-50 to-stone-100 flex items-center justify-center ${className}`}
          role="img"
          aria-label={title}
        >
          <svg viewBox="0 0 320 220" className="w-full h-full object-cover" fill="none">
            <rect width="320" height="220" fill="url(#pt_bg)" />
            <circle cx="160" cy="115" r="76" fill="#292524" />
            <circle cx="160" cy="112" r="68" fill="#FEF3C7" />
            {/* Saffron rice texture */}
            <circle cx="135" cy="98" r="22" fill="#FDE68A" />
            <circle cx="178" cy="122" r="26" fill="#FCD34D" opacity="0.6" />
            {/* Charred Paneer Tikka cubes */}
            <rect x="118" y="82" width="24" height="22" rx="5" transform="rotate(-10 118 82)" fill="#EA580C" />
            <rect x="122" y="86" width="8" height="5" rx="2" fill="#7C2D12" />
            <rect x="150" y="76" width="25" height="23" rx="5" transform="rotate(8 150 76)" fill="#D97706" />
            <rect x="156" y="80" width="9" height="5" rx="2" fill="#78350F" />
            <rect x="176" y="96" width="24" height="22" rx="5" transform="rotate(-6 176 96)" fill="#EA580C" />
            <rect x="134" y="114" width="24" height="22" rx="5" transform="rotate(12 134 114)" fill="#C2410C" />
            {/* Mint chutney swirl & pickled onions */}
            <path d="M114 128 C135 148, 175 148, 198 124" stroke="#15803D" strokeWidth="5" strokeLinecap="round" />
            <circle cx="168" cy="136" r="10" stroke="#BE185D" strokeWidth="3" fill="none" />
            <circle cx="122" cy="112" r="6" fill="#16A34A" />
            <circle cx="192" cy="88" r="5" fill="#15803D" />
            <defs>
              <linearGradient id="pt_bg" x1="0" y1="0" x2="320" y2="220" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFBEB" />
                <stop offset="1" stopColor="#F5F5F4" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      );

    case 'rajma_chawal_bowl':
      return (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-rose-50 via-amber-50 to-stone-100 flex items-center justify-center ${className}`}
          role="img"
          aria-label={title}
        >
          <svg viewBox="0 0 320 220" className="w-full h-full object-cover" fill="none">
            <rect width="320" height="220" fill="#FAF8F5" />
            <circle cx="160" cy="112" r="74" fill="#1C1917" />
            <circle cx="160" cy="110" r="66" fill="#FFFBEB" />
            {/* Half masala rajma curry, half jeera basmati */}
            <path d="M160 44 A66 66 0 0 0 160 176 Z" fill="#9A3412" />
            <ellipse cx="132" cy="92" rx="9" ry="6" fill="#431407" />
            <ellipse cx="142" cy="115" rx="10" ry="6" fill="#7C2D12" />
            <ellipse cx="125" cy="132" rx="9" ry="5" fill="#431407" />
            {/* Fresh coriander & ginger juliennes */}
            <circle cx="140" cy="102" r="5" fill="#16A34A" />
            <circle cx="182" cy="96" r="3" fill="#78716C" />
            <circle cx="192" cy="118" r="3" fill="#78716C" />
            <circle cx="176" cy="130" r="3" fill="#78716C" />
          </svg>
        </div>
      );

    case 'chole_kulche':
      return (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-orange-50 flex items-center justify-center ${className}`}
          role="img"
          aria-label={title}
        >
          <svg viewBox="0 0 320 220" className="w-full h-full object-cover" fill="none">
            <rect width="320" height="220" fill="#F5F5F4" />
            <rect x="48" y="36" width="224" height="148" rx="24" fill="#292524" />
            {/* Baked Kulcha breads */}
            <ellipse cx="122" cy="112" rx="48" ry="36" transform="rotate(-12 122 112)" fill="#FDE68A" />
            <ellipse cx="132" cy="122" rx="46" ry="34" transform="rotate(8 132 122)" fill="#FCD34D" />
            <circle cx="120" cy="116" r="4" fill="#92400E" />
            <circle cx="140" cy="126" r="5" fill="#78350F" />
            <circle cx="130" cy="108" r="3" fill="#15803D" />
            {/* Pindi Chole bowl */}
            <circle cx="212" cy="104" r="36" fill="#44403C" />
            <circle cx="212" cy="104" r="30" fill="#9A3412" />
            <circle cx="204" cy="98" r="6" fill="#D97706" />
            <circle cx="220" cy="108" r="6" fill="#B45309" />
            <circle cx="210" cy="114" r="5" fill="#D97706" />
          </svg>
        </div>
      );

    case 'crispy_chicken_wrap':
    case 'mediterranean_falafel_wrap':
      return (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50 flex items-center justify-center ${className}`}
          role="img"
          aria-label={title}
        >
          <svg viewBox="0 0 320 220" className="w-full h-full object-cover" fill="none">
            <rect width="320" height="220" fill="#F5F5F4" />
            <circle cx="160" cy="110" r="76" fill="#E7E5E4" />
            {/* Diagonal tortilla wrap halves */}
            <rect x="88" y="68" width="68" height="94" rx="18" transform="rotate(-18 88 68)" fill="#FDE68A" stroke="#D97706" strokeWidth="3" />
            <ellipse cx="116" cy="76" rx="28" ry="14" transform="rotate(-18 116 76)" fill="#15803D" />
            <circle cx="114" cy="76" r="9" fill="#EA580C" />
            <rect x="158" y="62" width="68" height="94" rx="18" transform="rotate(14 158 62)" fill="#FCD34D" stroke="#D97706" strokeWidth="3" />
            <ellipse cx="190" cy="72" rx="28" ry="14" transform="rotate(14 190 72)" fill="#16A34A" />
            <circle cx="188" cy="72" r="9" fill="#B45309" />
            {/* Dip cup */}
            <circle cx="160" cy="154" r="20" fill="#292524" />
            <circle cx="160" cy="154" r="15" fill="#ECFCCB" />
          </svg>
        </div>
      );

    case 'avocado_toast_egg':
    case 'protein_quinoa_salad':
      return (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-lime-50 via-emerald-50 to-stone-100 flex items-center justify-center ${className}`}
          role="img"
          aria-label={title}
        >
          <svg viewBox="0 0 320 220" className="w-full h-full object-cover" fill="none">
            <rect width="320" height="220" fill="#F7FEE7" />
            <circle cx="160" cy="110" r="72" fill="#292524" />
            <circle cx="160" cy="110" r="64" fill="#ECFCCB" />
            {/* Greens, avocado slices & poached topper */}
            <path d="M112 104 C128 76, 178 76, 204 108 C184 142, 132 142, 112 104 Z" fill="#65A30D" />
            <circle cx="145" cy="108" r="20" fill="#FEFCE8" />
            <circle cx="145" cy="108" r="10" fill="#F59E0B" />
            <circle cx="182" cy="114" r="14" fill="#15803D" />
            <circle cx="174" cy="92" r="6" fill="#DC2626" />
            <circle cx="192" cy="128" r="6" fill="#DC2626" />
          </svg>
        </div>
      );

    case 'masala_dosa_platter':
    case 'idli_vada_tiffin':
      return (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-amber-50 via-yellow-50 to-stone-100 flex items-center justify-center ${className}`}
          role="img"
          aria-label={title}
        >
          <svg viewBox="0 0 320 220" className="w-full h-full object-cover" fill="none">
            <rect width="320" height="220" fill="#FFFBEB" />
            {/* Banana leaf & steel tray */}
            <rect x="36" y="34" width="248" height="152" rx="28" fill="#15803D" />
            <rect x="44" y="42" width="232" height="136" rx="22" fill="#166534" />
            {/* Golden crispy Masala Dosa */}
            <path d="M58 128 L256 96 L246 154 L66 158 Z" fill="#D97706" />
            <path d="M64 130 L248 102 L240 146 L70 150 Z" fill="#F59E0B" />
            {/* 3 Chutney & Sambar katoris */}
            <circle cx="96" cy="74" r="20" fill="#E7E5E4" />
            <circle cx="96" cy="74" r="15" fill="#FAFAF9" />
            <circle cx="152" cy="70" r="20" fill="#E7E5E4" />
            <circle cx="152" cy="70" r="15" fill="#EA580C" />
            <circle cx="208" cy="70" r="22" fill="#E7E5E4" />
            <circle cx="208" cy="70" r="17" fill="#B45309" />
          </svg>
        </div>
      );

    case 'berry_acai_bowl':
    case 'filter_coffee_combo':
    default:
      return (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-stone-100 via-amber-50 to-orange-50 flex items-center justify-center ${className}`}
          role="img"
          aria-label={title}
        >
          <svg viewBox="0 0 320 220" className="w-full h-full object-cover" fill="none">
            <rect width="320" height="220" fill="#FAF8F5" />
            <circle cx="132" cy="116" r="62" fill="#292524" />
            <circle cx="132" cy="116" r="54" fill="#831843" />
            {/* Sliced banana & granola rows */}
            <circle cx="112" cy="96" r="10" fill="#FEF08A" />
            <circle cx="126" cy="92" r="10" fill="#FEF08A" />
            <circle cx="142" cy="94" r="10" fill="#FEF08A" />
            <circle cx="116" cy="128" r="6" fill="#D97706" />
            <circle cx="132" cy="134" r="7" fill="#B45309" />
            <circle cx="148" cy="126" r="6" fill="#D97706" />
            {/* Cold brew cup */}
            <rect x="214" y="64" width="48" height="96" rx="12" fill="#78350F" />
            <rect x="218" y="70" width="40" height="32" rx="6" fill="#FDE68A" opacity="0.85" />
            <line x1="244" y1="42" x2="236" y2="86" stroke="#1C1917" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
      );
  }
};
