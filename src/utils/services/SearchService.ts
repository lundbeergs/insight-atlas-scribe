
import { FirecrawlCore } from './FirecrawlCore';

export class SearchService {
  static async search(query: string, options: { limit?: number } = {}): Promise<any> {
    try {
      console.log(`Searching for: ${query}`);
      const client = FirecrawlCore.getClient();

      const searchResponse = await client.search(query, {
        limit: options.limit || 5
      });

      if (searchResponse && searchResponse.success === true) {
        let results = [];
        
        if (Array.isArray(searchResponse.data)) {
          results = searchResponse.data.map(item => ({
            url: item.url || '',
            title: item.title || '',
            snippet: item.description || ''
          }));
        }
        
        return {
          success: true,
          results
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

