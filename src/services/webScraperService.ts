
import { FirecrawlService } from '../utils/FirecrawlService';
import { SerpApiService } from './serpApiService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
  source: 'firecrawl' | 'serpapi';
  title?: string;
}

export class WebScraperService {
  static async scrapeSearchTargets(searchTargets: string[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const target of searchTargets) {
      try {
        const crawlResult = await FirecrawlService.crawlWebsite(target);
        
        if (crawlResult.success && crawlResult.data) {
          results.push({
            url: target,
            content: crawlResult.data.content || '',
            metadata: crawlResult.data.metadata,
            source: 'firecrawl'
          });
        }
      } catch (error) {
        console.error(`Error scraping ${target}:`, error);
      }
    }

    return results;
  }

  static async searchWithSerpApi(queries: string[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const query of queries) {
      try {
        const searchResult = await SerpApiService.searchWeb(query);
        
        if (searchResult.success && searchResult.results) {
          for (const result of searchResult.results) {
            results.push({
              url: result.link,
              content: result.snippet || '',
              title: result.title || '',
              source: 'serpapi',
              metadata: { 
                position: result.position,
                displayed_link: result.displayed_link
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error searching with SerpAPI for ${query}:`, error);
      }
    }

    return results;
  }

  static async conductResearch(searchQueries: string[]): Promise<ScrapingResult[]> {
    const allResults: ScrapingResult[] = [];
    
    // Get SerpAPI results
    try {
      const serpResults = await this.searchWithSerpApi(searchQueries);
      allResults.push(...serpResults);
    } catch (error) {
      console.error('Error with SerpAPI search:', error);
    }
    
    // Get Firecrawl results for any URLs found in SerpAPI results
    try {
      const urlsToScrape = allResults
        .filter(result => result.source === 'serpapi')
        .map(result => result.url)
        .slice(0, 5); // Limit to first 5 URLs to avoid overloading
      
      if (urlsToScrape.length > 0) {
        const firecrawlResults = await this.scrapeSearchTargets(urlsToScrape);
        allResults.push(...firecrawlResults);
      }
    } catch (error) {
      console.error('Error with Firecrawl scraping:', error);
    }
    
    return allResults;
  }
}
