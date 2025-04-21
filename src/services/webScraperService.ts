
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
  "https://www.gronalund.com/en/",
  "https://www.visitstockholm.com/places/gronalund/",
  "https://www.ticketmaster.se/venue/gronalund-tickets/146593",
];

// Global research parameters
const MAX_URLS_PER_TARGET = 5;
const MAX_RESULTS_TOTAL = 15;
const URL_TIMEOUT_MS = 30000; // 30 seconds per URL
const BATCH_SIZE = 2; // Reduced to avoid rate limiting
const BATCH_DELAY_MS = 2000; // Increased to handle rate limiting
const TARGET_DELAY_MS = 3000; // Increased to handle rate limiting
const RETRY_COUNT = 2; // Number of retries for rate-limited requests
const RETRY_DELAY_MS = 5000; // Delay between retries

export class WebScraperService {
  private static isResearchCanceled = false;

  static cancelResearch() {
    this.isResearchCanceled = true;
    console.log('Research canceled by user or timeout');
  }

  // The core research function
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

      // Generate date range for search context
      const now = new Date();
      const previousYear = new Date(now);
      previousYear.setFullYear(now.getFullYear() - 1);
      const dateStr = dateWindow || `${previousYear.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;

      // Process each search target
      for (const target of searchTargets) {
        if (this.isResearchCanceled || results.length >= MAX_RESULTS_TOTAL) {
          console.log('Research stopped: canceled or enough results');
          break;
        }

        let urlsToScrape: string[] = [];
        
        // Determine if the target is a direct URL or a search query
        if (this.isDirectUrl(target)) {
          // Direct URL: format and use it directly
          const url = this.formatDirectUrl(target);
          console.log(`Target is treated as direct URL: ${url}`);
          urlsToScrape.push(url);
        } else if (serpApiKey) {
          // Search query: Use SerpAPI to find relevant URLs
          const enrichedQuery = this.enrichSearchQuery(target, researchContext, informationGoals, dateStr);
          console.log(`Using SerpAPI for query: "${enrichedQuery}"`);
          
          try {
            const searchResults = await SerpApiService.getTopSearchUrls(
              enrichedQuery,
              MAX_URLS_PER_TARGET,
              dateStr
            );
            
            if (searchResults.length > 0) {
              console.log(`SerpAPI found ${searchResults.length} URLs for "${enrichedQuery}"`);
              urlsToScrape.push(...searchResults);
            } else {
              console.log(`No results from SerpAPI for "${enrichedQuery}", using fallback source`);
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

        // Filter for unique, valid URLs
        urlsToScrape = this.filterUrls(urlsToScrape).slice(0, MAX_URLS_PER_TARGET);

        if (urlsToScrape.length === 0) {
          console.warn(`No valid URLs found for target: "${target}"`);
          continue;
        }

        console.log(`Scraping ${urlsToScrape.length} URLs for target: "${target}"`);

        // Process URLs in batches to avoid rate limiting
        for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
          if (this.isResearchCanceled || results.length >= MAX_RESULTS_TOTAL) {
            console.log('Batch stopped: canceled or enough results');
            break;
          }
          
          const batch = urlsToScrape.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch of ${batch.length} URLs (${i+1}-${i+batch.length} of ${urlsToScrape.length})`);

          // Process each URL in the batch
          const batchPromises = batch.map(async (url) => {
            return await this.scrapeUrlWithRetry(url, target);
          });

          const batchResults = await Promise.all(batchPromises);
          
          // Filter out null results and add successful results to the total
          let newResults = 0;
          for (const result of batchResults) {
            if (result) {
              results.push(result);
              newResults++;
            }
          }
          
          console.log(`Batch completed with ${newResults} successful results`);
          
          // Add delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < urlsToScrape.length) {
            await this.delay(BATCH_DELAY_MS);
          }
        }

        // Add delay between targets to avoid rate limiting
        if (searchTargets.indexOf(target) < searchTargets.length - 1) {
          await this.delay(TARGET_DELAY_MS);
        }
      }

      console.log(`Web scraper finished with ${results.length} total results`);
      return results;
    } catch (error) {
      console.error("Unexpected error in scrapeSearchTargets:", error);
      return results;
    }
  }

  // Helper method to scrape a URL with retry logic for rate limiting
  private static async scrapeUrlWithRetry(url: string, searchQuery: string): Promise<ScrapingResult | null> {
    let retries = 0;
    
    while (retries <= RETRY_COUNT) {
      try {
        const crawlResult = await FirecrawlService.crawlWebsite(url, URL_TIMEOUT_MS);
        
        if (crawlResult.success && crawlResult.data) {
          const fcData = crawlResult.data;
          const fullContent = fcData.content || '';
          
          // Successfully scraped content
          if (fullContent.trim().length > 0) {
            return {
              url: url,
              content: fullContent,
              metadata: fcData.metadata || {},
              searchQuery: searchQuery
            };
          } else {
            console.warn(`Empty content from ${url}, skipping`);
            return null;
          }
        } else {
          const errorMessage = crawlResult.error || 'Unknown error';
          
          // Check if the error is about rate limiting
          if (errorMessage.includes('Rate limit') && retries < RETRY_COUNT) {
            retries++;
            console.log(`Rate limit hit for ${url}, retry ${retries} after ${RETRY_DELAY_MS}ms`);
            await this.delay(RETRY_DELAY_MS);
          } else {
            console.warn(`Failed to scrape ${url}:`, errorMessage);
            return null;
          }
        }
      } catch (error) {
        console.error(`Error scraping URL ${url}:`, error);
        
        // Check if error message suggests rate limiting
        if (error instanceof Error && 
            error.message.includes('Rate limit') && 
            retries < RETRY_COUNT) {
          retries++;
          console.log(`Rate limit error for ${url}, retry ${retries} after ${RETRY_DELAY_MS}ms`);
          await this.delay(RETRY_DELAY_MS);
        } else {
          return null;
        }
      }
    }
    
    console.warn(`All retries failed for ${url}`);
    return null;
  }
  
  // Helper method to determine if a string is a direct URL
  private static isDirectUrl(target: string): boolean {
    return (
      target.startsWith('http') || 
      target.includes('.com') || 
      target.includes('.org') || 
      target.includes('.net') || 
      target.includes('.se') || 
      target.includes('.no')
    );
  }
  
  // Helper method to format direct URLs
  private static formatDirectUrl(target: string): string {
    if (target.startsWith('http')) {
      return target;
    }
    return `https://${target}`;
  }
  
  // Helper method to enrich search queries with context
  private static enrichSearchQuery(
    query: string, 
    researchContext?: string, 
    informationGoals?: string[], 
    dateStr?: string
  ): string {
    let enrichedQuery = query;
    
    // Add research context if not already in query
    if (researchContext && !query.toLowerCase().includes(researchContext.toLowerCase())) {
      enrichedQuery += ` ${researchContext}`;
    }
    
    // Add top information goal if available and not already in query
    if (informationGoals && informationGoals.length > 0) {
      const topGoal = informationGoals[0];
      if (!enrichedQuery.toLowerCase().includes(topGoal.toLowerCase())) {
        enrichedQuery += ` ${topGoal}`;
      }
    }
    
    // Add date range if available
    if (dateStr && !enrichedQuery.includes(dateStr)) {
      enrichedQuery += ` ${dateStr}`;
    }
    
    return enrichedQuery;
  }
  
  // Helper method to filter URLs
  private static filterUrls(urls: string[]): string[] {
    return [...new Set(urls)].filter(url => 
      FirecrawlService.isValidUrl(url) &&
      !url.startsWith('https://www.google.com/search')
    );
  }
  
  // Helper method for adding delays
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
