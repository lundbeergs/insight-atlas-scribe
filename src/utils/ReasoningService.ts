
// This service provides the AI reasoning layer for intelligent web scraping

interface ReasoningResults {
  relevanceScores: Map<string, number>;
  extractionFocus: string;
  improvedQueries: string[];
  contentSummary: string;
  confidenceScore: number;
}

export interface ContentAnalysis {
  analysis: string;
  improvedTargets: string[];
  searchPriority: string[];
  extractionFocus: string;
  summary?: string;
  confidence?: number;
}

export class ReasoningService {
  /**
   * Analyzes a collection of scraped content to determine relevance
   * and generate improved search queries
   */
  static async analyzeContent(
    content: Array<{ url: string; content: string }>,
    originalQuery: string,
    informationGoals: string[]
  ): Promise<ContentAnalysis> {
    console.log(`Analyzing ${content.length} content items for query: ${originalQuery}`);
    
    try {
      // For now, use the edge function to perform analysis
      // This will be replaced with direct API calls in future versions
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Call our edge function to analyze the content and provide recommendations
      const response = await supabase.functions.invoke('refine-research', {
        body: { 
          searchTargets: [originalQuery], 
          currentResults: content,
          researchGoals: informationGoals,
          iteration: 1
        }
      });
      
      if (response.error) {
        console.error("Content analysis failed:", response.error);
        throw new Error(response.error.message);
      }
      
      return {
        analysis: response.data.analysis || "No analysis available",
        improvedTargets: response.data.improvedTargets || [],
        searchPriority: response.data.searchPriority || [],
        extractionFocus: response.data.extractionFocus || "",
        summary: response.data.summary,
        confidence: response.data.confidence
      };
    } catch (error) {
      console.error("Error analyzing content:", error);
      return {
        analysis: "Analysis failed due to an error",
        improvedTargets: [],
        searchPriority: [],
        extractionFocus: ""
      };
    }
  }
  
  /**
   * Scores the relevance of a piece of content to the research goals
   * Returns a score between 0 and 1
   */
  static scoreRelevance(content: string, query: string, goals: string[]): number {
    if (!content || content.trim().length === 0) {
      return 0;
    }
    
    // Simple keyword-based scoring for now
    // This will be enhanced in future versions
    const contentLower = content.toLowerCase();
    const queryTerms = query.toLowerCase().split(/\s+/);
    const goalTerms = goals.flatMap(goal => goal.toLowerCase().split(/\s+/));
    
    // Count occurrences of query terms
    const queryMatches = queryTerms.filter(term => 
      term.length > 3 && contentLower.includes(term)
    ).length;
    
    // Count occurrences of goal terms
    const goalMatches = goalTerms.filter(term => 
      term.length > 3 && contentLower.includes(term)
    ).length;
    
    // Calculate composite score
    const queryScore = queryTerms.length > 0 ? queryMatches / queryTerms.length : 0;
    const goalScore = goalTerms.length > 0 ? goalMatches / goalTerms.length : 0;
    
    // Weight query matches higher than goal matches
    return queryScore * 0.6 + goalScore * 0.4;
  }
  
  /**
   * Generates enhanced extraction schema based on content and goals
   */
  static generateExtractionSchema(informationGoals: string[]): Record<string, any> {
    // Create a dynamic schema based on information goals
    const schema: Record<string, any> = {
      title: { type: "STRING", selector: "h1" },
      content: { type: "STRING", selector: "article, main, .content" },
    };
    
    // Add fields based on information goals
    informationGoals.forEach((goal, index) => {
      const fieldName = `goal_${index + 1}`;
      schema[fieldName] = { 
        type: "STRING", 
        description: goal
      };
    });
    
    return schema;
  }
}
