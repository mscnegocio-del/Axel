import { useAuth } from "@clerk/react";
import { useState } from "react";
import { useTokenUsage } from "./hooks/useTokenUsage";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import UpgradePage from "./pages/UpgradePage";

function App() {
  const { isSignedIn, isLoaded } = useAuth();
  const usage = useTokenUsage();
  const [limitExceededFromChat, setLimitExceededFromChat] = useState(false);
  const limitExceeded = usage.limitExceeded || limitExceededFromChat;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground">Cargando…</span>
      </div>
    );
  }

  if (!isSignedIn) {
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
