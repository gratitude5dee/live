import { supabase } from "@/integrations/supabase/client";

type Row = {
  session_id: string;
  user_id: string;
  kind: "gesture" | "face";
  label: string;
  score: number;
  action: string | null;
  at_ms: number;
};

const FLUSH_MS = 5000;
const CAP = 200;

export class VisionBuffer {
  private buf: Row[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), FLUSH_MS);
  }

  push(r: Row) {
    this.buf.push(r);
    if (this.buf.length >= CAP) this.flush();
  }

  async flush() {
    if (this.buf.length === 0) return;
    const rows = this.buf;
    this.buf = [];
    const { error } = await supabase.from("vision_events").insert(rows);
    if (error) console.warn("vision_events flush failed", error.message);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }
}
