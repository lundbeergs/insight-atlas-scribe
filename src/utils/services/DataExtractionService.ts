
import { FirecrawlCore } from './FirecrawlCore';

interface ExtractResponse {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

export class DataExtractionService {
  static async extractStructuredData(url: string, schema: Record<string, any>[]): Promise<ExtractResponse> {
    try {
      console.log(`Extracting structured data from: ${url}`);
      const client = FirecrawlCore.getClient();

      const extractResult = await client.extract([url], {
        schema
      });

      if (extractResult && extractResult.success && extractResult.data) {
        return {
          success: true,
          data: extractResult.data
        };
      } else {
        return {
          success: false,
          error: 'Failed to extract structured data'
        };
      }
    } catch (error) {
      console.error('Error extracting structured data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract data using Firecrawl API'
      };
    }
  }
}
