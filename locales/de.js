/*! onboarding-zoom locale: de (Deutsch) */
(function (global) {
  var locale = {
    next: 'Weiter',
    prev: 'Zurück',
    finish: 'Fertig',
    skip: 'Schließen',
    step: 'Schritt',
    onboarding: 'Einführung'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.de = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['de', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
