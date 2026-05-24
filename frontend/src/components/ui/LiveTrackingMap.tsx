import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import Leaflet map, avoiding SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <MapLoadingState /> }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

function MapLoadingState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 text-neutral-500 min-h-[300px]">
      <Loader2 className="w-8 h-8 animate-spin mb-2" />
      <p>Loading Map...</p>
    </div>
  );
}

interface LiveTrackingMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  label?: string;
  updateTime?: string;
}

export function LiveTrackingMap({ latitude, longitude, zoom = 15, label = "Technician", updateTime }: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Import leaflet css
    import("leaflet/dist/leaflet.css");
    import("leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css");
    // @ts-expect-error Module without type declarations
    import("leaflet-defaulticon-compatibility");
  }, []);

  if (!mounted) return <MapLoadingState />;

  return (
    <div className="w-full h-full min-h-[300px] border border-neutral-200 rounded-xl overflow-hidden relative shadow-inner z-0">
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ width: "100%", height: "100%", minHeight: "300px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]}>
          <Popup>
            <div className="text-sm font-medium">{label} is here</div>
            {updateTime && (
              <div className="text-xs text-neutral-500 mt-1">
                Last updated: {new Date(updateTime).toLocaleTimeString()}
              </div>
            )}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
