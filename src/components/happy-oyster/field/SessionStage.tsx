import type { WorldSession } from "@/components/happy-oyster/use-world-session";
import { JourneyBlob } from "./JourneyBlob";
import { TravelStage } from "./TravelStage";
import { EndBlob } from "./EndBlob";
import { ErrorBlob } from "./ErrorBlob";

export function SessionStage({ session }: { session: WorldSession }) {
  const view = session.view;
  if (view.kind === "browse") return null;
  if (view.kind === "connecting" || view.kind === "building") {
    return <JourneyBlob session={session} />;
  }
  if (view.kind === "traveling") return <TravelStage session={session} />;
  if (view.kind === "ready") return <EndBlob session={session} />;
  if (view.kind === "error") return <ErrorBlob session={session} />;
  return null;
}
