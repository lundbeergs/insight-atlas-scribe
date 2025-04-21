
import { ScrapingResult } from './webScraperService';
import { supabase } from '@/integrations/supabase/client';

interface CleanerRequest {
  scrapingResults: ScrapingResult[];
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
  context?: string;
}

interface CleanerResponse {
  structuredInsights: any;
  relevantFindings: string[];
  suggestedNextSteps?: string[];
  analysis: string;
}

export class CleanerAgentService {
  static async processResults(
    scrapingResults: ScrapingResult[],
    intent: string,
    searchFocus: string[],
    informationGoals: string[],
    originalQuestion: string,
    context?: string
  ): Promise<CleanerResponse | null> {
    try {
      console.log('Cleaning and structuring research results...');
      
      if (!scrapingResults || scrapingResults.length === 0) {
        console.warn('No results to clean');
        return null;
      }
      
      // Prepare a request for the Supabase Edge Function
      const cleanerRequest: CleanerRequest = {
        scrapingResults,
        intent,
        searchFocus,
        informationGoals,
        originalQuestion,
        context
      };
      
      console.log(`Sending ${scrapingResults.length} results to cleaner agent`);
      
      // Call the Supabase Edge Function to process the results
      const { data, error } = await supabase.functions.invoke(
        'process-research', 
        { 
          body: cleanerRequest
        }
      );
      
      if (error) {
        console.error('Error invoking cleaner agent:', error);
        return null;
      }
      
      console.log('Cleaner agent completed successfully');
      return data;
      
    } catch (error) {
      console.error('Error in cleaner agent service:', error);
      return null;
    }
  }
}
