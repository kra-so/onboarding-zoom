/*! onboarding-zoom locale: en (English) */
(function (global) {
  var locale = {
    next: 'Next',
    prev: 'Back',
    finish: 'Done',
    skip: 'Close',
    step: 'Step',
    onboarding: 'Onboarding'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.en = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['en', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
