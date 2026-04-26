/*! onboarding-zoom locale: zh (简体中文 / Simplified Chinese) */
(function (global) {
  var locale = {
    next: '下一步',
    prev: '返回',
    finish: '完成',
    skip: '关闭',
    step: '步骤',
    onboarding: '引导'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.zh = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['zh', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
