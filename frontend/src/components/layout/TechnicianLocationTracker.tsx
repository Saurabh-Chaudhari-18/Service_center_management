"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/lib/api";

export function TechnicianLocationTracker() {
  const { user, isAuthenticated } = useAuth();
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const updateLocation = async (lat: number, lng: number) => {
      try {
        const token = localStorage.getItem("scm_access_token");
        if (!token) return;
        
        await fetch(`${API_BASE_URL}/core/users/update_location/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ latitude: lat, longitude: lng })
        });
      } catch (err) {
        console.error("Failed to update technician location", err);
      }
    };

    if (isAuthenticated && user?.role === "TECHNICIAN") {
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            updateLocation(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            console.error("Geolocation error:", error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }
    }

    return () => {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isAuthenticated, user]);

  return null;
}
