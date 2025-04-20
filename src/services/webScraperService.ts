
import { FirecrawlService } from '../utils/FirecrawlService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
}

export class WebScraperService {
  private static async processBatch(
    batch: string[], 
    onProgress?: (completed: number, total: number) => void
  ): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    const total = batch.length;
    
    for (let i = 0; i < batch.length; i++) {
      try {
        const target = batch[i];
        console.log(`Processing target ${i + 1}/${total}: ${target}`);
        
        const apiKey = FirecrawlService.getApiKey();
        if (!apiKey) {
          console.warn('No FireCrawl API key found. Please set your API key in the settings.');
          continue;
        }

        const crawlResult = await FirecrawlService.crawlWebsite(target);
        
        if (crawlResult.success && crawlResult.data) {
          console.log(`Successfully processed ${target}`);
          results.push({
            url: target,
            content: crawlResult.data.content || '',
            metadata: crawlResult.data.metadata
          });
        } else {
          console.warn(`Failed to process ${target}:`, crawlResult.error);
        }
        
        onProgress?.(i + 1, total);
      } catch (error) {
        console.error(`Error processing ${batch[i]}:`, error);
      }
    }
    
    return results;
  }

  static async scrapeSearchTargets(
    searchTargets: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    console.log('Starting to scrape search targets:', searchTargets);

    // Process targets in batches of 3
    const batchSize = 3;
    const batches = [];
    
    for (let i = 0; i < searchTargets.length; i += batchSize) {
      batches.push(searchTargets.slice(i, i + batchSize));
    }
    
    let processedCount = 0;
    const totalTargets = searchTargets.length;
    
    for (const batch of batches) {
      console.log(`Processing batch of ${batch.length} targets`);
      
      const batchResults = await this.processBatch(batch, (batchCompleted, batchTotal) => {
        const totalCompleted = processedCount + batchCompleted;
        onProgress?.(totalCompleted, totalTargets);
      });
      
      results.push(...batchResults);
      processedCount += batch.length;
      
      // Add a small delay between batches to avoid rate limiting
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Completed scraping. Found ${results.length} results.`);
    return results;
  }
}
