/*! onboarding-zoom locale: ko (한국어) */
(function (global) {
  var locale = {
    next: '다음',
    prev: '이전',
    finish: '완료',
    skip: '닫기',
    step: '단계',
    onboarding: '안내'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.ko = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['ko', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
