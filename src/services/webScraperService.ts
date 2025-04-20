
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

    const maxConcurrent = 2; // Limit based on FireCrawl plan
    const batches = [];

    // Create batches of max concurrent requests
    for (let i = 0; i < searchTargets.length; i += maxConcurrent) {
      batches.push(searchTargets.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      console.log(`Processing batch of ${batch.length} targets`);

      // Pre-format the targets before crawling
      const batchPromises = batch.map(async (target) => {
        try {
          const apiKey = FirecrawlService.getApiKey();
          if (!apiKey) {
            console.warn('No FireCrawl API key found. Please set your API key in the settings.');
            return null;
          }

          // Preprocess target (convert phrases to Google Search URLs if not already a URL)
          const formattedTarget = FirecrawlService.formatUrl(target);
          console.log(`Scraping target (formatted): ${formattedTarget}`);
          const crawlResult = await FirecrawlService.crawlWebsite(formattedTarget);

          if (crawlResult.success && crawlResult.data) {
            console.log(`Successfully scraped ${formattedTarget}`);
            return {
              url: formattedTarget,
              content: crawlResult.data.content || '',
              metadata: crawlResult.data.metadata
            };
          } else {
            console.warn(`Failed to scrape ${formattedTarget}:`, crawlResult.error);
            return null;
          }
        } catch (error) {
          console.error(`Error scraping target:`, error);
          return null;
        }
      });

      // Wait for all promises in this batch to resolve
      const batchResults = await Promise.all(batchPromises);

      // Add successful results
      for (const result of batchResults) {
        if (result) {
          results.push(result);
        }
      }

      // Add a small delay between batches to avoid rate limiting
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Completed scraping. Found ${results.length} results.`);
    return results;
  }
}
