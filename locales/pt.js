/*! onboarding-zoom locale: pt (Português) */
(function (global) {
  var locale = {
    next: 'Próximo',
    prev: 'Voltar',
    finish: 'Concluir',
    skip: 'Fechar',
    step: 'Etapa',
    onboarding: 'Tour'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.pt = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['pt', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
