const DEFAULT_UPGRADE_URL = "https://axeldemo.lemonsqueezy.com/checkout"; // placeholder; reemplazar por tu tienda Lemon Squeezy

export default function UpgradePage() {
  const upgradeUrl = import.meta.env.VITE_UPGRADE_URL ?? DEFAULT_UPGRADE_URL;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">Límite de uso alcanzado</h2>
      <p className="text-muted-foreground max-w-sm">
        Has usado todos los tokens de este mes. Actualiza tu plan para seguir
        usando Axel.
      </p>
      <a
        href={upgradeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Ver planes
      </a>
    </div>
  );
}
