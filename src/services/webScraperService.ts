import { FirecrawlService } from '../utils/FirecrawlService';
import { SerpApiService } from '../utils/SerpApiService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
}

export class WebScraperService {
  static async scrapeSearchTargets(searchTargets: string[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    console.log('Starting to scrape search targets (SerpAPI+Firecrawl):', searchTargets);

    // First get the SerpAPI key (if not present, fallback to original logic)
    const serpApiKey = SerpApiService.getApiKey();

    const maxConcurrent = 2; // Limit based on FireCrawl plan
    const allTargets: string[] = [];

    for (const target of searchTargets) {
      // If it's already a URL, use as-is
      if (FirecrawlService.isValidUrl(target)) {
        allTargets.push(target);
      } else if (serpApiKey) {
        // Otherwise, resolve via SerpAPI
        try {
          const foundUrls = await SerpApiService.getTopSearchUrls(target, 3);
          if (foundUrls.length) {
            console.log(`SerpAPI found URLs for "${target}":`, foundUrls);
            allTargets.push(...foundUrls);
          } else {
            // Fallback to Firecrawl's formatUrl if none found
            allTargets.push(FirecrawlService.formatUrl(target));
          }
        } catch (err) {
          console.error('Error with SerpAPI:', err);
          // Fallback to Firecrawl formatting
          allTargets.push(FirecrawlService.formatUrl(target));
        }
      } else {
        // No SerpApi key: fallback to Firecrawl formatUrl
        allTargets.push(FirecrawlService.formatUrl(target));
      }
    }

    // Split into batches for concurrent crawling
    const batches = [];
    for (let i = 0; i < allTargets.length; i += maxConcurrent) {
      batches.push(allTargets.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      console.log(`Processing batch of ${batch.length} targets`);
      const batchPromises = batch.map(async (target) => {
        try {
          const apiKey = FirecrawlService.getApiKey();
          if (!apiKey) {
            console.warn('No FireCrawl API key found. Please set your API key in the settings.');
            return null;
          }
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
          console.error(`Error scraping target:`, error);
          return null;
        }
      });
      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result) {
          results.push(result);
        }
      }
      // Add delay between batches to avoid rate limiting
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    console.log(`Completed scraping. Found ${results.length} results.`);
    return results;
  }
}
