
interface SerpApiResponse {
  success: boolean;
  results?: any[];
  error?: string;
}

export class SerpApiService {
  private static API_KEY_STORAGE_KEY = 'serpapi_api_key';

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    console.log('SerpAPI key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static async searchWeb(query: string): Promise<SerpApiResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'SerpAPI key not found' };
    }

    try {
      const url = new URL('https://serpapi.com/search');
      url.searchParams.append('q', query);
      url.searchParams.append('api_key', apiKey);
      url.searchParams.append('engine', 'google');

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.error) {
        console.error('SerpAPI error:', data.error);
        return { 
          success: false, 
          error: data.error 
        };
      }

      return {
        success: true,
        results: data.organic_results || []
      };
    } catch (error) {
      console.error('Error during SerpAPI search:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to SerpAPI'
      };
    }
  }
}
