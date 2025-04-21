import { FirecrawlService } from '../utils/FirecrawlService';
import { SerpApiService } from '../utils/SerpApiService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
  searchQuery?: string; // Track which search query produced this result
}

// Reduced list of industry sources
const INDUSTRY_SPECIFIC_SOURCES = [
  "https://www.entrust.com/about/newsroom/events/",
  "https://www.rsaconference.com/",
  "https://securityboulevard.com/",
];

// Global research timeout
const MAX_URLS_PER_TARGET = 5;
const MAX_RESULTS_TOTAL = 15;
const URL_TIMEOUT_MS = 30000; // 30 seconds per URL
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1000;
const TARGET_DELAY_MS = 500;

export class WebScraperService {
  // Flag to track if research has been canceled or timed out
  private static isResearchCanceled = false;
  // Removed: private static researchTimeoutId

  static cancelResearch() {
    this.isResearchCanceled = true;
    // Removed: clearTimeout(this.researchTimeoutId)
    console.log('Research canceled by user or timeout');
  }

  // UPDATED: Modified to be much less strict with content relevance
  private static isContentRelevant(content: string, query: string): boolean {
    // Only check if content exists and has basic length
    if (!content || content.length < 50) {
      console.log('Content rejected: Too short or empty');
      return false;
    }
    
    // Accept if it has substantial text (very relaxed check)
    if (content.split(' ').length > 20) {
      return true;
    }
    
    // Very minimal keyword check (optional - if we get here)
    const queryWords = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    
    // If ANY single query word is found, consider it relevant
    for (const word of queryWords) {
      if (word.length > 3 && contentLower.includes(word)) {
        return true;
      }
    }
    
    // By default, accept content - we want more results rather than fewer
    return true;
  }

  // Redesigned implementation with timeouts, better concurrency, and early exit
  static async scrapeSearchTargets(
    searchTargets: string[], 
    researchContext?: string, 
    informationGoals?: string[], 
    dateWindow?: string
  ): Promise<ScrapingResult[]> {
    this.isResearchCanceled = false;
    const results: ScrapingResult[] = [];
    // REMOVED:  this.researchTimeoutId usage and global timeout logic

    try {
      const serpApiKey = SerpApiService.getApiKey();
      const firecrawlApiKey = FirecrawlService.getApiKey();
      
      if (!firecrawlApiKey) {
        console.error("No FireCrawl API key found. Please set your API key in the settings.");
        return [];
      }
      
      console.log('Starting to scrape search targets with improved performance:', searchTargets);
      console.log('Research context:', researchContext);
      
      // Set up date range for context if not provided
      const now = new Date();
      const previousYear = new Date(now);
      previousYear.setFullYear(now.getFullYear() - 1);
      const dateStr = dateWindow || `${previousYear.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;
      
      // First, prioritize targets by type (URLs first, then site queries, then regular queries)
      const prioritizedTargets = this.prioritizeTargets(searchTargets);
      
      // Process each search target individually, but with better concurrency
      for (const target of prioritizedTargets) {
        // Check if research was canceled or we have enough results
        if (this.isResearchCanceled || results.length >= MAX_RESULTS_TOTAL) {
          console.log('Research stopped: either canceled or enough results collected');
          break;
        }
        
        console.log(`Processing search target: "${target}"`);
        let urlsToScrape: string[] = [];
        
        // CASE 1: Target is already a direct URL or domain
        if (target.startsWith('http') || FirecrawlService.isValidUrl(`https://${target}`)) {
          const url = target.startsWith('http') ? target : `https://${target}`;
          console.log(`Target is direct URL: ${url}`);
          urlsToScrape.push(url);
        }
        // CASE 2: Target is a site: query, handle specially
        else if (target.startsWith('site:')) {
          try {
            if (serpApiKey) {
              // Use SerpAPI to get relevant pages from the site
              const domain = target.split('site:')[1].split(' ')[0];
              console.log(`Processing site: query for domain: ${domain}`);
              
              // First try to get URLs via SerpAPI
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
        // CASE 3: Regular search query, use SerpAPI
        else if (serpApiKey) {
          try {
            // Enrich the query with context and date ranges
            let enrichedQuery = target;
            if (researchContext && !target.includes(researchContext)) {
              enrichedQuery += ` ${researchContext}`;
            }
            
            console.log(`Using SerpAPI for query: "${enrichedQuery}"`);
            const foundUrls = await SerpApiService.getTopSearchUrls(
              enrichedQuery, 
              MAX_URLS_PER_TARGET, 
              dateStr, 
              researchContext
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
          // No SerpAPI key available
          console.warn("No SerpAPI key found. Using industry-specific source.");
          urlsToScrape.push(INDUSTRY_SPECIFIC_SOURCES[0]);
        }
        
        // Filter out invalid or duplicate URLs
        urlsToScrape = [...new Set(urlsToScrape)].filter(url => 
          FirecrawlService.isValidUrl(url) && !url.startsWith('https://www.google.com/search')
        ).slice(0, MAX_URLS_PER_TARGET); // Limit to max URLs per target
        
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
                // -- SAVE FULL CONTENT from crawl, always --
                const fcData = crawlResult.data;
                const fullContent = fcData.content || (fcData.content && fcData.content.markdown) || '';
                
                // Always accept content that has any substance
                if (fullContent.length > 0) {
                  return {
                    url: url,
                    content: fullContent,
                    metadata: fcData.metadata || {},
                    searchQuery: target
                  };
                } else {
                  console.warn(`Empty content for ${url}`);
                  return null;
                }
              } else {
                console.warn(`Failed to scrape ${url}:`, crawlResult.error);
                return null;
              }
            } catch (error) {
              console.error(`Error scraping URL ${url}:`, error);
              return null;
            }
          });
          
          // ... keep existing code (batch results processing)
          
          const batchResults = await Promise.all(batchPromises);
          let newResults = 0;
          for (const result of batchResults) {
            if (result) {
              results.push(result);
              newResults++;
            }
          }
          if (newResults === 0 && i + BATCH_SIZE < urlsToScrape.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            continue;
          }
          if (results.length >= MAX_RESULTS_TOTAL) {
            break;
          }
          if (i + BATCH_SIZE < urlsToScrape.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }
        if (searchTargets.indexOf(target) < searchTargets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, TARGET_DELAY_MS));
        }
      }

      // ... keep existing code (industry-specific fallbacks)
      
      return results;
    } catch (error) {
      console.error("Unexpected error in scrapeSearchTargets:", error);
      return results;
    }
    // Removed: finally { clearTimeout... }
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
