
import { supabase } from "@/integrations/supabase/client";
import { ScrapingResult } from "./webScraperService";

export interface ResearchIteration {
  id: number;
  searchQueries: string[];
  results: ScrapingResult[];
  analysis: string;
  confidence: number;
  nextSteps: string[];
}

export interface ResearchSummary {
  originalQuestion: string;
  iterations: ResearchIteration[];
  finalAnswer: string;
  confidence: number;
  sources: string[];
}

export class ResearchReasonerService {
  static async analyzeResults(
    question: string,
    results: ScrapingResult[],
    previousIterations: ResearchIteration[] = []
  ): Promise<{
    analysis: string;
    confidence: number;
    nextQueries: string[];
    isDone: boolean;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-research-results', {
        body: { 
          question,
          results,
          previousIterations 
        }
      });

      if (error) {
        console.error('Error calling analysis function:', error);
        throw new Error('Failed to analyze research results');
      }

      return data;
    } catch (error) {
      console.error('Error in analyzeResults:', error);
      throw error;
    }
  }

  static async generateSummary(
    question: string,
    iterations: ResearchIteration[]
  ): Promise<ResearchSummary> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-research-summary', {
        body: { 
          question,
          iterations 
        }
      });

      if (error) {
        console.error('Error calling summary function:', error);
        throw new Error('Failed to generate research summary');
      }

      return data;
    } catch (error) {
      console.error('Error in generateSummary:', error);
      throw error;
    }
  }
}
