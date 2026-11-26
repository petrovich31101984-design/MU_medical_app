import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { setupKeyboardHandling } from "./keyboard";

// Клавиатура телефона не закрывает поле ввода (см. keyboard.ts)
setupKeyboardHandling();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Убрать загрузочный экран СМУ (см. index.html), когда приложение отрисовало что-то,
// кроме собственных экранов загрузки (они помечены атрибутом data-smu-loading).
const rootEl = document.getElementById('root')!;
const splashObserver = new MutationObserver(() => {
  if (!rootEl.childElementCount || rootEl.querySelector('[data-smu-loading]')) return;
  splashObserver.disconnect();
  (window as unknown as { smuHideSplash?: () => void }).smuHideSplash?.();
});
splashObserver.observe(rootEl, { childList: true, subtree: true });

// PWA: service worker сохраняет приложение на телефоне, чтобы оно открывалось и без интернета.
// Только в собранной версии: в режиме разработки кэш мешал бы видеть изменения.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(error => console.error('Не удалось включить работу без интернета:', error));
  });
}
