/*! onboarding-zoom locale: ja (日本語) */
(function (global) {
  var locale = {
    next: '次へ',
    prev: '戻る',
    finish: '完了',
    skip: '閉じる',
    step: 'ステップ',
    onboarding: 'ガイド'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.ja = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['ja', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
