/*! onboarding-zoom locale: ar (العربية) */
/*  Note: text is translated, but layout is LTR by default. For full RTL support
    set dir="rtl" on the page (or HUD root) — the library inherits direction. */
(function (global) {
  var locale = {
    next: 'التالي',
    prev: 'السابق',
    finish: 'تم',
    skip: 'إغلاق',
    step: 'خطوة',
    onboarding: 'جولة تعريفية'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.ar = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['ar', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
