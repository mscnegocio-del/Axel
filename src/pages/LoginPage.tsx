import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isOpeningDialog, setIsOpeningDialog] = useState(false);

  const handleOpenDialog = useCallback(() => {
    setError(null);

    if (typeof Office === "undefined" || !Office.context?.ui) {
      setError("Este login solo está disponible dentro de Excel.");
      return;
    }

    setIsOpeningDialog(true);
    const url = "https://axel.habla.cloud/auth-dialog.html";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Office.context.ui as any).displayDialogAsync(
      url,
      { height: 60, width: 40, displayInIframe: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (asyncResult: any) => {
        setIsOpeningDialog(false);
        if (asyncResult.status !== Office.AsyncResultStatus.Succeeded) {
          setError("No se pudo abrir la ventana de inicio de sesión.");
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dialog = asyncResult.value as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onMessage = async (arg: any) => {
          try {
            const payload = JSON.parse(arg.message) as {
              access_token?: string;
              refresh_token?: string;
            };
            if (!payload.access_token || !payload.refresh_token) {
              throw new Error("Respuesta de autenticación inválida.");
            }

            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: payload.access_token,
              refresh_token: payload.refresh_token,
            });
            if (setSessionError) {
              throw setSessionError;
            }

            dialog.close();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Error al procesar el inicio de sesión: ${msg}`);
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onDialogError = (event: any) => {
          setError(
            `Error en la ventana de inicio de sesión (código ${event.error}).`
          );
        };

        dialog.addEventHandler(
          Office.EventType.DialogMessageReceived,
          onMessage
        );
        dialog.addEventHandler(
          Office.EventType.DialogEventReceived,
          onDialogError
        );
      }
    );
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-6 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold">Axel</h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesión para usar el asistente de IA en tus hojas de cálculo de Excel.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenDialog}
          disabled={isOpeningDialog}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isOpeningDialog ? "Abriendo..." : "Log in"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          El inicio de sesión se realiza en una ventana segura utilizando tu cuenta de Google o correo electrónico.
        </p>
      </div>
    </div>
  );
}
