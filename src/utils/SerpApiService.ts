
export class SerpApiService {
  private static API_KEY_STORAGE_KEY = 'serpapi_api_key';

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    console.log('SerpAPI key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static async getTopSearchUrls(query: string, limit: number = 10): Promise<string[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('SerpAPI key not found');
    }
    // Use Google Search engine (SerpAPI)
    const params = new URLSearchParams({
      engine: 'google',
      q: query,
      api_key: apiKey,
      num: String(limit),
    });
    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();

    const urls: string[] = [];
    if (data.organic_results && Array.isArray(data.organic_results)) {
      for (const result of data.organic_results.slice(0, limit)) {
        if (result.link) {
          urls.push(result.link);
        }
      }
    }
    return urls;
  }
}
