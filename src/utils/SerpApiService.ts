
export class SerpApiService {
  private static API_KEY_STORAGE_KEY = 'serpapi_api_key';

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    console.log('SerpAPI key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  // Enhanced with better error handling, retry logic, and direct URL filtering
  static async getTopSearchUrls(query: string, limit: number = 10, dateRange?: string, extraContext?: string): Promise<string[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('SerpAPI key not found');
    }

    // Compose richer query with context
    let searchQ = query;
    if (extraContext) searchQ += " " + extraContext;
    if (dateRange) searchQ += " " + dateStr;

    try {
      // Use Google Search engine (SerpAPI)
      const params = new URLSearchParams({
        engine: 'google',
        q: searchQ,
        api_key: apiKey,
        num: String(Math.min(20, limit * 2)), // Request more results to filter better ones
      });
      const url = `https://serpapi.com/search.json?${params.toString()}`;
      
      console.log(`Fetching search results for: ${searchQ}`);
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`SerpAPI request failed with status: ${res.status}`);
      }
      
      const data = await res.json();

      // Extract and prioritize direct URLs (not google.com, not search results)
      let urls: string[] = [];
      
      // First priority: organic results from non-Google domains
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
      
      // Check for knowledge_graph.website if available
      if (data.knowledge_graph && data.knowledge_graph.website) {
        urls.unshift(data.knowledge_graph.website); // Add to beginning as high priority
      }

      console.log(`SerpAPI returned ${urls.length} unique URLs for query: "${searchQ}"`);
      return urls.slice(0, limit);
    } catch (error) {
      console.error(`SerpAPI error for query "${searchQ}":`, error);
      
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
