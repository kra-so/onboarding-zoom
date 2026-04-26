/*! onboarding-zoom locale: it (Italiano) */
(function (global) {
  var locale = {
    next: 'Avanti',
    prev: 'Indietro',
    finish: 'Fatto',
    skip: 'Chiudi',
    step: 'Passo',
    onboarding: 'Tour'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.it = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['it', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
