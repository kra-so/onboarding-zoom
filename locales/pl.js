/*! onboarding-zoom locale: pl (Polski) */
(function (global) {
  var locale = {
    next: 'Dalej',
    prev: 'Wstecz',
    finish: 'Gotowe',
    skip: 'Zamknij',
    step: 'Krok',
    onboarding: 'Wprowadzenie'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.pl = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['pl', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
