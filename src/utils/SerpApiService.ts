
export class SerpApiService {
  private static API_KEY_STORAGE_KEY = 'serpapi_api_key';

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    console.log('SerpAPI key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  // enhanced: can inject date/context for better queries
  static async getTopSearchUrls(query: string, limit: number = 10, dateRange?: string, extraContext?: string): Promise<string[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('SerpAPI key not found');
    }

    let searchQ = query;
    if (extraContext) searchQ += " " + extraContext;
    if (dateRange) searchQ += " " + dateRange;

    // Use Google Search engine (SerpAPI)
    const params = new URLSearchParams({
      engine: 'google',
      q: searchQ,
      api_key: apiKey,
      num: String(limit),
    });
    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();

    // Prioritize direct URLs (not google.com) if possible
    let urls: string[] = [];
    if (data.organic_results && Array.isArray(data.organic_results)) {
      for (const result of data.organic_results.slice(0, limit)) {
        if (result.link && !result.link.startsWith("https://www.google.com")) {
          urls.push(result.link);
        }
      }
      // If after filtering for direct URLs we have too few, fill with the rest
      if (urls.length < limit) {
        for (const result of data.organic_results.slice(0, limit)) {
          if (result.link && !urls.includes(result.link)) {
            urls.push(result.link);
          }
        }
      }
    }
    return urls.slice(0, limit);
  }
}
