import { FirecrawlService } from '../utils/FirecrawlService';
import { SerpApiService } from '../utils/SerpApiService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
  searchQuery?: string; // Track which search query produced this result
}

// Industry sources as fallbacks
const INDUSTRY_SPECIFIC_SOURCES = [
  "https://www.entrust.com/about/newsroom/events/",
  "https://www.rsaconference.com/",
  "https://securityboulevard.com/",
];

// Global research parameters
const MAX_URLS_PER_TARGET = 5;
const MAX_RESULTS_TOTAL = 15;
const URL_TIMEOUT_MS = 30000; // 30 seconds per URL
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1000;
const TARGET_DELAY_MS = 500;

export class WebScraperService {
  private static isResearchCanceled = false;

  static cancelResearch() {
    this.isResearchCanceled = true;
    console.log('Research canceled by user or timeout');
  }

  // BIG CHANGE: All searchFocus are run as Google queries via SerpAPI (unless explicitly a URL)
  static async scrapeSearchTargets(
    searchTargets: string[],
    researchContext?: string,
    informationGoals?: string[],
    dateWindow?: string
  ): Promise<ScrapingResult[]> {
    this.isResearchCanceled = false;
    const results: ScrapingResult[] = [];

    try {
      const serpApiKey = SerpApiService.getApiKey();
      const firecrawlApiKey = FirecrawlService.getApiKey();

      if (!firecrawlApiKey) {
        console.error("No FireCrawl API key found. Please set your API key in the settings.");
        return [];
      }

      console.log('Starting web scraper with search targets:', searchTargets);
      console.log('Research context:', researchContext);

      const now = new Date();
      const previousYear = new Date(now);
      previousYear.setFullYear(now.getFullYear() - 1);
      const dateStr = dateWindow || `${previousYear.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;

      // For each search target in searchTargets, always treat as Google query via SerpAPI
      for (const target of searchTargets) {
        if (this.isResearchCanceled || results.length >= MAX_RESULTS_TOTAL) {
          console.log('Research stopped: canceled or enough results');
          break;
        }

        let urlsToScrape: string[] = [];

        // If the target is an explicit URL, we just scrape it directly, otherwise, always use SerpAPI as a query
        if (
          target.startsWith('http') ||
          FirecrawlService.isValidUrl(`https://${target}`)
        ) {
          // Explicit URL or domain-like string: scrape it directly
          const url = target.startsWith('http') ? target : `https://${target}`;
          console.log(`Target is treated as direct URL: ${url}`);
          urlsToScrape.push(url);
        } else if (serpApiKey) {
          // For everything else: Treat as a Google search query through SerpAPI
          let enrichedQuery = target;
          if (researchContext && !target.includes(researchContext)) {
            enrichedQuery += ` ${researchContext}`;
          }
          if (informationGoals && informationGoals.length > 0) {
            enrichedQuery += ` ${informationGoals.join(' ')}`;
          }
          enrichedQuery += ` ${dateStr}`;

          console.log(`Using SerpAPI for query: "${enrichedQuery}"`);
          try {
            // Get ALL top URLs from SerpAPI
            const foundUrls = await SerpApiService.getTopSearchUrls(
              enrichedQuery,
              MAX_URLS_PER_TARGET,
              dateStr
            );
            if (foundUrls.length > 0) {
              console.log(`SerpAPI found ${foundUrls.length} URLs for "${enrichedQuery}"`);
              urlsToScrape.push(...foundUrls);
            } else {
              // Fallback on industry-specific source
              urlsToScrape.push(INDUSTRY_SPECIFIC_SOURCES[0]);
            }
          } catch (error) {
            console.error(`SerpAPI error for "${target}":`, error);
            urlsToScrape.push(INDUSTRY_SPECIFIC_SOURCES[0]);
          }
        } else {
          // No SerpAPI key available: fallback on industry-specific source
          console.warn("No SerpAPI key found. Using industry-specific source.");
          urlsToScrape.push(INDUSTRY_SPECIFIC_SOURCES[0]);
        }

        // Filter for unique, valid URLs only — NO "relevance" or content-threshhold filters
        urlsToScrape = [
          ...new Set(urlsToScrape)
        ].filter(
          url =>
            FirecrawlService.isValidUrl(url) &&
            !url.startsWith('https://www.google.com/search')
        ).slice(0, MAX_URLS_PER_TARGET);

        if (urlsToScrape.length === 0) {
          console.warn(`No valid URLs found for target: "${target}"`);
          continue;
        }

        console.log(`Scraping ${urlsToScrape.length} URLs for target: "${target}"`);

        // For each URL, scrape with Firecrawl (no filtering)
        for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
          if (this.isResearchCanceled || results.length >= MAX_RESULTS_TOTAL) {
            console.log('Batch stopped: canceled or enough results');
            break;
          }
          const batch = urlsToScrape.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch of ${batch.length} URLs (${i+1}-${i+batch.length} of ${urlsToScrape.length})`);

          const batchPromises = batch.map(async (url) => {
            try {
              const crawlResult = await FirecrawlService.crawlWebsite(url, URL_TIMEOUT_MS);
              if (crawlResult.success && crawlResult.data) {
                const fcData = crawlResult.data;
                const fullContent = fcData.content || '';
                // No relevance filtering, always include everything
                return {
                  url: url,
                  content: fullContent,
                  metadata: fcData.metadata || {},
                  searchQuery: target
                };
              } else {
                console.warn(`Failed to scrape ${url}:`, crawlResult.error);
                return null;
              }
            } catch (error) {
              console.error(`Error scraping URL ${url}:`, error);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          let newResults = 0;
          for (const result of batchResults) {
            if (result) {
              results.push(result);
              newResults++;
            }
          }

          if (i + BATCH_SIZE < urlsToScrape.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        if (searchTargets.indexOf(target) < searchTargets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, TARGET_DELAY_MS));
        }
      }

      console.log(`Web scraper finished with ${results.length} total results`);
      return results;
    } catch (error) {
      console.error("Unexpected error in scrapeSearchTargets:", error);
      return results;
    }
  }

  // Helper to prioritize targets by type
  private static prioritizeTargets(targets: string[]): string[] {
    const directUrls: string[] = [];
    const siteQueries: string[] = [];
    const regularQueries: string[] = [];
    
    for (const target of targets) {
      if (target.startsWith('http') || 
          target.includes('.com') || 
          target.includes('.org') || 
          target.includes('.net')) {
        directUrls.push(target);
      } else if (target.startsWith('site:')) {
        siteQueries.push(target);
      } else {
        regularQueries.push(target);
      }
    }
    
    return [...directUrls, ...siteQueries, ...regularQueries];
  }
}
