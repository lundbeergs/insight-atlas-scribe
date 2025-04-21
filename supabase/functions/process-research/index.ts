
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
    const { scrapingResults, intent, searchFocus, informationGoals, originalQuestion, context } = await req.json();

    if (!scrapingResults || scrapingResults.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No scraping results provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${scrapingResults.length} research results`);

    // Prepare content for analysis
    const resultTexts = scrapingResults.map(result => {
      return `SOURCE: ${result.url}
CONTENT: ${result.content ? result.content.substring(0, 4000) : "No content"}\n\n`;
    }).join('');

    // The system prompt for the cleaner agent
    const systemPrompt = `
You are a Research Cleaner Agent specialized in extracting structured information from scraped web content.
Your job is to analyze all the provided content and extract the most accurate, relevant information 
that answers the user's original research question, specifically in the context of:
- Intent: ${intent}
- Information Goals: ${informationGoals.join(', ')}
- Original Question: ${originalQuestion}
${context ? `- Additional Context: ${context}` : ''}

TASK:
1. Analyze each piece of scraped content carefully.
2. Extract all information relevant to the research question, with a focus on factual information.
3. For event research, extract specific dates, locations, names, and descriptions.
4. For competitor analysis, focus on gathering specific competitive intelligence that is useful.
5. Format the information in a structured way with properly organized sections.
6. Prefer specific, concrete information over vague statements.

FORMAT YOUR RESPONSE AS A JSON OBJECT with these keys:
{
  "structuredInsights": {
    // Organize by themes or categories
    "category1": [
      {"fact": "specific fact 1", "source": "URL source of this fact"},
      {"fact": "specific fact 2", "source": "URL source of this fact"}
    ],
    "category2": [
      // Same structure
    ]
  },
  "relevantFindings": [
    "Most important finding 1",
    "Most important finding 2",
    // Up to 10 key findings
  ],
  "suggestedNextSteps": [
    "Specific suggestion 1",
    "Specific suggestion 2"
  ],
  "analysis": "Overall analysis paragraph summarizing the findings in relation to the original question"
}
`;

    // Maximum token limit for GPT-4
    const maxTokens = 12000;
    let truncatedContent = resultTexts;
    if (truncatedContent.length > maxTokens * 4) { // Rough char-to-token conversion
      truncatedContent = truncatedContent.substring(0, maxTokens * 4);
      console.log(`Content truncated to ${truncatedContent.length} characters to fit token limits`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45-second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: truncatedContent }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 2000
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
      const cleanerResponse = JSON.parse(responseData.choices[0].message.content);

      return new Response(
        JSON.stringify(cleanerResponse),
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
    console.error('Error in process-research function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
