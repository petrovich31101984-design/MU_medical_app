// Экранная клавиатура телефона не должна закрывать поле ввода.
//  - Поле, в которое нажали, прокручивается в видимую часть экрана над клавиатурой.
//  - Видимая высота экрана (без клавиатуры) хранится в CSS-переменной --vvh, её сдвиг — в --vv-top:
//    по ним окна (модальные) ужимаются до видимой части, а не уходят под клавиатуру.
//  - Пока клавиатура открыта, на <html> висит класс keyboard-open.
// Android дополнительно ужимает страницу сам (interactive-widget=resizes-content в index.html),
// iPhone так не умеет — для него и нужна эта прокрутка.

// Поля, для которых открывается клавиатура (выпадающие списки и кнопки — нет)
const KEYBOARD_FIELDS =
  'input:not([readonly]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="date"]), textarea:not([readonly]), [contenteditable="true"]';

const isKeyboardField = (element: Element | null): element is HTMLElement =>
  !!element && element instanceof HTMLElement && element.matches(KEYBOARD_FIELDS);

export function setupKeyboardHandling() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  // Высота экрана без клавиатуры: самая большая из замеченных (сбрасывается при повороте)
  let fullHeight = viewport?.height ?? window.innerHeight;
  let scrollTimer = 0;

  const scrollFieldIntoView = () => {
    const field = document.activeElement;
    if (!isKeyboardField(field)) return;
    // В чате поле уже прижато к низу экрана — прокручиваем только если его не видно
    const rect = field.getBoundingClientRect();
    const visibleTop = viewport?.offsetTop ?? 0;
    const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
    if (rect.top >= visibleTop + 8 && rect.bottom <= visibleBottom - 8) return;
    // Без плавной прокрутки: её перебивали события прокрутки, и поле долго оставалось под клавиатурой
    field.scrollIntoView({ block: 'center' });
  };

  const scheduleScroll = (delay: number) => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(scrollFieldIntoView, delay);
  };

  let lastHeight = 0;
  const update = () => {
    const height = viewport?.height ?? window.innerHeight;
    const heightChanged = Math.abs(height - lastHeight) > 1;
    lastHeight = height;
    fullHeight = Math.max(fullHeight, height);
    root.style.setProperty('--vvh', `${Math.round(height)}px`);
    root.style.setProperty('--vv-top', `${Math.round(viewport?.offsetTop ?? 0)}px`);
    const keyboardOpen = isKeyboardField(document.activeElement) && fullHeight - height > 120;
    root.classList.toggle('keyboard-open', keyboardOpen);
    // Прокручиваем, только когда клавиатура открылась или поменяла высоту — не на каждую прокрутку
    if (keyboardOpen && heightChanged) scheduleScroll(50);
  };

  update();
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => {
    fullHeight = 0;
    window.setTimeout(update, 300);
  });

  // Клавиатура выезжает ~300 мс — прокручиваем после этого (и ещё раз, если она открывалась дольше)
  document.addEventListener('focusin', event => {
    if (!isKeyboardField(event.target as Element)) return;
    scheduleScroll(350);
    window.setTimeout(update, 600);
  });
  document.addEventListener('focusout', () => window.setTimeout(update, 100));
}
