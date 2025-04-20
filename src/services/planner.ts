
import { supabase } from "@/integrations/supabase/client";

interface PlannerResponse {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

export async function createPlannerResponse(question: string): Promise<PlannerResponse> {
  const { data, error } = await supabase.functions.invoke('generate-research-plan', {
    body: { question }
  });

  if (error) {
    console.error('Error calling Supabase Edge Function:', error);
    throw new Error('Failed to generate research plan');
  }

  return data;
}
