/*! onboarding-zoom locale: uk (Українська) */
(function (global) {
  var locale = {
    next: 'Далі',
    prev: 'Назад',
    finish: 'Готово',
    skip: 'Закрити',
    step: 'Крок',
    onboarding: 'Знайомство'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.uk = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['uk', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
