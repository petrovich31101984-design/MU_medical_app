import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

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
