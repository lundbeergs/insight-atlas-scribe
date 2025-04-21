
import FirecrawlApp from '@mendable/firecrawl-js';

interface ErrorResponse {
  success: false;
  error: string;
}

interface CrawlStatusResponse {
  success: true;
  content: string;
  metadata: Record<string, any>;
}

type CrawlResponse = CrawlStatusResponse | ErrorResponse;

export class FirecrawlService {
  private static API_KEY_STORAGE_KEY = 'firecrawl_api_key';
  private static firecrawlApp: FirecrawlApp | null = null;
  private static requestCache = new Map<string, CrawlResponse>();
  private static recentRequests: { timestamp: number; url: string }[] = [];
  private static MAX_CONCURRENT_REQUESTS = 2; // Limit based on plan

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    this.firecrawlApp = new FirecrawlApp({ apiKey });
    console.log('Firecrawl API key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('Testing Firecrawl API key...');
      const app = new FirecrawlApp({ apiKey });
      
      // A simple test crawl to verify the API key
      const testResponse = await app.crawlUrl('https://example.com', {
        limit: 1
      });
      
      return testResponse.success === true;
    } catch (error) {
      console.error('Error testing Firecrawl API key:', error);
      return false;
    }
  }

  // Enhanced URL validation
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      // Additional check to prevent crawling Google search URLs
      if (url.startsWith('https://www.google.com/search')) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // Improved URL formatting with better domain detection
  static formatUrl(input: string): string {
    // Already a valid URL with http/https
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return input;
    }
    
    // If it's a domain-like string, add https://
    if (this.looksLikeDomain(input)) {
      return `https://${input}`;
    }
    
    // Return empty string for non-URL inputs
    return "";
  }
  
  // Helper to identify if a string looks like a domain
  private static looksLikeDomain(input: string): boolean {
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/;
    return domainPattern.test(input) || 
           input.includes('.com') || 
           input.includes('.org') || 
           input.includes('.net') ||
           input.includes('.edu') ||
           input.includes('.gov');
  }

  private static enforceRateLimit(): boolean {
    // Clean up requests older than 60 seconds
    const now = Date.now();
    this.recentRequests = this.recentRequests.filter(
      req => now - req.timestamp < 60000
    );
    
    // Check if we're at the concurrent request limit
    if (this.recentRequests.length >= this.MAX_CONCURRENT_REQUESTS) {
      console.warn('Rate limit reached for Firecrawl API. Try again later.');
      return false;
    }
    
    return true;
  }

  static async crawlWebsite(url: string, timeoutMs: number = 30000): Promise<{ success: boolean; error?: string; data?: any }> {
    // Skip invalid URLs early
    if (!url || !this.isValidUrl(url)) {
      return { 
        success: false, 
        error: `Invalid URL: ${url || '(empty)'}` 
      };
    }
    
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`Making crawl request to Firecrawl API for: ${url}`);
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      // Check cache first
      if (this.requestCache.has(url)) {
        console.log(`Using cached result for ${url}`);
        const cachedResponse = this.requestCache.get(url) as CrawlResponse;
        
        if (!cachedResponse.success) {
          return { 
            success: false, 
            error: (cachedResponse as ErrorResponse).error || 'Failed to crawl website (cached)' 
          };
        }
        
        return { 
          success: true,
          data: cachedResponse 
        };
      }

      // Add rate limiting tracking
      this.recentRequests.push({
        timestamp: Date.now(),
        url
      });

      const crawlResponse = await this.firecrawlApp.crawlUrl(url, {
        limit: 5, // Reduced to improve performance
        scrapeOptions: {
          formats: ['markdown', 'html']
        }
      }) as CrawlResponse;

      // Cache the result
      this.requestCache.set(url, crawlResponse);

      clearTimeout(timeoutId);

      if (!crawlResponse.success) {
        console.error('Crawl failed:', (crawlResponse as ErrorResponse).error);
        return { 
          success: false, 
          error: (crawlResponse as ErrorResponse).error || 'Failed to crawl website' 
        };
      }

      // MODIFIED: Always accept content of any length
      console.log(`Crawl successful for ${url}, content length: ${crawlResponse.content?.length || 0} chars`);
      return { 
        success: true,
        data: crawlResponse 
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle timeout errors specifically
      if (error.name === 'AbortError') {
        console.error(`Crawl request timeout for ${url} after ${timeoutMs}ms`);
        return { 
          success: false, 
          error: `Request timed out after ${timeoutMs/1000} seconds` 
        };
      }
      
      console.error('Error during crawl:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to connect to Firecrawl API' 
      };
    }
  }
}
