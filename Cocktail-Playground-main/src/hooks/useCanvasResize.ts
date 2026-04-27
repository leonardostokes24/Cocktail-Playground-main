import React, { useEffect, useState, useCallback, useRef } from 'react';

export interface CanvasDimensions {
  width: number;
  height: number;
}

/**
 * Hook to track canvas container size changes using ResizeObserver
 * This is critical for responsive node parenting calculations
 */
export const useCanvasResize = (ref: React.RefObject<HTMLDivElement>) => {
  const [canvasDims, setCanvasDims] = useState<CanvasDimensions>(() => {
    if (ref.current) {
      return {
        width: ref.current.clientWidth,
        height: ref.current.clientHeight,
      };
    }
    return { width: 1024, height: 768 };
  });

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!ref.current) {
      return;
    }

    // Create ResizeObserver to track canvas size changes
    const observer = new ResizeObserver((entries) => {
      if (entries.length === 0) return;

      const { width, height } = entries[0].contentRect;

      // Only update if dimensions actually changed
      setCanvasDims((prev) => {
        if (prev.width !== width || prev.height !== height) {
          if (isMountedRef.current) {
            return { width, height };
          }
        }
        return prev;
      });
    });

    // Start observing
    observer.observe(ref.current);

    // Initial measurement
    const rect = ref.current.getBoundingClientRect();
    if (isMountedRef.current) {
      setCanvasDims({
        width: rect.width,
        height: rect.height,
      });
    }

    return () => {
      isMountedRef.current = false;
      observer.disconnect();
    };
  }, [ref]);

  return canvasDims;
};

/**
 * Hook to get computed style of an element (for measuring node positions, etc)
 */
export const useElementSize = (ref: React.RefObject<HTMLElement>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries.length === 0 || !isMountedRef.current) return;

      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    observer.observe(ref.current);

    // Initial measurement
    const rect = ref.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    return () => {
      isMountedRef.current = false;
      observer.disconnect();
    };
  }, [ref]);

  return size;
};

/**
 * Hook to throttle callback executions during resize events
 * Useful for expensive operations that shouldn't run on every resize
 */
export const useThrottledResize = (
  callback: (width: number, height: number) => void,
  delay: number = 200
) => {
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCallRef = useRef<number>(0);

  const throttledCallback = useCallback(
    (width: number, height: number) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(width, height);
      } else {
        // Schedule callback for later
        if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current);
        }
        throttleTimeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(width, height);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
};
