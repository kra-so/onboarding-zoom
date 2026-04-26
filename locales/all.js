/*! onboarding-zoom locales: all bundled */
(function (global) {
  var L = {
    en: { next: 'Next', prev: 'Back', finish: 'Done', skip: 'Close', step: 'Step', onboarding: 'Onboarding' },
    ru: { next: 'Далее', prev: 'Назад', finish: 'Готово', skip: 'Закрыть', step: 'Шаг', onboarding: 'Онбординг' },
    uk: { next: 'Далі', prev: 'Назад', finish: 'Готово', skip: 'Закрити', step: 'Крок', onboarding: 'Знайомство' },
    es: { next: 'Siguiente', prev: 'Atrás', finish: 'Listo', skip: 'Cerrar', step: 'Paso', onboarding: 'Recorrido' },
    de: { next: 'Weiter', prev: 'Zurück', finish: 'Fertig', skip: 'Schließen', step: 'Schritt', onboarding: 'Einführung' },
    fr: { next: 'Suivant', prev: 'Précédent', finish: 'Terminé', skip: 'Fermer', step: 'Étape', onboarding: 'Visite guidée' },
    it: { next: 'Avanti', prev: 'Indietro', finish: 'Fatto', skip: 'Chiudi', step: 'Passo', onboarding: 'Tour' },
    pt: { next: 'Próximo', prev: 'Voltar', finish: 'Concluir', skip: 'Fechar', step: 'Etapa', onboarding: 'Tour' },
    pl: { next: 'Dalej', prev: 'Wstecz', finish: 'Gotowe', skip: 'Zamknij', step: 'Krok', onboarding: 'Wprowadzenie' },
    cs: { next: 'Další', prev: 'Zpět', finish: 'Hotovo', skip: 'Zavřít', step: 'Krok', onboarding: 'Průvodce' },
    tr: { next: 'İleri', prev: 'Geri', finish: 'Bitti', skip: 'Kapat', step: 'Adım', onboarding: 'Tanıtım' },
    nl: { next: 'Volgende', prev: 'Terug', finish: 'Klaar', skip: 'Sluiten', step: 'Stap', onboarding: 'Rondleiding' },
    zh: { next: '下一步', prev: '返回', finish: '完成', skip: '关闭', step: '步骤', onboarding: '引导' },
    ja: { next: '次へ', prev: '戻る', finish: '完了', skip: '閉じる', step: 'ステップ', onboarding: 'ガイド' },
    ko: { next: '다음', prev: '이전', finish: '완료', skip: '닫기', step: '단계', onboarding: '안내' },
    ar: { next: 'التالي', prev: 'السابق', finish: 'تم', skip: 'إغلاق', step: 'خطوة', onboarding: 'جولة تعريفية' }
  };
  if (global.OnboardingZoom && global.OnboardingZoom.locales) {
    Object.keys(L).forEach(function (k) { global.OnboardingZoom.locales[k] = L[k]; });
  } else {
    var q = (global.__OZ_LOCALES_PENDING__ = global.__OZ_LOCALES_PENDING__ || []);
    Object.keys(L).forEach(function (k) { q.push([k, L[k]]); });
  }
}(typeof window !== 'undefined' ? window : this));
