
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
    const previousYear = new Date();
    previousYear.setFullYear(previousYear.getFullYear() - 1);
    const previousYearStr = previousYear.toISOString().split('T')[0];

    // Enhanced system prompt for specificity/context/sources/dates
    const prompt = `You are a research planning assistant that helps break down research questions into actionable components.

Your job is to analyze a research question and create a structured plan with:
1. Intent: A concise summary of what the user wants to know.
2. Search Focus: A detailed list of highly specific search queries and direct sites that will yield comprehensive results. Always include:
    a. Industry context and domains (e.g., "PKI", "HID Global competitor analysis").
    b. Add targeted website domains for industry (conference directories, event sites, company news, etc).
    c. Append explicit date ranges (e.g., "2024", or "${previousYearStr} to ${currentDate}") to queries for time relevance.
    d. Build queries so that at least half are formatted as direct site:domain.com or event directory URLs (not just Google search terms).
    e. No more than 3 queries should be broad Google queries—prefer direct sources.
    f. Always ensure a minimum of 7-8 unique, context-rich, and date-scoped queries for comprehensive results.
    g. Include specific URLs like "https://www.entrust.com/about/events/" if the site has a dedicated events page.
    h. For event research, include conference directory sites like eventbrite.com, conferenceindex.org and industry conference sites.
3. Information Goals: What specific information the user is trying to obtain (summarized by you).
4. Original Question: The exact question for reference.
5. Context: Research context, dates, domain, industry, company names, etc for better search relevance.

Today's date is: ${currentDate}.
For current events or trends, use the past year (${previousYearStr} to ${currentDate}) as the default window unless otherwise stated.

FORMAT your response as a single JSON object with these keys:
{
  "intent": "string",
  "searchFocus": ["string", "string", ...],
  "informationGoals": ["string", ...],
  "originalQuestion": "string",
  "context": "string"
}

Make your plan thorough, focused, and always cover the most relevant industry and date-specific targets.
`;

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
            content: prompt
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
