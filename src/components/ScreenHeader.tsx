import React from 'react';

// Кнопки-«таблетки» в шапке: общий вид, разный цвет
const pillBase =
  'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold shadow-sm transition-all ' +
  'active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';
/** «Назад» — голубая */
export const backButtonClass =
  `${pillBase} border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-200 active:bg-blue-200 focus-visible:ring-blue-400`;
/** «Выйти» — такая же, красная */
export const logoutButtonClass =
  `${pillBase} border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-200 active:bg-red-200 focus-visible:ring-red-400`;

interface ScreenHeaderProps {
  title: React.ReactNode;
  /** Иконка раздела — та же, что на главном экране */
  icon?: string;
  onBack?: () => void;
  /** Необязательная кнопка справа (например, обновление) */
  right?: React.ReactNode;
}

/**
 * Шапка раздела: «← Назад» слева, название с иконкой строго по центру экрана.
 * Боковые колонки одинаковой ширины, поэтому название остаётся по центру
 * независимо от того, что находится слева и справа.
 */
export default function ScreenHeader({ title, icon, onBack, right }: ScreenHeaderProps) {
  return (
    <div className="bg-white px-2 py-4 border-b border-slate-200 grid grid-cols-[4.25rem_1fr_4.25rem] items-center gap-1">
      <div className="justify-self-start">
        {onBack && (
          <button
            onClick={onBack}
            className={backButtonClass}
          >
            Назад
          </button>
        )}
      </div>
      {/* 18px, на узких экранах чуть меньше; длинные названия переносятся ровно на 2 строки */}
      <h1
        className="font-bold text-slate-800 text-center leading-tight"
        style={{ fontSize: 'min(1.125rem, 5vw)', textWrap: 'balance' } as React.CSSProperties}
      >
        {icon && <span className="mr-1.5" aria-hidden="true">{icon}</span>}
        {title}
      </h1>
      <div className="justify-self-end">{right}</div>
    </div>
  );
}
