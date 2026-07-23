// The new /discover root. Mirrors HappyOysterApp exactly (mode above the
// provider, provider keyed on mode, useWorldSession inside) so switching
// experiences remounts a fresh session — but renders the new field UI in
// place of the sidebar+screen layout.

import { useCallback, useState } from "react";
import type { HappyOysterMode } from "@reactor-models/happy-oyster";
import type { WorldIntent } from "@/lib/happy-oyster/worlds";
import { LiveClientProvider } from "@/components/happy-oyster/ho-client";
import { useWorldSession } from "@/components/happy-oyster/use-world-session";
import { FieldRoot } from "./FieldRoot";

export function FieldApp() {
  const [mode, setMode] = useState<HappyOysterMode>("adventure");
  const [intent, setIntent] = useState<WorldIntent | null>(null);

  const run = useCallback((next: WorldIntent) => {
    setMode(next.mode);
    setIntent(next);
  }, []);
  const clearIntent = useCallback(() => setIntent(null), []);

  return (
    <LiveClientProvider mode={mode} key={mode}>
      <FieldBridge intent={intent} onRun={run} onClearIntent={clearIntent} />
    </LiveClientProvider>
  );
}

function FieldBridge({
  intent,
  onRun,
  onClearIntent,
}: {
  intent: WorldIntent | null;
  onRun: (intent: WorldIntent) => void;
  onClearIntent: () => void;
}) {
  const session = useWorldSession({ intent, onRun, onClearIntent });
  return <FieldRoot session={session} />;
}
