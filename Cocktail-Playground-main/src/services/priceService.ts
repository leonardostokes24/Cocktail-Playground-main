import { calculateCostPerOz } from '../utils/pricing';

export interface ScrapedPrice {
  price: number;
  volume: string;
  pricePerOz: number;
  currency: string;
}

export const priceService = {
  async fetchPriceFromUrl(url: string): Promise<ScrapedPrice | null> {
    try {
      // Use allorigins proxy to bypass CORS
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Proxy request failed');
      
      const { contents } = await response.json();
      const html = contents;
      
      // Extract price: Look for $ followed by numbers
      const priceMatch = html.match(/\$(\d+(\.\d{2})?)/);
      if (!priceMatch) return null;
      const price = parseFloat(priceMatch[1]);
      
      // Extract volume: Look for common bottle sizes (e.g., 750ml, 1L, 375ml)
      const volumeMatch = html.match(/(\d+)\s*(ml|l|liter|oz)/i);
      if (!volumeMatch) return null;
      const volume = `${volumeMatch[1]}${volumeMatch[2].toLowerCase()}`;
      
      const pricePerOz = calculateCostPerOz(price, volume);
      
      return {
        price,
        volume,
        pricePerOz,
        currency: '$',
      };
    } catch (error) {
      console.error('Price scraping error:', error);
      return null;
    }
  }
};
