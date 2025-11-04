import { rainfallAPI } from "@/lib/rainfall-api";
import { LocationInfo } from "@/types/rainfall";
import { useEffect, useState } from "react";

export function useLocations() {
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        setLoading(true);
        const data = await rainfallAPI.getLocations();
        setLocations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load locations');
      } finally {
        setLoading(false);
      }
    };

    loadLocations();
  }, []);

  return { locations, loading, error };
}
