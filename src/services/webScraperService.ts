import { FirecrawlService } from '../utils/FirecrawlService';
import { SerpApiService } from '../utils/SerpApiService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
  searchQuery?: string; // Track which search query produced this result
}

export class WebScraperService {
  static async scrapeSearchTargets(searchTargets: string[], researchContext?: string): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    console.log('Starting to scrape search targets (SerpAPI+Firecrawl):', searchTargets);
    console.log('Research context:', researchContext);

    // First get the SerpAPI key (if not present, fallback to original logic)
    const serpApiKey = SerpApiService.getApiKey();

    const maxConcurrent = 5; // Increased from 2 to 5 for better throughput
    const urlsPerQuery = 10; // Increased from 3 to 10 for more comprehensive results
    
    // Process each search target separately to ensure thorough coverage
    for (const target of searchTargets) {
      const targetUrls: string[] = [];
      
      // If it's already a URL, use as-is
      if (FirecrawlService.isValidUrl(target)) {
        targetUrls.push(target);
      } else if (serpApiKey) {
        // Otherwise, resolve via SerpAPI
        try {
          // Expand search with context if available
          const searchQuery = researchContext ? 
            `${target} ${researchContext}` : target;
          
          const foundUrls = await SerpApiService.getTopSearchUrls(searchQuery, urlsPerQuery);
          if (foundUrls.length) {
            console.log(`SerpAPI found ${foundUrls.length} URLs for "${target}":`, foundUrls);
            targetUrls.push(...foundUrls);
          } else {
            // Fallback to Firecrawl's formatUrl if none found
            targetUrls.push(FirecrawlService.formatUrl(target));
          }
        } catch (err) {
          console.error('Error with SerpAPI:', err);
          // Fallback to Firecrawl formatting
          targetUrls.push(FirecrawlService.formatUrl(target));
        }
      } else {
        // No SerpApi key: fallback to Firecrawl formatUrl
        targetUrls.push(FirecrawlService.formatUrl(target));
      }
      
      // Now process this batch of URLs for the current target
      // Split into batches for concurrent crawling
      const batches = [];
      for (let i = 0; i < targetUrls.length; i += maxConcurrent) {
        batches.push(targetUrls.slice(i, i + maxConcurrent));
      }

      for (const batch of batches) {
        console.log(`Processing batch of ${batch.length} URLs for search target "${target}"`);
        const batchPromises = batch.map(async (url) => {
          try {
            const apiKey = FirecrawlService.getApiKey();
            if (!apiKey) {
              console.warn('No FireCrawl API key found. Please set your API key in the settings.');
              return null;
            }
            const crawlResult = await FirecrawlService.crawlWebsite(url);

            if (crawlResult.success && crawlResult.data) {
              console.log(`Successfully scraped ${url}`);
              return {
                url: url,
                content: crawlResult.data.content || '',
                metadata: crawlResult.data.metadata,
                searchQuery: target // Track which search query produced this result
              };
            } else {
              console.warn(`Failed to scrape ${url}:`, crawlResult.error);
              return null;
            }
          } catch (error) {
            console.error(`Error scraping URL:`, error);
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
      
      // Add a small delay between processing different search targets
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Completed scraping. Found ${results.length} results.`);
    return results;
  }
}
