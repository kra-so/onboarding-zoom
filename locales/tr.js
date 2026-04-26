/*! onboarding-zoom locale: tr (Türkçe) */
(function (global) {
  var locale = {
    next: 'İleri',
    prev: 'Geri',
    finish: 'Bitti',
    skip: 'Kapat',
    step: 'Adım',
    onboarding: 'Tanıtım'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.tr = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['tr', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
