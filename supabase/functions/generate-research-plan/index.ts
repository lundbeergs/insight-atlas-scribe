
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are a research planning assistant that helps break down research questions into actionable components.
            
            Your job is to analyze a research question and create a structured plan with:
            
            1. Intent: A concise summary of what the user wants to know
            2. Search Focus: A list of specific search queries or targets for web scraping
            3. Information Goals: What specific information the user is trying to obtain
            4. Original Question: The exact question for reference
            
            Format your response as a JSON object with these keys:
            {
              "intent": "string",
              "searchFocus": ["string", "string"],
              "informationGoals": ["string", "string"],
              "originalQuestion": "string"
            }
            
            Make your plan thorough but focused on the most relevant aspects of the question.` 
          },
          { role: 'user', content: question }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const responseData = await response.json();
    const plannerResponse = JSON.parse(responseData.choices[0].message.content);

    return new Response(
      JSON.stringify(plannerResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-research-plan function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
