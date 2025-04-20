
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

    // Process targets in parallel but with limitations to avoid overloading
    const maxConcurrent = 2; // Limit based on FireCrawl plan
    const batches = [];
    
    // Create batches of max concurrent requests
    for (let i = 0; i < searchTargets.length; i += maxConcurrent) {
      batches.push(searchTargets.slice(i, i + maxConcurrent));
    }
    
    for (const batch of batches) {
      console.log(`Processing batch of ${batch.length} targets`);
      
      // Process this batch in parallel
      const batchPromises = batch.map(async (target) => {
        try {
          const apiKey = FirecrawlService.getApiKey();
          if (!apiKey) {
            console.warn('No FireCrawl API key found. Please set your API key in the settings.');
            return null;
          }

          console.log(`Scraping target: ${target}`);
          const crawlResult = await FirecrawlService.crawlWebsite(target);
          
          if (crawlResult.success && crawlResult.data) {
            console.log(`Successfully scraped ${target}`);
            return {
              url: target,
              content: crawlResult.data.content || '',
              metadata: crawlResult.data.metadata
            };
          } else {
            console.warn(`Failed to scrape ${target}:`, crawlResult.error);
            return null;
          }
        } catch (error) {
          console.error(`Error scraping ${target}:`, error);
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
