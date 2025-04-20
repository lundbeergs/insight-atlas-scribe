
import { FirecrawlService } from '../utils/FirecrawlService';
import { SerpApiService } from '../utils/SerpApiService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
  searchQuery?: string; // Track which search query produced this result
}

export class WebScraperService {
  // Now: Process EACH search focus independently, with explicit context and more URLs!
  static async scrapeSearchTargets(
    searchTargets: string[], 
    researchContext?: string, 
    informationGoals?: string[], 
    dateWindow?: string
  ): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    console.log('Starting to scrape search targets (Improved SerpAPI+Firecrawl):', searchTargets);
    console.log('Research context:', researchContext);

    const serpApiKey = SerpApiService.getApiKey();

    // More concurrency and URLs, default to max 10 per query
    const maxConcurrent = 5;
    const urlsPerQuery = 10;
    const now = new Date();
    const previousYear = new Date(now);
    previousYear.setFullYear(now.getFullYear() - 1);
    const dateStr = dateWindow || `${previousYear.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;

    // Run each search target as its own "search batch"
    for (const target of searchTargets) {
      let targetUrls: string[] = [];
      let contextHints = researchContext ? researchContext : '';
      // For max effectiveness, add info goals, context, and date
      let infoGoalText = (informationGoals && informationGoals.length > 0) ? informationGoals.join(" ") : '';

      // If already a URL, just use
      if (FirecrawlService.isValidUrl(target)) {
        targetUrls.push(target);
      } 
      // else if likely a direct site ("site.com/dir"), still format as URL
      else if (
        (target.includes('.com') || target.includes('.org') || target.includes('.net') 
        || target.includes('.edu') || target.includes('.gov'))
        && !target.startsWith('http')
      ) {
        targetUrls.push(`https://${target}`);
      }
      // else - treat as a search query, enhance with context, info goals, date, then resolve via SerpAPI
      else if (serpApiKey) {
        try {
          // Compose query
          let query = `${target} ${contextHints} ${infoGoalText}`.trim();
          // Add date if not already present in query
          if (!/\d{4}/.test(query)) query += ` ${dateStr}`;
          // Get up to 10 best URLs
          const foundUrls = await SerpApiService.getTopSearchUrls(query, urlsPerQuery, dateStr, contextHints);
          if (foundUrls.length) {
            console.log(`SerpAPI found ${foundUrls.length} URLs for "${target}":`, foundUrls);
            // Always prefer non-google.com links
            targetUrls.push(...foundUrls.slice(0, urlsPerQuery));
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

      // For each target, crawl all URLs in batches
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
                searchQuery: target // Track source
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
          if (result) results.push(result);
        }
        
        // Add delay between batches to avoid rate limiting
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Add a small delay between different search targets
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Completed scraping. Found ${results.length} results.`);
    return results;
  }
}
