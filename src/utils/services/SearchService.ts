
import { FirecrawlCore } from './FirecrawlCore';

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

export class SearchService {
  static async search(query: string, options: { limit?: number } = {}): Promise<SearchResponse> {
    try {
      console.log(`Searching for: ${query}`);
      const client = FirecrawlCore.getClient();

      const searchResponse = await client.search(query, {
        limit: options.limit || 5
      });

      if (searchResponse && typeof searchResponse === 'object' && searchResponse.success === true) {
        let searchResults: SearchResult[] = [];
        
        if (Array.isArray(searchResponse.data)) {
          searchResults = searchResponse.data.map(item => ({
            url: item.url || '',
            title: item.title || '',
            snippet: typeof item.content === 'string' ? item.content.substring(0, 150) : ''
          }));
        }
        
        return {
          success: true,
          results: searchResults
        };
      }
      
      return {
        success: false,
        error: 'No search results found'
      };
    } catch (error) {
      console.error('Error during search:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search using Firecrawl API'
      };
    }
  }
}
