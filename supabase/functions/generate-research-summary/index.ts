
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
    const { question, iterations } = await req.json();

    if (!question || !iterations) {
      return new Response(
        JSON.stringify({ error: 'Question and iterations are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the iterations data for the AI
    const iterationsContext = iterations.map((iter, idx) => {
      const resultsContext = iter.results.map(result => {
        return `- Source: ${result.url} (${result.source})
  Content: ${result.content.substring(0, 500)}...`;
      }).join('\n');

      return `Iteration ${idx + 1}:
Search Queries: ${iter.searchQueries.join(', ')}
Results:
${resultsContext}
Analysis: ${iter.analysis}
Confidence: ${iter.confidence}
---`;
    }).join('\n');

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
            content: `You are a research assistant that synthesizes information from multiple research iterations to produce a comprehensive answer.
            
Based on the research iterations provided, create a final answer to the original question.
Include:
1. A detailed answer that comprehensively addresses the original question
2. Your confidence level in this answer (0-100%)
3. A list of the most important sources that contributed to this answer

Structure your response as a JSON object with these keys:
{
  "originalQuestion": "string - repeat the original question",
  "finalAnswer": "string - your comprehensive answer",
  "confidence": number between 0-100,
  "sources": ["string array of the most important sources (URLs)"]
}

Make your answer thorough, evidence-based, and well-structured.` 
          },
          { 
            role: 'user', 
            content: `Original question: ${question}

Research iterations:
${iterationsContext}

Based on these research iterations, provide a comprehensive final answer to the original question.`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const responseData = await response.json();
    const summaryResponse = JSON.parse(responseData.choices[0].message.content);

    return new Response(
      JSON.stringify(summaryResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-research-summary function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
