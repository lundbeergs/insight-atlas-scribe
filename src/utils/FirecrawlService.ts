
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

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static formatUrl(input: string): string {
    if (this.isValidUrl(input)) {
      return input;
    }
    
    // If it has a domain-like structure, add https://
    if (input.includes('.com') || input.includes('.org') || input.includes('.net') || 
        input.includes('.edu') || input.includes('.gov')) {
      return `https://${input}`;
    }
    
    // For search queries, encode them properly
    return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
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

  static async crawlWebsite(url: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    try {
      console.log(`Initiating crawl for URL: ${url}`);
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      // Format URL properly
      const targetUrl = this.formatUrl(url);
      console.log(`Processed URL for crawling: ${targetUrl}`);
      
      // Check cache first
      if (this.requestCache.has(targetUrl)) {
        console.log(`Using cached result for ${targetUrl}`);
        const cachedResponse = this.requestCache.get(targetUrl) as CrawlResponse;
        
        if (!cachedResponse.success) {
          return { 
            success: false, 
            error: (cachedResponse as ErrorResponse).error || 'Failed to crawl website (cached result)' 
          };
        }
        
        return { 
          success: true,
          data: {
            content: (cachedResponse as CrawlStatusResponse).content,
            metadata: (cachedResponse as CrawlStatusResponse).metadata
          }
        };
      }
      
      // Check rate limit
      if (!this.enforceRateLimit()) {
        return { 
          success: false, 
          error: 'Rate limit reached. Try again in a minute.' 
        };
      }
      
      // Add to recent requests
      this.recentRequests.push({ timestamp: Date.now(), url: targetUrl });

      const crawlResponse = await this.firecrawlApp.crawlUrl(targetUrl, {
        limit: 5, // Limit to 5 pages per domain for efficiency
        scrapeOptions: {
          formats: ['markdown', 'html']
        }
      }) as CrawlResponse;
      
      // Cache the response
      this.requestCache.set(targetUrl, crawlResponse);

      if (!crawlResponse.success) {
        console.error('Crawl failed:', (crawlResponse as ErrorResponse).error);
        return { 
          success: false, 
          error: (crawlResponse as ErrorResponse).error || 'Failed to crawl website' 
        };
      }

      console.log('Crawl successful for:', targetUrl);
      return { 
        success: true,
        data: {
          content: crawlResponse.content,
          metadata: crawlResponse.metadata
        }
      };
    } catch (error) {
      console.error('Error during crawl:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to connect to Firecrawl API' 
      };
    }
  }
}
