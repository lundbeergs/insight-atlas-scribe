
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
    const { question, results, previousIterations } = await req.json();

    if (!question || !results) {
      return new Response(
        JSON.stringify({ error: 'Question and results are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare a context for the OpenAI request by extracting content from results
    const context = results.map(result => {
      return `Source: ${result.url} (${result.source})
Content: ${result.content.substring(0, 1000)}
---`;
    }).join('\n');

    // Prepare previous iterations context
    const iterationsContext = previousIterations.length > 0 
      ? `Previous research iterations:
${previousIterations.map((iter, idx) => 
  `Iteration ${idx + 1}:
  - Queries: ${iter.searchQueries.join(', ')}
  - Analysis: ${iter.analysis}
  - Confidence: ${iter.confidence}
  - Next steps: ${iter.nextSteps.join(', ')}`
).join('\n')}`
      : '';

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
            content: `You are a research assistant that analyzes search results and determines next steps.
            
Analyze the provided search results and determine:
1. How relevant they are to the original question
2. What information we've learned
3. What gaps still exist
4. What confidence level we have in our current understanding (0-100%)
5. Whether more searching is needed
6. What specific search queries would help fill in the gaps

Structure your response as a JSON object with these keys:
{
  "analysis": "string summary of what we've learned and gaps",
  "confidence": number between 0-100,
  "nextQueries": ["string array of 1-3 specific search queries for the next iteration"],
  "isDone": boolean indicating if research is complete
}

Provide thoughtful analysis that shows you've carefully evaluated the search results.` 
          },
          { 
            role: 'user', 
            content: `Original question: ${question}

${iterationsContext}

Current search results:
${context}

Based on these results, provide your analysis, confidence score, and determine if we need more information.`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const responseData = await response.json();
    const analysisResponse = JSON.parse(responseData.choices[0].message.content);

    return new Response(
      JSON.stringify(analysisResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-research-results function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
