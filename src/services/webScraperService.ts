
import { FirecrawlService } from '../utils/FirecrawlService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
}

export class WebScraperService {
  static async scrapeSearchTargets(searchTargets: string[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    console.log('Starting to scrape search targets:', searchTargets);

    for (const target of searchTargets) {
      try {
        const apiKey = FirecrawlService.getApiKey();
        if (!apiKey) {
          console.warn('No FireCrawl API key found. Please set your API key in the settings.');
          continue;
        }

        console.log(`Scraping target: ${target}`);
        const crawlResult = await FirecrawlService.crawlWebsite(target);
        
        if (crawlResult.success && crawlResult.data) {
          console.log(`Successfully scraped ${target}`);
          results.push({
            url: target,
            content: crawlResult.data.content || '',
            metadata: crawlResult.data.metadata
          });
        } else {
          console.warn(`Failed to scrape ${target}:`, crawlResult.error);
        }
      } catch (error) {
        console.error(`Error scraping ${target}:`, error);
      }
    }

    console.log(`Completed scraping. Found ${results.length} results.`);
    return results;
  }
}
