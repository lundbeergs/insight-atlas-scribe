
import { FirecrawlService } from '../utils/FirecrawlService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
}

export class WebScraperService {
  static async scrapeSearchTargets(searchTargets: string[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const target of searchTargets) {
      try {
        const crawlResult = await FirecrawlService.crawlWebsite(target);
        
        if (crawlResult.success && crawlResult.data) {
          results.push({
            url: target,
            content: crawlResult.data.content || '',
            metadata: crawlResult.data.metadata
          });
        }
      } catch (error) {
        console.error(`Error scraping ${target}:`, error);
      }
    }

    return results;
  }
}
