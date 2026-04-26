/*! onboarding-zoom locale: ru (Русский) */
(function (global) {
  var locale = {
    next: 'Далее',
    prev: 'Назад',
    finish: 'Готово',
    skip: 'Закрыть',
    step: 'Шаг',
    onboarding: 'Онбординг'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.ru = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['ru', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
