
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const firecrawlAPIKey = Deno.env.get('FIRECRAWL_API_KEY');
const serpApiKey = Deno.env.get('SERPAPI_API_KEY');

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

    // --- ENHANCED ANALYSIS PROMPT for info goals+context+dates ---
    const now = new Date();
    const previousYear = new Date(now);
    previousYear.setFullYear(now.getFullYear() - 1);
    const dateStr = `${previousYear.toISOString().split("T")[0]} to ${now.toISOString().split("T")[0]}`;

    const aiPrompt = `You are an expert research assistant that helps refine web search strategies.

Your task:
1. Evaluate and analyze current research results (if any), research goals, search targets, and domain context.
2. Identify information gaps and insufficient targets (especially those with <3 results).
3. Generate 7-9 improved, highly specific search targets that:
   - Mix direct URLs (industry/event/company sites) and search queries (date/context aware)
   - For event research or competitive analysis, prioritize tech event directories, conference calendars, company/news/press sites, and add context like "PKI", "HID Global", and "2024" or "${dateStr}".
   - Provide at least 4 direct site URLs and at least 2 with date filter ("2024" or date context).
   - Prefer non-google.com sources.
   - For each improved target, indicate if it's: ["URL", "industry-site", "event-directory", "search-query"], and include context and date in queries.
4. Use information goals to focus improved targets on the specific gaps found so far.

Respond as JSON:
{
  "analysis": "paragraph analyzing the current state and gaps",
  "improvedTargets": ["target1", ...],
  "targetTypes": ["type-for-target-1", ...],
  "searchPriority": ["high", "high", ...],
  "extractionFocus": "summary of important info to extract for this iteration",
  "industrySpecificSites": ["site1", ...]
}
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
            content: aiPrompt
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

    // Up to 5 improved targets, always crawl direct URLs, prefer industry/event sites
    if (refinementResults.improvedTargets && refinementResults.improvedTargets.length > 0) {
      // Prefer URLs/domains, then search queries, process up to 5
      let priorityTargets = [];
      let count = 0;
      for (let i = 0; i < refinementResults.improvedTargets.length; i++) {
        const type = refinementResults.targetTypes?.[i] || "";
        if (["URL","industry-site","event-directory"].includes(type) && count < 5) {
          priorityTargets.push(refinementResults.improvedTargets[i]);
          count++;
        }
      }
      // Fill remainder with search queries, if needed
      if (priorityTargets.length < 5) {
        for (let i = 0; i < refinementResults.improvedTargets.length; i++) {
          if (!priorityTargets.includes(refinementResults.improvedTargets[i]) && priorityTargets.length < 5) {
            priorityTargets.push(refinementResults.improvedTargets[i]);
          }
        }
      }

      // Crawl the new targets
      const newResults = [];
      for (const target of priorityTargets) {
        try {
          let processedUrl = target;
          // Direct site/URL? make sure protocol
          if ((target.includes('.com') || target.includes('.org') || target.includes('.net') || 
               target.includes('.edu') || target.includes('.gov')) && !target.startsWith('http')) {
            processedUrl = `https://${target}`;
          }
          
          // Not a URL? Try SerpAPI. Compose with context/date if needed
          if (!processedUrl.startsWith("http")) {
            // SerpAPI strategy for non-urls
            if (serpApiKey) {
              const serpParams = new URLSearchParams({
                engine: 'google',
                q: `${processedUrl} ${context || ''} ${dateStr}`,
                api_key: serpApiKey,
                num: '5',
              });
              const serpUrl = `https://serpapi.com/search.json?${serpParams.toString()}`;
              const serpRes = await fetch(serpUrl);
              const serpData = await serpRes.json();
              let serpLinks = [];
              if (serpData.organic_results && Array.isArray(serpData.organic_results)) {
                for (const result of serpData.organic_results.slice(0, 5)) {
                  if (result.link && !result.link.startsWith("https://www.google.com")) {
                    serpLinks.push(result.link);
                  }
                }
                // If too few, fill remainder with whatever else is there
                if (serpLinks.length < 3) {
                  for (const result of serpData.organic_results.slice(0, 5)) {
                    if (result.link && !serpLinks.includes(result.link)) {
                      serpLinks.push(result.link);
                    }
                  }
                }
              }
              
              // Process each SerpAPI result URL
              for (const serpLink of serpLinks.slice(0, 3)) {
                const crawlResult = await fetch('https://api.firecrawl.dev/v1/crawl-url', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${firecrawlAPIKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    url: serpLink,
                    limit: 5,
                    scrapeOptions: {
                      formats: ['markdown', 'html'],
                      selector: 'main, article, .content, #content, .main, #main' // Target content areas
                    }
                  })
                });
                const crawlResultJson = await crawlResult.json();
                if (crawlResultJson.success) {
                  // Validate content is useful
                  if (crawlResultJson.content && crawlResultJson.content.length > 100) {
                    newResults.push({
                      url: serpLink,
                      content: crawlResultJson.content || '',
                      metadata: crawlResultJson.metadata || {},
                      searchQuery: target
                    });
                    console.log(`Successfully crawled ${serpLink}`);
                  } else {
                    console.log(`Content too short for ${serpLink}`);
                  }
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              continue;
            }
          }
          
          console.log(`Crawling target: ${processedUrl}`);
          
          // Skip google search URLs
          if (processedUrl.startsWith('https://www.google.com/search')) {
            console.log(`Skipping Google search URL: ${processedUrl}`);
            continue;
          }
          
          // Perform the crawl using FireCrawl directly
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
                formats: ['markdown', 'html'],
                selector: 'main, article, .content, #content, .main, #main' // Target content areas
              }
            })
          });
          const crawlResultJson = await crawlResult.json();
          if (crawlResultJson.success) {
            // Validate content length
            if (crawlResultJson.content && crawlResultJson.content.length > 100) {
              newResults.push({
                url: processedUrl,
                content: crawlResultJson.content || '',
                metadata: crawlResultJson.metadata || {},
                searchQuery: target
              });
              console.log(`Successfully crawled ${processedUrl}`);
            } else {
              console.log(`Content too short for ${processedUrl}`);
            }
          } else {
            console.error(`Failed to crawl ${processedUrl}:`, crawlResultJson.error);
          }
        } catch (error) {
          console.error(`Error crawling ${target}:`, error);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Also, process industry-specific sites if provided, up to 3
      if (refinementResults.industrySpecificSites && refinementResults.industrySpecificSites.length > 0) {
        const industryTargets = refinementResults.industrySpecificSites.slice(0, 3);
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
                  formats: ['markdown', 'html'],
                  selector: 'main, article, .content, #content, .main, #main' // Target content areas
                }
              })
            });
            const crawlResultJson = await crawlResult.json();
            if (crawlResultJson.success) {
              // Only add if we have substantial content
              if (crawlResultJson.content && crawlResultJson.content.length > 100) {
                newResults.push({
                  url: processedUrl,
                  content: crawlResultJson.content || '',
                  metadata: crawlResultJson.metadata || {},
                  searchQuery: 'Industry-specific site'
                });
                console.log(`Successfully crawled industry site ${processedUrl}`);
              } else {
                console.log(`Content too short for industry site ${processedUrl}`);
              }
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
          targetTypes: refinementResults.targetTypes,
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
