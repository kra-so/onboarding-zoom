/*! onboarding-zoom locale: nl (Nederlands) */
(function (global) {
  var locale = {
    next: 'Volgende',
    prev: 'Terug',
    finish: 'Klaar',
    skip: 'Sluiten',
    step: 'Stap',
    onboarding: 'Rondleiding'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.nl = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['nl', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
