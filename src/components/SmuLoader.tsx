// Загрузочный экран СМУ внутри приложения — та же анимация, что и в index.html
// (стили .smu-* лежат там же). Атрибут data-smu-loading не даёт стартовому экрану
// исчезнуть, пока приложение показывает этот загрузчик.
export default function SmuLoader() {
  return (
    <div data-smu-loading className="smu-splash" role="status" aria-label="Загрузка СМУ">
      <svg viewBox="0 0 512 512" aria-hidden="true">
        <g className="smu-logo">
          <rect className="smu-frame" x="24" y="24" width="464" height="464" rx="108" fill="#FFFFFF" stroke="#1C1F24" strokeWidth="16" />
          <rect className="smu-block smu-b1" x="201" y="325" width="110" height="110" rx="24" fill="#0202FA" />
          <rect className="smu-block smu-b2" x="77" y="201" width="110" height="110" rx="24" fill="#0202FA" />
          <rect className="smu-block smu-b3" x="325" y="201" width="110" height="110" rx="24" fill="#0202FA" />
          <rect className="smu-block smu-b4" x="201" y="201" width="110" height="110" rx="24" fill="#FA0202" />
          <rect className="smu-block smu-b5" x="201" y="77" width="110" height="110" rx="24" fill="#0202FA" />
        </g>
      </svg>
      <p className="smu-title"><span>С</span><span>М</span><span>У</span></p>
      <p className="smu-sub">Система медицинского учёта <span className="smu-ver">(v.0.5.5)</span></p>
    </div>
  );
}
