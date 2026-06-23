// src/components/LogoMarca/LogoMarca.jsx

export default function LogoMarca({ size = 36, variant = 'icon' }) {
  /*
   * Fiel ao ícone enviado:
   * - Diamante escuro (#3D0D0D)
   * - 4 folhas ovais verdes (#4A8828) apontando N/L/S/O
   * - Elipses rotacionadas — forma oval arredondada, não pontuda
   * - Círculo central escuro cobrindo a junção
   */
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Diamante */}
      <polygon points="50,2 98,50 50,98 2,50" fill="#3D0D0D" />

      {/* Folha Norte */}
      <ellipse cx="50" cy="29" rx="12" ry="20" fill="#4A8828" />
      {/* Folha Leste */}
      <ellipse cx="50" cy="29" rx="12" ry="20" fill="#4A8828" transform="rotate(90 50 50)" />
      {/* Folha Sul */}
      <ellipse cx="50" cy="29" rx="12" ry="20" fill="#4A8828" transform="rotate(180 50 50)" />
      {/* Folha Oeste */}
      <ellipse cx="50" cy="29" rx="12" ry="20" fill="#4A8828" transform="rotate(270 50 50)" />

      {/* Círculo central */}
      <circle cx="50" cy="50" r="10" fill="#3D0D0D" />
    </svg>
  );

  if (variant === 'icon') return mark;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      {mark}
      <div style={{ lineHeight: 1.15 }}>
        <div style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: size * 0.50,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.01em',
        }}>
          Verde
        </div>
        <div style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: size * 0.26,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.16em',
          textTransform: 'lowercase',
        }}>
          interior
        </div>
      </div>
    </div>
  );
}
