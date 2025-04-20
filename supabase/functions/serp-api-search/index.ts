
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { query } = await req.json();
    
    if (!serpApiKey) {
      console.error('SerpAPI key not found in environment variables');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SerpAPI key not configured on the server' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const url = new URL('https://serpapi.com/search');
    url.searchParams.append('q', query);
    url.searchParams.append('api_key', serpApiKey);
    url.searchParams.append('engine', 'google');

    console.log(`Searching SerpAPI for: ${query}`);
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      console.error('SerpAPI error:', data.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.error 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: data.organic_results || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in serp-api-search function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to SerpAPI'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
