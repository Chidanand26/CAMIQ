import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type MapViewT from "./MapView";
export type { MapMarker } from "./MapView";

const MapView = lazy(() => import("./MapView"));

export function Map(props: ComponentProps<typeof MapViewT>) {
  const fb = <div style={{ height: props.height ?? 360 }} className="w-full animate-pulse rounded-xl bg-muted" />;
  return (
    <ClientOnly fallback={fb}>
      <Suspense fallback={fb}>
        <MapView {...props} />
      </Suspense>
    </ClientOnly>
  );
}
