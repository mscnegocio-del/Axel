import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://axel.habla.cloud",
        skipBrowserRedirect: false,
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-4 shadow-lg">
        <button
          type="button"
          onClick={() => {
            void handleGoogleLogin();
          }}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Continuar con Google
        </button>
        <div className="h-px w-full bg-border" />
        <p className="text-xs text-muted-foreground">
          O entra con tu correo (magic link):
        </p>
        <Auth
          supabaseClient={supabase}
          providers={[]}
          view="magic_link"
          appearance={{
            theme: ThemeSupa,
          }}
        />
      </div>
    </div>
  );
}
