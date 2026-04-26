/*! onboarding-zoom locale: es (Español) */
(function (global) {
  var locale = {
    next: 'Siguiente',
    prev: 'Atrás',
    finish: 'Listo',
    skip: 'Cerrar',
    step: 'Paso',
    onboarding: 'Recorrido'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.es = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['es', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
