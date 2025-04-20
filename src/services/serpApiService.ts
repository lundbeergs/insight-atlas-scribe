
import { supabase } from "@/integrations/supabase/client";

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
      console.log(`Calling serp-api-search edge function for query: ${query}`);
      
      // Call the Supabase Edge Function instead of direct API
      const { data, error } = await supabase.functions.invoke('serp-api-search', {
        body: { query }
      });

      if (error) {
        console.error('Error calling serp-api-search function:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to call search service'
        };
      }

      return data;
    } catch (error) {
      console.error('Error during SerpAPI search:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to SerpAPI'
      };
    }
  }
}
