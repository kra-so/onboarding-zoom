/*! onboarding-zoom locale: cs (Čeština) */
(function (global) {
  var locale = {
    next: 'Další',
    prev: 'Zpět',
    finish: 'Hotovo',
    skip: 'Zavřít',
    step: 'Krok',
    onboarding: 'Průvodce'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.cs = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['cs', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
