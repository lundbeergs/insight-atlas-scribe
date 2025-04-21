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

  static isValidUrl(url: string): boolean {
    try {
      // Basic URL parsing
      new URL(url);
      
      // Additional filtering rules
      if (url.startsWith('https://www.google.com/search')) {
        return false;
      }
      
      // Check for common URL issues
      if (url.includes(' ') || 
          url.includes('\n') || 
          url.includes('\t')) {
        return false;
      }
      
      // Check for properly encoded Unicode characters
      if (/[^\x00-\x7F]/.test(url) && !url.includes('%')) {
        // URL contains non-ASCII characters that aren't encoded
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  static formatUrl(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Already a valid URL with http/https
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return input;
    }
    
    // If it's a domain-like string, add https://
    if (this.looksLikeDomain(input)) {
      return `https://${input}`;
    }
    
    // Handle Unicode characters in domain names (like Grönalund)
    if (/[^\x00-\x7F]/.test(input) && this.looksLikeDomainWithUnicode(input)) {
      try {
        // Try to encode the domain properly
        const encodedInput = encodeURI(input);
        return `https://${encodedInput}`;
      } catch {
        // If encoding fails, return empty
        return "";
      }
    }
    
    // Return empty string for non-URL inputs
    return "";
  }
  
  private static looksLikeDomain(input: string): boolean {
    if (!input) return false;
    
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/;
    return domainPattern.test(input) || 
           input.includes('.com') || 
           input.includes('.org') || 
           input.includes('.net') ||
           input.includes('.edu') ||
           input.includes('.gov') ||
           input.includes('.se') || // For Swedish domains
           input.includes('.no');   // For Norwegian domains
  }
  
  private static looksLikeDomainWithUnicode(input: string): boolean {
    return input.includes('.') && 
           !input.includes(' ') &&
           input.length > 4;
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

    // Ensure URL is properly formatted
    url = this.formatUrl(url) || url;

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

      // Use only supported properties for the Firecrawl library
      const crawlResponse = await this.firecrawlApp.crawlUrl(url, {
        limit: 5, 
        scrapeOptions: {
          formats: ['markdown', 'html', 'content'],
          timeout: 25000
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

      // Always accept content of any length
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
      
      // Check if it's a rate limit error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Rate limit')) {
        console.error(`Rate limit exceeded for ${url}: ${errorMessage}`);
        return {
          success: false,
          error: `Rate limit exceeded: ${errorMessage}`
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
