
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const firecrawlAPIKey = Deno.env.get('FIRECRAWL_API_KEY');

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
    const { searchTargets, currentResults, researchGoals, iteration } = await req.json();
    console.log(`Starting research refinement - Iteration ${iteration}`);
    console.log(`Research goals: ${JSON.stringify(researchGoals)}`);
    console.log(`Current targets: ${JSON.stringify(searchTargets)}`);
    console.log(`Current results count: ${currentResults?.length || 0}`);

    // Analyze existing results and generate better search targets
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
            content: `You are an expert research assistant that helps refine web search strategies.
            
            Your task is to analyze current research results (if any), research goals, and current search targets.
            Then generate improved search targets that are more likely to yield relevant information.
            
            You should:
            1. Evaluate the quality and relevance of current results
            2. Identify gaps in the information collected
            3. Create improved search targets
            4. Convert broad queries into direct website URLs when possible
            
            Format as a JSON with:
            {
              "analysis": "A paragraph analyzing the current state and gaps",
              "improvedTargets": ["target1", "target2", ...],
              "searchPriority": ["high", "medium", "medium", ...] (matching the targets array),
              "extractionFocus": "What to look for in these sources"
            }
            
            MAKE SURE that all search targets have proper URL format or are specific search queries.
            General topics like "product pricing information" are NOT good targets.
            URLs should be specific domains people visit (e.g. "reddit.com/r/investment" not just "investment forums").
            Non-URL search targets should be specific queries, not general topics.`
          },
          { 
            role: 'user', 
            content: JSON.stringify({
              researchGoals: researchGoals || [],
              currentSearchTargets: searchTargets || [],
              currentResults: currentResults || [],
              iteration: iteration || 1
            }) 
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const responseData = await response.json();
    const refinementResults = JSON.parse(responseData.choices[0].message.content);
    
    // If we have improved targets, try to crawl them
    if (refinementResults.improvedTargets && refinementResults.improvedTargets.length > 0) {
      // Get the highest priority targets (limit to 2 to avoid hitting rate limits)
      const priorityTargets = refinementResults.improvedTargets.slice(0, 2);
      
      // Crawl the new targets
      const newResults = [];
      
      for (const target of priorityTargets) {
        try {
          // Process each target as a URL or convert search query to appropriate URL
          let processedUrl = target;
          
          // If it's not already a URL, try to format it appropriately
          if (!target.startsWith('http://') && !target.startsWith('https://')) {
            if (target.includes('.com') || target.includes('.org') || target.includes('.net') || 
                target.includes('.edu') || target.includes('.gov')) {
              processedUrl = `https://${target}`;
            } else {
              // Skip targets that can't be easily converted to URLs
              console.log(`Skipping non-URL target: ${target}`);
              continue;
            }
          }
          
          console.log(`Crawling target: ${processedUrl}`);
          
          // Perform the crawl using FireCrawl directly
          const crawlResult = await fetch('https://api.firecrawl.dev/v1/crawl-url', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlAPIKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: processedUrl,
              limit: 3,
              scrapeOptions: {
                formats: ['markdown', 'html']
              }
            })
          });
          
          const crawlResultJson = await crawlResult.json();
          
          if (crawlResultJson.success) {
            newResults.push({
              url: processedUrl,
              content: crawlResultJson.content || '',
              metadata: crawlResultJson.metadata || {}
            });
            console.log(`Successfully crawled ${processedUrl}`);
          } else {
            console.error(`Failed to crawl ${processedUrl}:`, crawlResultJson.error);
          }
        } catch (error) {
          console.error(`Error crawling ${target}:`, error);
        }
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Combine results with analysis
      return new Response(
        JSON.stringify({
          analysis: refinementResults.analysis,
          improvedTargets: refinementResults.improvedTargets,
          searchPriority: refinementResults.searchPriority,
          extractionFocus: refinementResults.extractionFocus,
          newResults
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          analysis: "Could not generate improved search targets.",
          improvedTargets: [],
          newResults: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in refine-research function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
