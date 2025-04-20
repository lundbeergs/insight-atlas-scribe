import { FirecrawlCore } from './FirecrawlCore';

export class WebScraperService {
  private static requestCache = new Map<string, any>();
  private static recentRequests: { timestamp: number; url: string }[] = [];
  private static MAX_CONCURRENT_REQUESTS = 3;
  private static RATE_LIMIT_WINDOW = 60000;
  private static PAGE_LIMIT = 10;

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
    
    if (input.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/)) {
      return `https://${input}`;
    }
    
    if (input.includes('/') && !input.startsWith('http')) {
      return `https://${input}`;
    }
    
    if (input.toLowerCase().includes('site:')) {
      return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    }
    
    const enhancedQuery = `${input} site:.com OR site:.org OR site:.gov OR site:.edu`;
    return `https://www.google.com/search?q=${encodeURIComponent(enhancedQuery)}`;
  }

  private static enforceRateLimit(): boolean {
    const now = Date.now();
    this.recentRequests = this.recentRequests.filter(
      req => now - req.timestamp < this.RATE_LIMIT_WINDOW
    );
    
    if (this.recentRequests.length >= this.MAX_CONCURRENT_REQUESTS) {
      console.warn(`Rate limit reached (${this.MAX_CONCURRENT_REQUESTS} requests per ${this.RATE_LIMIT_WINDOW/1000}s)`);
      return false;
    }
    
    return true;
  }

  static async crawlWebsite(url: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const client = FirecrawlCore.getClient();
      const targetUrl = this.formatUrl(url);
      console.log(`Processed URL for crawling: ${targetUrl}`);
      
      if (this.requestCache.has(targetUrl)) {
        console.log(`Using cached result for ${targetUrl}`);
        const cachedResponse = this.requestCache.get(targetUrl);
        return this.processResponse(cachedResponse);
      }
      
      if (!this.enforceRateLimit()) {
        return { 
          success: false, 
          error: 'Rate limit reached. Please wait before trying again.' 
        };
      }
      
      this.recentRequests.push({ timestamp: Date.now(), url: targetUrl });

      const crawlResponse = await client.crawlUrl(targetUrl, {
        limit: this.PAGE_LIMIT,
        scrapeOptions: {
          formats: ['markdown', 'html'],
          selectors: {
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
        }
      });
      
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

  private static processResponse(response: any): { success: boolean; data?: any; error?: string } {
    if (!response.success) {
      console.error('Crawl failed:', response.error);
      return { 
        success: false, 
        error: response.error || 'Failed to crawl website' 
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
