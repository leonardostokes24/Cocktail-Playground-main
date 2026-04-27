import { useState, useEffect, useCallback } from 'react';
import { BREAKPOINTS, getBreakpoint, getSidebarStrategy, type Breakpoint } from '../utils/responsive';

export interface ResponsiveDimensions {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscapeMobile: boolean;
  sidebarStrategy: ReturnType<typeof getSidebarStrategy>;
}

/**
 * Hook to track responsive dimensions and breakpoints
 * Updates on window resize and provides current breakpoint information
 */
export const useResponsive = (): ResponsiveDimensions => {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  // Handle resize with debouncing to avoid excessive updates
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      // Clear existing timeout
      clearTimeout(resizeTimeout);
      
      // Debounce resize events (100ms)
      resizeTimeout = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    // Use ResizeObserver for better accuracy if available
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    // Also listen to window resize as fallback
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, []);

  const breakpoint = getBreakpoint(dimensions.width);
  const isMobile = dimensions.width < BREAKPOINTS.tablet;
  const isTablet =
    dimensions.width >= BREAKPOINTS.tablet &&
    dimensions.width < BREAKPOINTS.desktop;
  const isDesktop = dimensions.width >= BREAKPOINTS.desktop;
  const isLandscapeMobile =
    dimensions.width > BREAKPOINTS.mobileLandscape &&
    dimensions.height < 500;

  const sidebarStrategy = getSidebarStrategy(dimensions);

  return {
    width: dimensions.width,
    height: dimensions.height,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isLandscapeMobile,
    sidebarStrategy,
  };
};

/**
 * Hook to get current viewport dimensions (simpler version)
 */
export const useViewportSize = () => {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return size;
};
