
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
    const { question, context } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

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
            2. Search Focus: A detailed list of specific search queries that will yield comprehensive results.
               For tech industry research, include industry-specific sites, forums, and event directories.
               For competitive analysis, include specific industry sources and company names.
               For event research, include conference sites, industry events, and dates.
            3. Information Goals: What specific information the user is trying to obtain
            4. Original Question: The exact question for reference
            5. Context: Research context, dates, and domain information for better search relevance
            
            Today's date is: ${currentDate}
            
            Format your response as a JSON object with these keys:
            {
              "intent": "string",
              "searchFocus": ["string", "string"],
              "informationGoals": ["string", "string"],
              "originalQuestion": "string",
              "context": "string"
            }
            
            Make your plan thorough but focused on the most relevant aspects of the question.
            When creating search queries, be very specific and add date ranges when relevant.
            Add at least 5-8 search focus items to ensure comprehensive coverage.` 
          },
          { role: 'user', content: question + (context ? `\n\nAdditional context: ${context}` : '') }
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
