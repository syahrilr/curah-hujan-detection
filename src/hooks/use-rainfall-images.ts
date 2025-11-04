import { rainfallAPI } from "@/lib/rainfall-api";
import { RainfallImageData } from "@/types/rainfall";
import { useCallback, useEffect, useState } from "react";

export function useRainfallImages() {
  const [images, setImages] = useState<RainfallImageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const imageData = await rainfallAPI.getAllImagesBase64();
      setImages(imageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  return { images, loading, error, reload: loadImages };
}
