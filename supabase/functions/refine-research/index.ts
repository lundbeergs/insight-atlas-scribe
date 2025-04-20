
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
    const { searchTargets, currentResults, researchGoals, iteration, context } = await req.json();
    console.log(`Starting research refinement - Iteration ${iteration}`);
    console.log(`Research goals: ${JSON.stringify(researchGoals)}`);
    console.log(`Current targets: ${JSON.stringify(searchTargets)}`);
    console.log(`Current results count: ${currentResults?.length || 0}`);
    console.log(`Context: ${context || 'None provided'}`);

    // Group results by search query to identify gaps
    const resultsByQuery = {};
    if (currentResults && currentResults.length > 0) {
      currentResults.forEach(result => {
        if (result.searchQuery) {
          resultsByQuery[result.searchQuery] = resultsByQuery[result.searchQuery] || [];
          resultsByQuery[result.searchQuery].push(result);
        }
      });
    }
    
    // Find search targets with no or few results
    const underperformingQueries = searchTargets.filter(target => 
      !resultsByQuery[target] || resultsByQuery[target].length < 3
    );
    
    console.log(`Underperforming queries: ${JSON.stringify(underperformingQueries)}`);

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
            3. Create improved search targets, especially for queries with insufficient results
            4. Add highly specific industry sources and event directories relevant to the domain
            5. Convert broad queries into direct website URLs when possible
            
            Format as a JSON with:
            {
              "analysis": "A paragraph analyzing the current state and gaps",
              "improvedTargets": ["target1", "target2", ...],
              "searchPriority": ["high", "medium", "medium", ...] (matching the targets array),
              "extractionFocus": "What to look for in these sources",
              "industrySpecificSites": ["site1", "site2",...] (domain-specific sites to check)
            }
            
            MAKE SURE that all search targets have proper URL format or are specific search queries.
            For tech industry research, be sure to include specific event directories, conference websites, and industry forums.
            Add context (dates, industry terms) to search queries to improve relevance.
            Include at least 5-8 improved targets focusing on queries that didn't yield good results before.
            
            For underperforming queries, create variations that might yield better results.`
          },
          { 
            role: 'user', 
            content: JSON.stringify({
              researchGoals: researchGoals || [],
              currentSearchTargets: searchTargets || [],
              currentResults: currentResults || [],
              iteration: iteration || 1,
              context: context || '',
              underperformingQueries: underperformingQueries || []
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
      // Get all high priority targets (up to 5)
      const highPriorityTargets = [];
      if (refinementResults.searchPriority) {
        for (let i = 0; i < refinementResults.improvedTargets.length; i++) {
          if (refinementResults.searchPriority[i] === 'high' && highPriorityTargets.length < 5) {
            highPriorityTargets.push(refinementResults.improvedTargets[i]);
          }
        }
      }
      
      // If no high priority targets, just take the first 5
      const priorityTargets = highPriorityTargets.length > 0 
        ? highPriorityTargets 
        : refinementResults.improvedTargets.slice(0, 5);
      
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
              // For non-URL targets, try to use SerpAPI first
              if (SerpApiService.getApiKey()) {
                try {
                  const serpUrls = await SerpApiService.getTopSearchUrls(target, 5);
                  if (serpUrls.length > 0) {
                    // Process each URL from SerpAPI
                    for (const serpUrl of serpUrls) {
                      console.log(`Crawling SerpAPI result: ${serpUrl}`);
                      const crawlResult = await fetch('https://api.firecrawl.dev/v1/crawl-url', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${firecrawlAPIKey}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          url: serpUrl,
                          limit: 5,
                          scrapeOptions: {
                            formats: ['markdown', 'html']
                          }
                        })
                      });
                      
                      const crawlResultJson = await crawlResult.json();
                      
                      if (crawlResultJson.success) {
                        newResults.push({
                          url: serpUrl,
                          content: crawlResultJson.content || '',
                          metadata: crawlResultJson.metadata || {},
                          searchQuery: target
                        });
                        console.log(`Successfully crawled ${serpUrl}`);
                      }
                      
                      // Small delay between crawls
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    // Continue to next target after processing all SerpAPI results
                    continue;
                  }
                } catch (err) {
                  console.error(`SerpAPI error for ${target}:`, err);
                }
              }
              
              // If SerpAPI fails or is not available, skip this non-URL target
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
              limit: 5, // Increased from 3 to 5
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
              metadata: crawlResultJson.metadata || {},
              searchQuery: target
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
      
      // Process industry-specific sites if provided
      if (refinementResults.industrySpecificSites && refinementResults.industrySpecificSites.length > 0) {
        const industryTargets = refinementResults.industrySpecificSites.slice(0, 3); // Process up to 3 industry sites
        
        for (const target of industryTargets) {
          try {
            let processedUrl = target;
            if (!target.startsWith('http://') && !target.startsWith('https://')) {
              processedUrl = `https://${target}`;
            }
            
            console.log(`Crawling industry-specific site: ${processedUrl}`);
            
            const crawlResult = await fetch('https://api.firecrawl.dev/v1/crawl-url', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlAPIKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                url: processedUrl,
                limit: 5,
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
                metadata: crawlResultJson.metadata || {},
                searchQuery: 'Industry-specific site'
              });
              console.log(`Successfully crawled industry site ${processedUrl}`);
            }
          } catch (error) {
            console.error(`Error crawling industry site ${target}:`, error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Combine results with analysis
      return new Response(
        JSON.stringify({
          analysis: refinementResults.analysis,
          improvedTargets: refinementResults.improvedTargets,
          searchPriority: refinementResults.searchPriority,
          extractionFocus: refinementResults.extractionFocus,
          industrySpecificSites: refinementResults.industrySpecificSites || [],
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
