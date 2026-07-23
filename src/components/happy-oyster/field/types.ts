import type { FeaturedWorld } from "@/lib/happy-oyster/worlds";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  w: number;
  h: number;
}

export interface WorldPlacement {
  world: FeaturedWorld;
  x: number; // center in virtual field pixels
  y: number;
  size: number;
  seed: number;
  decorative?: boolean;
}
