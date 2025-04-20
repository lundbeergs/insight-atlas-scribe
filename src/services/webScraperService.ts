
import { FirecrawlService } from '../utils/FirecrawlService';
import { SerpApiService } from '../utils/SerpApiService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
  searchQuery?: string; // Track which search query produced this result
}

// Default industry sources to try when other methods fail
const INDUSTRY_SPECIFIC_SOURCES = [
  "https://www.entrust.com/about/newsroom/events/",
  "https://www.rsaconference.com/",
  "https://securityboulevard.com/",
  "https://www.blackhat.com/",
  "https://www.infosecurity-magazine.com/",
  "https://www.securityweek.com/",
];

export class WebScraperService {
  // Completely redesigned implementation with better handling of search targets
  static async scrapeSearchTargets(
    searchTargets: string[], 
    researchContext?: string, 
    informationGoals?: string[], 
    dateWindow?: string
  ): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    const serpApiKey = SerpApiService.getApiKey();
    const firecrawlApiKey = FirecrawlService.getApiKey();
    
    if (!firecrawlApiKey) {
      console.error("No FireCrawl API key found. Please set your API key in the settings.");
      return [];
    }
    
    console.log('Starting to scrape search targets:', searchTargets);
    console.log('Research context:', researchContext);
    
    // Set up date range for context if not provided
    const now = new Date();
    const previousYear = new Date(now);
    previousYear.setFullYear(now.getFullYear() - 1);
    const dateStr = dateWindow || `${previousYear.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;
    
    // Process each search target individually to maintain relevance and context
    for (const target of searchTargets) {
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
            const foundUrls = await SerpApiService.getTopSearchUrls(target, 10, dateStr, researchContext);
            
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
          const foundUrls = await SerpApiService.getTopSearchUrls(enrichedQuery, 10, dateStr, researchContext);
          
          if (foundUrls.length > 0) {
            console.log(`SerpAPI found ${foundUrls.length} URLs for "${target}"`);
            urlsToScrape.push(...foundUrls);
          } else {
            console.warn(`SerpAPI returned no results for "${target}"`);
            // Add some industry-specific sources as fallback
            urlsToScrape.push(...INDUSTRY_SPECIFIC_SOURCES.slice(0, 3));
          }
        } catch (error) {
          console.error(`SerpAPI error for "${target}":`, error);
          // On SerpAPI failure, use industry sources
          urlsToScrape.push(...INDUSTRY_SPECIFIC_SOURCES.slice(0, 3));
        }
      } else {
        // No SerpAPI key available
        console.warn("No SerpAPI key found. Using industry-specific sources.");
        urlsToScrape.push(...INDUSTRY_SPECIFIC_SOURCES.slice(0, 3));
      }
      
      // Filter out invalid or duplicate URLs
      urlsToScrape = [...new Set(urlsToScrape)].filter(url => 
        FirecrawlService.isValidUrl(url) && !url.startsWith('https://www.google.com/search')
      );
      
      // If we still have no valid URLs, continue to next target
      if (urlsToScrape.length === 0) {
        console.warn(`No valid URLs found for target: "${target}"`);
        continue;
      }
      
      console.log(`Prepared ${urlsToScrape.length} URLs to scrape for target: "${target}"`);
      
      // Crawl URLs in batches of 2 to respect rate limits
      const maxBatchSize = 2;
      for (let i = 0; i < urlsToScrape.length; i += maxBatchSize) {
        const batch = urlsToScrape.slice(i, i + maxBatchSize);
        console.log(`Processing batch of ${batch.length} URLs (${i+1}-${i+batch.length} of ${urlsToScrape.length})`);
        
        const batchPromises = batch.map(async (url) => {
          try {
            const crawlResult = await FirecrawlService.crawlWebsite(url);
            
            if (crawlResult.success && crawlResult.data) {
              // Verify we have useful content
              const content = crawlResult.data.content || '';
              if (content.length > 100) {
                console.log(`Successfully scraped ${url} (${content.length} chars)`);
                return {
                  url: url,
                  content: content,
                  metadata: crawlResult.data.metadata || {},
                  searchQuery: target
                };
              } else {
                console.warn(`Content too short for ${url}: ${content.length} chars`);
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
        
        const batchResults = await Promise.all(batchPromises);
        for (const result of batchResults) {
          if (result) results.push(result);
        }
        
        // Add delay between batches to avoid rate limiting
        if (i + maxBatchSize < urlsToScrape.length) {
          console.log(`Waiting 2 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Add a small delay between different search targets
      if (searchTargets.indexOf(target) < searchTargets.length - 1) {
        console.log(`Completed target "${target}". Waiting 1 second before next target...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Completed scraping. Found ${results.length} results.`);
    
    // If we found no results at all, try the industry sources directly
    if (results.length === 0) {
      console.log("No results found. Trying industry-specific sources directly.");
      const industryPromises = INDUSTRY_SPECIFIC_SOURCES.slice(0, 3).map(async (url) => {
        try {
          const crawlResult = await FirecrawlService.crawlWebsite(url);
          if (crawlResult.success && crawlResult.data) {
            return {
              url: url,
              content: crawlResult.data.content || '',
              metadata: crawlResult.data.metadata || {},
              searchQuery: 'Industry-specific source'
            };
          }
        } catch (error) {
          console.error(`Error with industry source ${url}:`, error);
        }
        return null;
      });
      
      const industryResults = await Promise.all(industryPromises);
      for (const result of industryResults) {
        if (result) results.push(result);
      }
    }
    
    return results;
  }
}
