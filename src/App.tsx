import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useTokenUsage } from "./hooks/useTokenUsage";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import UpgradePage from "./pages/UpgradePage";
import { supabase } from "./lib/supabase";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const usage = useTokenUsage();
  const [limitExceededFromChat, setLimitExceededFromChat] = useState(false);
  const limitExceeded = usage.limitExceeded || limitExceededFromChat;

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    };
    void init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession ?? null);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground">Cargando…</span>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  if (limitExceeded) {
    return <UpgradePage />;
  }

  return (
    <ChatPage
      tier={usage.tier}
      tokensUsed={usage.tokensUsed}
      tokensLimit={usage.limit}
      tokensLoading={usage.isLoading}
      onLimitExceeded={() => setLimitExceededFromChat(true)}
      tokenUsageRefetch={usage.refetch}
    />
  );
}

export default App;
