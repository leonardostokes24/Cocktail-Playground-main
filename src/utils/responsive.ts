/**
 * Responsive breakpoint utilities
 * Used throughout the app to handle different screen sizes consistently
 */

export const BREAKPOINTS = {
  mobile: 480,
  mobileLandscape: 640,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
  ultraWide: 1920,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Determine the current breakpoint based on width
 */
export const getBreakpoint = (width: number): Breakpoint => {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.mobileLandscape) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'mobileLandscape';
  if (width < BREAKPOINTS.desktop) return 'tablet';
  if (width < BREAKPOINTS.wide) return 'desktop';
  if (width < BREAKPOINTS.ultraWide) return 'wide';
  return 'ultraWide';
};

/**
 * Get responsive node defaults based on viewport width
 * These are used as fallbacks when node.measured dimensions are unavailable
 */
export const getResponsiveNodeDefaults = (viewport: {
  width: number;
  height: number;
}) => {
  const { width } = viewport;

  if (width < BREAKPOINTS.mobile) {
    // Extra small phones
    return {
      spec: { width: 140, height: 110 },
      container: { width: 160, height: 160 },
      ingredient: { width: 120, height: 80 },
    };
  } else if (width < BREAKPOINTS.mobileLandscape) {
    // Small phones
    return {
      spec: { width: 160, height: 120 },
      container: { width: 200, height: 200 },
      ingredient: { width: 130, height: 90 },
    };
  } else if (width < BREAKPOINTS.tablet) {
    // Large phones / small tablets
    return {
      spec: { width: 200, height: 140 },
      container: { width: 250, height: 250 },
      ingredient: { width: 150, height: 100 },
    };
  } else if (width < BREAKPOINTS.desktop) {
    // Tablets
    return {
      spec: { width: 220, height: 150 },
      container: { width: 280, height: 280 },
      ingredient: { width: 160, height: 110 },
    };
  } else if (width < BREAKPOINTS.wide) {
    // Standard desktop
    return {
      spec: { width: 240, height: 160 },
      container: { width: 300, height: 300 },
      ingredient: { width: 180, height: 120 },
    };
  } else {
    // Large desktop
    return {
      spec: { width: 280, height: 180 },
      container: { width: 350, height: 350 },
      ingredient: { width: 200, height: 140 },
    };
  }
};

/**
 * Get responsive sidebar width based on viewport
 */
export const getResponsiveSidebarWidth = (viewport: { width: number }): number => {
  const { width } = viewport;

  if (width < BREAKPOINTS.tablet) {
    return Math.max(width - 40, 300); // Full width minus padding, min 300px
  } else if (width < BREAKPOINTS.desktop) {
    return 260; // Collapsed/narrow on tablets
  } else {
    return 280; // Full width on desktop
  }
};

/**
 * Get responsive sidebar visibility strategy
 */
export const getSidebarStrategy = (viewport: { width: number; height: number }) => {
  const { width, height } = viewport;
  const isLandscapeMobile = width > 640 && height < 500;

  return {
    // Desktop: always visible side-by-side
    alwaysVisible: width >= BREAKPOINTS.desktop && !isLandscapeMobile,
    
    // Tablet: collapsible (icons only)
    collapsible: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
    
    // Mobile: overlay with tab bar
    overlay: width < BREAKPOINTS.tablet,
    
    // Landscape mobile: toggle buttons in corners
    toggleButtons: isLandscapeMobile,
    
    // Show mobile toggles
    showMobileToggles: width < BREAKPOINTS.desktop,
  };
};

/**
 * Parse amount strings like "2 oz" or "0.75 ml" into numeric values
 */
export const parseAmount = (amount: string): number => {
  if (!amount) return 1;
  
  const normalized = amount.toLowerCase().trim();
  
  // Special cases
  if (normalized === 'top' || normalized === 'top up') return 1;
  if (normalized === 'splash') return 0.25;
  if (normalized === 'few drops') return 0.05;
  if (normalized === 'drop' || normalized === 'dash') return 0.1;
  
  // Extract number
  const match = normalized.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 1;
};

/**
 * Check if we're in a touch environment
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    ((navigator as any).msMaxTouchPoints > 0)
  );
};
