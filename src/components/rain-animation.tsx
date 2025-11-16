'use client';

import { useEffect, useRef } from 'react';

export function RainAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createRainDrop = () => {
      const drop = document.createElement('div');
      const size = Math.random() * 4 + 2; // 2-6px
      const duration = Math.random() * 1 + 0.8; // 0.8-1.8s
      const delay = Math.random() * 2;
      const startLeft = Math.random() * 100;

      drop.className = 'rain-drop';
      drop.style.width = `${size}px`;
      drop.style.height = `${size * 3}px`;
      drop.style.left = `${startLeft}%`;
      drop.style.top = '0';
      drop.style.animation = `rainDrop ${duration}s linear ${delay}s infinite`;

      container.appendChild(drop);

      // Remove old drops to prevent memory leak
      setTimeout(() => drop.remove(), (duration + delay + 2) * 1000);
    };

    // Create drops continuously
    const interval = setInterval(createRainDrop, 100);

    // Initial batch
    for (let i = 0; i < 30; i++) {
      createRainDrop();
    }

    return () => clearInterval(interval);
  }, []);

  return <div ref={containerRef} className="rain-container" />;
}
