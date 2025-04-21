
export class SerpApiService {
  private static API_KEY_STORAGE_KEY = 'serpapi_api_key';
  private static MAX_RETRIES = 2;
  private static RETRY_DELAY = 2000; // 2 seconds initial delay

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    console.log('SerpAPI key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  // Enhanced with better error handling and direct URL filtering
  static async getTopSearchUrls(query: string, limit: number = 5, dateRange?: string, extraContext?: string): Promise<string[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('SerpAPI key not found');
    }

    // Handle direct website URLs or domains
    if (query.includes('.com/') || query.includes('.org/') || query.includes('.net/')) {
      // It's likely a direct URL path - ensure it has https:// prefix
      if (!query.startsWith('http')) {
        query = 'https://' + query;
      }
      console.log(`Direct URL path detected, returning: ${query}`);
      return [query];
    }
    
    if (this.looksLikeDomain(query)) {
      // It's a domain - ensure it has https:// prefix
      const url = query.startsWith('http') ? query : `https://${query}`;
      console.log(`Domain detected, returning: ${url}`);
      return [url];
    }
    
    // Compose search query with context
    let searchQ = query;
    if (extraContext) searchQ += " " + extraContext;
    if (dateRange) searchQ += " " + dateRange;
    
    // Set a reasonable timeout
    const timeoutMs = 15000; // 15 seconds
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let retries = 0;
    while (retries <= this.MAX_RETRIES) {
      try {
        // Use Google Search engine (SerpAPI)
        const params = new URLSearchParams({
          engine: 'google',
          q: searchQ,
          api_key: apiKey,
          num: String(Math.min(10, limit * 2)), // Request more results to filter better ones
        });
        const url = `https://serpapi.com/search.json?${params.toString()}`;
        
        console.log(`Fetching search results for: ${searchQ}`);
        const res = await fetch(url, { 
          signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`SerpAPI request failed with status: ${res.status}`);
        }
        
        const data = await res.json();

        // Extract and prioritize direct URLs (not google.com, not search results)
        let urls: string[] = [];
        
        // First check for knowledge_graph.website if available
        if (data.knowledge_graph && data.knowledge_graph.website) {
          urls.push(data.knowledge_graph.website); // Add to beginning as high priority
        }
        
        // Then look for organic results from non-Google domains
        if (data.organic_results && Array.isArray(data.organic_results)) {
          // First pass: collect direct, non-Google URLs
          for (const result of data.organic_results) {
            if (result.link && 
                !result.link.includes("google.com") && 
                !result.link.includes("gstatic.com") &&
                !result.link.includes("youtube.com") &&
                !urls.includes(result.link)) {
              urls.push(result.link);
            }
          }
          
          // If we don't have enough, add remaining URLs (except Google)
          if (urls.length < limit) {
            for (const result of data.organic_results) {
              if (result.link && 
                  !result.link.includes("google.com") && 
                  !urls.includes(result.link)) {
                urls.push(result.link);
              }
            }
          }
        }
        
        // Also check for "inline_people_also_search_for" if available
        if (data.inline_people_also_search_for && Array.isArray(data.inline_people_also_search_for)) {
          for (const item of data.inline_people_also_search_for) {
            if (item.link && !urls.includes(item.link)) {
              urls.push(item.link);
            }
          }
        }

        console.log(`SerpAPI returned ${urls.length} unique URLs for query: "${searchQ}"`);
        return urls.slice(0, limit);
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle timeout errors specifically
        if (error.name === 'AbortError') {
          console.error(`SerpAPI request timeout after ${timeoutMs}ms`);
          break; // Don't retry timeouts
        }
        
        console.error(`SerpAPI error for query "${searchQ}" (attempt ${retries + 1}/${this.MAX_RETRIES + 1}):`, error);
        
        if (retries < this.MAX_RETRIES) {
          // Exponential backoff
          const delay = this.RETRY_DELAY * Math.pow(2, retries);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        } else {
          break;
        }
      }
    }
    
    // For site: queries, extract the domain and return it as a direct URL
    if (query.startsWith('site:')) {
      const domain = query.split('site:')[1].split(' ')[0];
      console.log(`Falling back to direct domain from site: query: ${domain}`);
      return [`https://${domain}`];
    }
    
    // For queries that might be domains already
    if (this.looksLikeDomain(query)) {
      console.log(`Query appears to be a domain, using directly: ${query}`);
      return [this.ensureHttps(query)];
    }
    
    // Return an empty array on failure - we'll handle fallback in the scraper service
    return [];
  }
  
  // Helper to identify if a string looks like a domain
  private static looksLikeDomain(input: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(input)
        || input.includes('.com') 
        || input.includes('.org') 
        || input.includes('.net')
        || input.includes('.edu')
        || input.includes('.gov');
  }
  
  // Helper to ensure URL has https:// prefix
  private static ensureHttps(url: string): string {
    return url.startsWith('http') ? url : `https://${url}`;
  }
}
