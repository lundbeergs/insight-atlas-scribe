
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

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

interface SearchResponse {
  success: boolean;
  results?: SearchResult[];
  error?: string;
}

interface ExtractResponse {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

type CrawlResponse = CrawlStatusResponse | ErrorResponse;

export class FirecrawlService {
  private static API_KEY_STORAGE_KEY = 'firecrawl_api_key';
  private static firecrawlApp: FirecrawlApp | null = null;
  private static requestCache = new Map<string, CrawlResponse>();
  private static recentRequests: { timestamp: number; url: string }[] = [];
  private static MAX_CONCURRENT_REQUESTS = 3; // Increased from 2
  private static RATE_LIMIT_WINDOW = 60000; // 60 seconds
  private static PAGE_LIMIT = 10; // Increased from 5

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
    
    // Handle domain-like strings
    if (input.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/)) {
      return `https://${input}`;
    }
    
    // Handle paths that might be missing protocol
    if (input.includes('/') && !input.startsWith('http')) {
      return `https://${input}`;
    }
    
    // For search queries, use a more targeted approach
    if (input.toLowerCase().includes('site:')) {
      // Keep site: operator intact
      return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    }
    
    // Add site: operator for better targeting when searching
    const enhancedQuery = `${input} site:.com OR site:.org OR site:.gov OR site:.edu`;
    return `https://www.google.com/search?q=${encodeURIComponent(enhancedQuery)}`;
  }

  private static enforceRateLimit(): boolean {
    const now = Date.now();
    
    // Clean up old requests
    this.recentRequests = this.recentRequests.filter(
      req => now - req.timestamp < this.RATE_LIMIT_WINDOW
    );
    
    // Check concurrent request limit
    if (this.recentRequests.length >= this.MAX_CONCURRENT_REQUESTS) {
      console.warn(`Rate limit reached (${this.MAX_CONCURRENT_REQUESTS} requests per ${this.RATE_LIMIT_WINDOW/1000}s)`);
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

      const targetUrl = this.formatUrl(url);
      console.log(`Processed URL for crawling: ${targetUrl}`);
      
      // Check cache
      if (this.requestCache.has(targetUrl)) {
        console.log(`Using cached result for ${targetUrl}`);
        const cachedResponse = this.requestCache.get(targetUrl) as CrawlResponse;
        return this.processResponse(cachedResponse);
      }
      
      // Check rate limit
      if (!this.enforceRateLimit()) {
        return { 
          success: false, 
          error: 'Rate limit reached. Please wait before trying again.' 
        };
      }
      
      // Add to recent requests
      this.recentRequests.push({ timestamp: Date.now(), url: targetUrl });

      // Fix the scrapeOptions structure according to the Firecrawl API expectations
      const crawlResponse = await this.firecrawlApp.crawlUrl(targetUrl, {
        limit: this.PAGE_LIMIT,
        scrapeOptions: {
          formats: ['markdown', 'html'],
          include: [
            'article',
            'main',
            '.content',
            '.post',
            '.article',
            'h1, h2, h3',
            'p',
            'ul, ol',
            'table'
          ],
          exclude: [
            'nav',
            'header',
            'footer',
            '.sidebar',
            '.ads',
            '.cookie-notice',
            '.social-share'
          ]
        }
      }) as CrawlResponse;
      
      // Cache the response
      this.requestCache.set(targetUrl, crawlResponse);
      
      return this.processResponse(crawlResponse);
    } catch (error) {
      console.error('Error during crawl:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to connect to Firecrawl API' 
      };
    }
  }

  static async search(query: string, options: { limit?: number } = {}): Promise<SearchResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    try {
      console.log(`Searching for: ${query}`);
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      // Use the search method from Firecrawl and properly handle its response structure
      const searchResponse = await this.firecrawlApp.search(query, {
        limit: options.limit || 5
      });

      // Since we don't know the exact structure of the response from the Firecrawl API,
      // let's handle it defensively
      if (searchResponse && typeof searchResponse === 'object' && searchResponse.success === true) {
        const results = Array.isArray(searchResponse.results) ? searchResponse.results : [];
        return {
          success: true,
          results: results.map(result => ({
            url: result.url || '',
            title: result.title || '',
            snippet: result.snippet || ''
          }))
        };
      } else {
        return {
          success: false,
          error: 'No search results found'
        };
      }
    } catch (error) {
      console.error('Error during search:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search using Firecrawl API'
      };
    }
  }

  static async extractStructuredData(url: string, schema: Record<string, any>): Promise<ExtractResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    try {
      console.log(`Extracting structured data from: ${url}`);
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      // Fix type error by ensuring schema is passed correctly according to API expectations
      const schemaArray = Array.isArray(schema) ? schema : [schema];
      const extractResponse = await this.firecrawlApp.extract(url, {
        schema: schemaArray
      });

      if (extractResponse.success && extractResponse.data) {
        return {
          success: true,
          data: extractResponse.data
        };
      } else {
        return {
          success: false,
          error: 'Failed to extract structured data'
        };
      }
    } catch (error) {
      console.error('Error extracting structured data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract data using Firecrawl API'
      };
    }
  }

  private static processResponse(response: CrawlResponse): { success: boolean; data?: any; error?: string } {
    if (!response.success) {
      console.error('Crawl failed:', (response as ErrorResponse).error);
      return { 
        success: false, 
        error: (response as ErrorResponse).error || 'Failed to crawl website' 
      };
    }

    console.log('Crawl successful');
    return { 
      success: true,
      data: {
        content: response.content,
        metadata: response.metadata
      }
    };
  }
}
