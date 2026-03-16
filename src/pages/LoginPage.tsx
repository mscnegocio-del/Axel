import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-4 shadow-lg">
        <Auth
          supabaseClient={supabase}
          providers={["google"]}
          view="magic_link"
          appearance={{
            theme: ThemeSupa,
          }}
        />
      </div>
    </div>
  );
}
