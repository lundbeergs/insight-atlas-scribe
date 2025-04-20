
import { FirecrawlService } from '../utils/FirecrawlService';
import { ReasoningService, ContentAnalysis } from '../utils/ReasoningService';

export interface ScrapingResult {
  url: string;
  content: string;
  metadata?: Record<string, any>;
  extractedData?: Record<string, any>;
  relevanceScore?: number;
}

export interface ResearchPlan {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

export interface ResearchIteration {
  targets: string[];
  results: ScrapingResult[];
  analysis?: string;
  extractionFocus?: string;
  improvedTargets?: string[];
}

export class WebScraperService {
  private static contentCache = new Map<string, ScrapingResult>();
  private static iterationHistory: ResearchIteration[] = [];
  private static currentResearchPlan: ResearchPlan | null = null;
  
  /**
   * Sets the current research plan for context-aware scraping
   */
  static setResearchPlan(plan: ResearchPlan): void {
    this.currentResearchPlan = plan;
    // Reset iteration history when a new plan is set
    this.iterationHistory = [];
  }
  
  /**
   * Gets the current research iterations
   */
  static getIterations(): ResearchIteration[] {
    return this.iterationHistory;
  }

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
        
        // Check cache first
        const cacheKey = `scrape_${target}`;
        if (this.contentCache.has(cacheKey)) {
          console.log(`Using cached result for ${target}`);
          results.push(this.contentCache.get(cacheKey)!);
          onProgress?.(i + 1, total);
          continue;
        }
        
        const apiKey = FirecrawlService.getApiKey();
        if (!apiKey) {
          console.warn('No FireCrawl API key found. Please set your API key in the settings.');
          continue;
        }

        // First, try the search API if the target looks like a search query
        let searchResults: { url: string, title: string, snippet: string }[] = [];
        if (!target.includes('://') && !target.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/)) {
          console.log(`Target looks like a search query, using search API: ${target}`);
          const searchResponse = await FirecrawlService.search(target, { limit: 5 });
          if (searchResponse.success && searchResponse.results) {
            searchResults = searchResponse.results;
            console.log(`Found ${searchResults.length} search results for query "${target}"`);
          }
        }
        
        // Process the target URL directly if it's not a search query or if search returned no results
        if (searchResults.length === 0) {
          const crawlResult = await FirecrawlService.crawlWebsite(target);
          
          if (crawlResult.success && crawlResult.data) {
            console.log(`Successfully processed ${target}`);
            const result: ScrapingResult = {
              url: target,
              content: crawlResult.data.content || '',
              metadata: crawlResult.data.metadata
            };
            
            // Score the relevance if we have a research plan
            if (this.currentResearchPlan) {
              result.relevanceScore = ReasoningService.scoreRelevance(
                result.content,
                this.currentResearchPlan.originalQuestion,
                this.currentResearchPlan.informationGoals
              );
            }
            
            // Try to extract structured data if we have information goals
            if (this.currentResearchPlan?.informationGoals.length) {
              try {
                const schema = ReasoningService.generateExtractionSchema(
                  this.currentResearchPlan.informationGoals
                );
                
                // Ensure schema is always an array
                const schemaArray = Array.isArray(schema) ? schema : [schema];
                
                const extractionResult = await FirecrawlService.extractStructuredData(target, schemaArray);
                if (extractionResult.success && extractionResult.data) {
                  result.extractedData = extractionResult.data;
                }
              } catch (extractError) {
                console.warn(`Failed to extract structured data from ${target}:`, extractError);
              }
            }
            
            // Cache the result
            this.contentCache.set(cacheKey, result);
            results.push(result);
          } else {
            console.warn(`Failed to process ${target}:`, crawlResult.error);
          }
        } else {
          // Process the top search results
          for (const searchResult of searchResults.slice(0, 2)) { // Limit to top 2 to avoid rate limiting
            console.log(`Processing search result: ${searchResult.url}`);
            const crawlResult = await FirecrawlService.crawlWebsite(searchResult.url);
            
            if (crawlResult.success && crawlResult.data) {
              console.log(`Successfully processed search result ${searchResult.url}`);
              const result: ScrapingResult = {
                url: searchResult.url,
                content: crawlResult.data.content || '',
                metadata: {
                  ...crawlResult.data.metadata,
                  title: searchResult.title,
                  snippet: searchResult.snippet,
                  fromSearch: target // Track the original search query
                }
              };
              
              // Score the relevance
              if (this.currentResearchPlan) {
                result.relevanceScore = ReasoningService.scoreRelevance(
                  result.content,
                  this.currentResearchPlan.originalQuestion,
                  this.currentResearchPlan.informationGoals
                );
              }
              
              // Cache the result
              this.contentCache.set(`scrape_${searchResult.url}`, result);
              results.push(result);
            }
          }
        }
        
        onProgress?.(i + 1, total);
      } catch (error) {
        console.error(`Error processing ${batch[i]}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Scrapes content from a list of search targets
   * Returns results sorted by relevance if possible
   */
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
    
    // Create a new iteration to track this research step
    const currentIteration: ResearchIteration = {
      targets: searchTargets,
      results: []
    };
    
    for (const batch of batches) {
      console.log(`Processing batch of ${batch.length} targets`);
      
      const batchResults = await this.processBatch(batch, (batchCompleted, batchTotal) => {
        const totalCompleted = processedCount + batchCompleted;
        onProgress?.(totalCompleted, totalTargets);
      });
      
      results.push(...batchResults);
      currentIteration.results.push(...batchResults);
      processedCount += batch.length;
      
      // Add a small delay between batches to avoid rate limiting
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Completed scraping. Found ${results.length} results.`);
    
    // Sort results by relevance score if available
    if (results.some(r => r.relevanceScore !== undefined)) {
      results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }
    
    // Store the iteration in history
    this.iterationHistory.push(currentIteration);
    
    return results;
  }
  
  /**
   * Analyzes current results and generates the next set of search targets
   */
  static async analyzeAndRefine(
    results: ScrapingResult[],
    originalQuery: string
  ): Promise<ContentAnalysis> {
    if (!this.currentResearchPlan) {
      throw new Error('No research plan set. Call setResearchPlan() first.');
    }
    
    // Convert results to format expected by reasoning service
    const contentForAnalysis = results.map(r => ({
      url: r.url,
      content: r.content
    }));
    
    // Call reasoning service to analyze and get improved targets
    const analysis = await ReasoningService.analyzeContent(
      contentForAnalysis,
      originalQuery,
      this.currentResearchPlan.informationGoals
    );
    
    // Update the current iteration with analysis results
    if (this.iterationHistory.length > 0) {
      const currentIteration = this.iterationHistory[this.iterationHistory.length - 1];
      currentIteration.analysis = analysis.analysis;
      currentIteration.extractionFocus = analysis.extractionFocus;
      currentIteration.improvedTargets = analysis.improvedTargets;
    }
    
    return analysis;
  }
  
  /**
   * Clear the scraper's cache and history
   */
  static reset(): void {
    this.contentCache.clear();
    this.iterationHistory = [];
    this.currentResearchPlan = null;
  }
}
