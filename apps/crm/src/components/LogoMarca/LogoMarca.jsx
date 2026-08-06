// src/components/LogoMarca/LogoMarca.jsx

export default function LogoMarca({ size = 36, variant = 'icon' }) {
  if (variant === 'icon') {
    return (
      <img
        src="/brand/simbolo-verde-interior.svg"
        alt="Verde Interior"
        style={{ height: size, width: 'auto', display: 'block' }}
      />
    );
  }

  return (
    <img
      src="/brand/logo-verde-interior.svg"
      alt="Verde Interior"
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  );
}
