
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
  // Flag to track if research has been canceled or timed out
  private static isResearchCanceled = false;

  static cancelResearch() {
    this.isResearchCanceled = true;
    console.log('Research canceled by user or timeout');
  }

  // REMOVED: isContentRelevant function completely

  // Redesigned implementation with better search handling
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
      
      // Set up date range for context if not provided
      const now = new Date();
      const previousYear = new Date(now);
      previousYear.setFullYear(now.getFullYear() - 1);
      const dateStr = dateWindow || `${previousYear.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;
      
      // Prioritize targets by type (URLs first, then site queries, then regular queries)
      const prioritizedTargets = this.prioritizeTargets(searchTargets);
      
      // Process each search target individually
      for (const target of prioritizedTargets) {
        // Check if research was canceled or we have enough results
        if (this.isResearchCanceled || results.length >= MAX_RESULTS_TOTAL) {
          console.log('Research stopped: either canceled or enough results collected');
          break;
        }
        
        console.log(`Processing search target: "${target}"`);
        let urlsToScrape: string[] = [];
        
        // CASE 1: Target is already a direct URL
        if (target.startsWith('http') || FirecrawlService.isValidUrl(`https://${target}`)) {
          const url = target.startsWith('http') ? target : `https://${target}`;
          console.log(`Target is direct URL: ${url}`);
          urlsToScrape.push(url);
        }
        // CASE 2: Target is a site: query
        else if (target.startsWith('site:')) {
          try {
            if (serpApiKey) {
              // Use SerpAPI to get relevant pages from the site
              console.log(`Processing site: query: ${target}`);
              const foundUrls = await SerpApiService.getTopSearchUrls(
                target, 
                MAX_URLS_PER_TARGET, 
                dateStr, 
                researchContext
              );
              
              if (foundUrls.length > 0) {
                console.log(`SerpAPI returned ${foundUrls.length} URLs for site: query`);
                urlsToScrape.push(...foundUrls);
              } else {
                // Fallback: just use the domain directly
                const domain = target.split('site:')[1].split(' ')[0];
                console.log(`No SerpAPI results, falling back to direct domain: ${domain}`);
                urlsToScrape.push(`https://${domain}`);
              }
            } else {
              // No SerpAPI key: extract domain and use directly
              const domain = target.split('site:')[1].split(' ')[0];
              urlsToScrape.push(`https://${domain}`);
            }
          } catch (error) {
            console.error(`Error processing site: query ${target}:`, error);
          }
        }
        // CASE 3: Regular search query - ALWAYS USE SerpAPI if available
        else if (serpApiKey) {
          try {
            // Add context to the query if provided
            let enrichedQuery = target;
            if (researchContext && !target.includes(researchContext)) {
              enrichedQuery += ` ${researchContext}`;
            }
            
            console.log(`Using SerpAPI for query: "${enrichedQuery}"`);
            const foundUrls = await SerpApiService.getTopSearchUrls(
              enrichedQuery, 
              MAX_URLS_PER_TARGET, 
              dateStr
            );
            
            if (foundUrls.length > 0) {
              console.log(`SerpAPI found ${foundUrls.length} URLs for "${target}"`);
              urlsToScrape.push(...foundUrls);
            } else {
              console.warn(`SerpAPI returned no results for "${target}"`);
              // Add one industry-specific source as fallback
              urlsToScrape.push(INDUSTRY_SPECIFIC_SOURCES[0]);
            }
          } catch (error) {
            console.error(`SerpAPI error for "${target}":`, error);
            // On SerpAPI failure, use one industry source
            urlsToScrape.push(INDUSTRY_SPECIFIC_SOURCES[0]);
          }
        } else {
          // No SerpAPI key available, use industry sources
          console.warn("No SerpAPI key found. Using industry-specific source.");
          urlsToScrape.push(INDUSTRY_SPECIFIC_SOURCES[0]);
        }
        
        // Filter out invalid or duplicate URLs
        urlsToScrape = [...new Set(urlsToScrape)].filter(url => 
          FirecrawlService.isValidUrl(url) && !url.startsWith('https://www.google.com/search')
        ).slice(0, MAX_URLS_PER_TARGET);
        
        // If we still have no valid URLs, continue to next target
        if (urlsToScrape.length === 0) {
          console.warn(`No valid URLs found for target: "${target}"`);
          continue;
        }
        
        console.log(`Prepared ${urlsToScrape.length} URLs to scrape for target: "${target}"`);
        
        // Crawl URLs in batches with improved concurrency
        for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
          // Check if research was canceled or we have enough results
          if (this.isResearchCanceled || results.length >= MAX_RESULTS_TOTAL) {
            console.log('Batch processing stopped: either canceled or enough results collected');
            break;
          }
          
          const batch = urlsToScrape.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch of ${batch.length} URLs (${i+1}-${i+batch.length} of ${urlsToScrape.length})`);
          
          const batchPromises = batch.map(async (url) => {
            try {
              const crawlResult = await FirecrawlService.crawlWebsite(url, URL_TIMEOUT_MS);

              if (crawlResult.success && crawlResult.data) {
                // Always accept the content regardless of relevance
                const fcData = crawlResult.data;
                const fullContent = fcData.content || '';
                
                // Accept any content of any length
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
        
        if (prioritizedTargets.indexOf(target) < prioritizedTargets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, TARGET_DELAY_MS));
        }
      }

      console.log(`Web scraper completed with ${results.length} results found`);
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
