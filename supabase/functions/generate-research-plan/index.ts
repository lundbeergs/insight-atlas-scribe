
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const currentDate = new Date().toISOString().split('T')[0];
    const previousYear = new Date();
    previousYear.setFullYear(previousYear.getFullYear() - 1);
    const previousYearStr = previousYear.toISOString().split('T')[0];

    const prompt = `
You are a research planning assistant that breaks down questions into actionable, 
realistic research tasks using clear, natural-language search phrases.

1. **Intent**: Concise summary of WHAT the user wants to know.
2. **Search Focus**: List 6-8 highly-focused, clear, *natural-language* search queries a human would use 
   that are MOST LIKELY to retrieve relevant information. Use a mix of:
   
   A. Direct website queries like:
      - 'entrust.com/events'
      - 'entrust.com/about/newsroom/events/'
      - 'entrust.com blog'
      - Exact competitor company URLs related to events
   
   B. Natural search terms like:
      - 'Entrust events 2024'
      - 'Entrust conference participation 2024'
      - 'Entrust webinars and seminars 2024'
      - 'Entrust RSA Conference 2024'
   
   C. Industry-specific searches:
      - 'PKI industry trade shows 2024'
      - 'Cybersecurity conferences Entrust 2024'
      - 'Digital identity events Entrust speaking'
   
   * Include specific dates or recent timeframes in most queries (e.g., '2024', 'last 12 months')
   * Avoid general terms without company/industry context
   * Include at least 3 direct website URLs in your list
   
3. **Information Goals**: List the key things the user is hoping to learn (bullets).
4. **Original Question**: Just echo the user's original question.
5. **Context**: Brief overall context (dates, industry, company names, etc.) for maximum relevance.

Today's date is: ${currentDate}.
Default time frame to reference: "${previousYearStr} to ${currentDate}" for trending and current topics.

Format answer as a single JSON object:
{
  "intent": "string",
  "searchFocus": ["string", ...], 
  "informationGoals": ["string", ...],
  "originalQuestion": "string",
  "context": "string"
}

IMPORTANT: Make the search focus queries EXTREMELY SPECIFIC and HIGHLY VARIED, focusing on exact company websites, event pages, and very specific natural language searches that would give different but complementary results.
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: question + (context ? `\n\nAdditional context: ${context}` : '') }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 1000
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenAI API error:", errorData);
        return new Response(
          JSON.stringify({ error: 'OpenAI API error', details: errorData }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const responseData = await response.json();
      const plannerResponse = JSON.parse(responseData.choices[0].message.content);

      if (plannerResponse.searchFocus && plannerResponse.searchFocus.length > 8) {
        plannerResponse.searchFocus = plannerResponse.searchFocus.slice(0, 8);
      }

      return new Response(
        JSON.stringify(plannerResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error('OpenAI request timed out');
        return new Response(
          JSON.stringify({ error: 'Request timed out' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error('Error in generate-research-plan function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
