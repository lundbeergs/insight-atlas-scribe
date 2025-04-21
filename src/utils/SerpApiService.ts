
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
      console.warn('SerpAPI key not found - cannot perform search');
      throw new Error('SerpAPI key not found');
    }

    // Handle direct website URLs or domains
    if (this.isDirectUrl(query)) {
      console.log(`Direct URL detected, returning: ${this.ensureHttps(query)}`);
      return [this.ensureHttps(query)];
    }
    
    // Compose search query with context
    let searchQ = query;
    if (extraContext) searchQ += " " + extraContext;
    if (dateRange) searchQ += " " + dateRange;
    
    console.log(`Final SerpAPI search query: "${searchQ}"`);
    
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
          num: String(Math.min(20, limit * 2)), // Request more results to filter better ones
          gl: 'se', // Location - Sweden
          hl: 'sv', // Language - Swedish (try this for better local results)
        });
        
        // Handle unicode characters
        const encodedQuery = encodeURIComponent(searchQ);
        const url = `https://serpapi.com/search.json?${params.toString()}`;
        
        console.log(`Fetching search results for: ${searchQ}`);
        console.log(`Full SerpAPI URL: ${url}`);
        
        const res = await fetch(url, { signal: controller.signal });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`SerpAPI request failed with status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('SerpAPI response received:', Object.keys(data));

        // Extract and prioritize direct URLs (not google.com, not search results)
        let urls: string[] = [];
        
        // First check for knowledge_graph.website if available
        if (data.knowledge_graph && data.knowledge_graph.website) {
          urls.push(data.knowledge_graph.website); // Add to beginning as high priority
          console.log(`Added knowledge graph website: ${data.knowledge_graph.website}`);
        }
        
        // Then look for organic results from non-Google domains
        if (data.organic_results && Array.isArray(data.organic_results)) {
          console.log(`Found ${data.organic_results.length} organic results`);
          
          // First pass: collect direct, non-Google URLs
          for (const result of data.organic_results) {
            if (result.link && 
                !result.link.includes("google.com") && 
                !result.link.includes("gstatic.com") &&
                !result.link.includes("youtube.com") &&
                !urls.includes(result.link)) {
              urls.push(result.link);
              console.log(`Added organic result: ${result.link}`);
            }
          }
          
          // If we don't have enough, add remaining URLs (except Google)
          if (urls.length < limit) {
            for (const result of data.organic_results) {
              if (result.link && 
                  !result.link.includes("google.com") && 
                  !urls.includes(result.link)) {
                urls.push(result.link);
                console.log(`Added additional result: ${result.link}`);
              }
            }
          }
        } else {
          console.warn('No organic results found in SerpAPI response');
        }
        
        // Also check for "inline_people_also_search_for" if available
        if (data.inline_people_also_search_for && Array.isArray(data.inline_people_also_search_for)) {
          console.log(`Found ${data.inline_people_also_search_for.length} related searches`);
          for (const item of data.inline_people_also_search_for) {
            if (item.link && !urls.includes(item.link)) {
              urls.push(item.link);
              console.log(`Added related search: ${item.link}`);
            }
          }
        }
        
        // Also check for "related_searches" if available
        if (data.related_searches && Array.isArray(data.related_searches)) {
          // Just log these, but don't add as URLs because they're queries, not pages
          console.log(`Found ${data.related_searches.length} related searches`);
        }

        if (urls.length === 0) {
          console.warn('No URLs found in SerpAPI response, checking for events databox');
          
          // Check for events databox which might contain relevant information
          if (data.events_results && Array.isArray(data.events_results)) {
            console.log(`Found ${data.events_results.length} events results`);
            for (const event of data.events_results) {
              if (event.link && !urls.includes(event.link)) {
                urls.push(event.link);
                console.log(`Added event result: ${event.link}`);
              }
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
          await this.delay(delay);
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
    
    // Fallback to direct domain if query looks like one
    if (this.looksLikeDomain(query)) {
      console.log(`Query appears to be a domain, using directly: ${query}`);
      return [this.ensureHttps(query)];
    }
    
    // Check if the query specifically mentions a venue/location 
    if (query.toLowerCase().includes('gronalund') || 
        query.toLowerCase().includes('grönalund')) {
      console.log('Query mentions Grönalund, returning official site as fallback');
      return ['https://www.gronalund.com/en/'];
    }
    
    // Return an empty array on failure - we'll handle fallback in the scraper service
    console.warn('All SerpAPI attempts failed, returning empty array');
    return [];
  }
  
  // Helper to check if a string is a direct URL
  private static isDirectUrl(input: string): boolean {
    return (input.startsWith('http') || 
           this.looksLikeDomain(input));
  }
  
  // Helper to identify if a string looks like a domain
  private static looksLikeDomain(input: string): boolean {
    if (!input) return false;
    
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(input)
        || input.includes('.com') 
        || input.includes('.org') 
        || input.includes('.net')
        || input.includes('.edu')
        || input.includes('.gov')
        || input.includes('.se')  // For Swedish domains
        || input.includes('.no'); // For Norwegian domains
  }
  
  // Helper to ensure URL has https:// prefix
  private static ensureHttps(url: string): string {
    return url.startsWith('http') ? url : `https://${url}`;
  }
  
  // Helper for delays
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
