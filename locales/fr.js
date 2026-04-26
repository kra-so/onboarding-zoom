/*! onboarding-zoom locale: fr (Français) */
(function (global) {
  var locale = {
    next: 'Suivant',
    prev: 'Précédent',
    finish: 'Terminé',
    skip: 'Fermer',
    step: 'Étape',
    onboarding: 'Visite guidée'
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    global.OnboardingZoom.locales.fr = locale;
  } else {
    (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []).push(['fr', locale]);
  }
}(typeof window !== 'undefined' ? window : this));
