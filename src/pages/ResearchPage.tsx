
import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { createPlannerResponse } from "@/services/planner";
import ResearchPlan from "@/components/ResearchPlan";
import ApiKeyManager from "@/components/ApiKeyManager";
import { WebScraperService, ScrapingResult } from "@/services/webScraperService";
import { FirecrawlService } from "@/utils/FirecrawlService";
import { supabase } from "@/integrations/supabase/client";
import ResearchForm from "@/components/research/ResearchForm";
import ResearchProgress from "@/components/research/ResearchProgress";
import ResearchResults from "@/components/research/ResearchResults";
import ResearchIterations from "@/components/research/ResearchIterations";
import { Button } from "@/components/ui/button";
import { Loader2, Search, RefreshCw, XCircle } from "lucide-react";

interface PlannerResponse {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

interface ResearchIteration {
  targets: string[];
  results: ScrapingResult[];
  analysis?: string;
  extractionFocus?: string;
}

const MAX_RESEARCH_ITERATIONS = 2;
const RESEARCH_TIMEOUT_MS = 120000; // 2 minutes

const ResearchPage = () => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [plannerResponse, setPlannerResponse] = useState<PlannerResponse | null>(null);
  const [researchResults, setResearchResults] = useState<ScrapingResult[]>([]);
  const [iterations, setIterations] = useState<ResearchIteration[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [isReasoning, setIsReasoning] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Use a ref to track the research timeout
  const researchTimeoutRef = useRef<number | null>(null);
  
  // Function to cancel ongoing research
  const cancelResearch = () => {
    WebScraperService.cancelResearch();
    if (researchTimeoutRef.current) {
      window.clearTimeout(researchTimeoutRef.current);
      researchTimeoutRef.current = null;
    }
    setTimeoutMessage("Research canceled by user");
    setIsResearching(false);
    setIsReasoning(false);
    toast({
      title: "Research Canceled",
      description: "The research operation was canceled.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast({
        title: "Empty Question",
        description: "Please enter a research question.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await createPlannerResponse(question);
      setPlannerResponse(response);
      // Reset research state
      setResearchResults([]);
      setIterations([]);
      setCurrentIteration(0);
      setAnalysisText(null);
      setTimeoutMessage(null);
      
      toast({
        title: "Research Plan Generated",
        description: "Your research plan has been created successfully.",
      });
    } catch (error) {
      console.error("Error generating research plan:", error);
      toast({
        title: "Error",
        description: "Failed to generate research plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeResearch = async () => {
    if (!plannerResponse) {
      toast({
        title: "No Research Plan",
        description: "Please generate a research plan first.",
        variant: "destructive",
      });
      return;
    }

    const apiKey = FirecrawlService.getApiKey();
    if (!apiKey) {
      toast({
        title: "API Key Missing",
        description: "Please configure your FireCrawl API key first.",
        variant: "destructive",
      });
      return;
    }

    setIsResearching(true);
    setResearchProgress(10);
    setTimeoutMessage(null);
    
    // Set a global timeout for the entire research operation
    researchTimeoutRef.current = window.setTimeout(() => {
      setTimeoutMessage(`Research timed out after ${RESEARCH_TIMEOUT_MS/1000} seconds`);
      setIsResearching(false);
      setIsReasoning(false);
      toast({
        title: "Research Timed Out",
        description: `The research operation timed out after ${RESEARCH_TIMEOUT_MS/1000} seconds.`,
        variant: "destructive",
      });
    }, RESEARCH_TIMEOUT_MS);
    
    // Start with the initial search targets from the planner
    if (iterations.length === 0) {
      setIterations([{
        targets: plannerResponse.searchFocus.slice(0, 5), // Limit to 5 search targets
        results: []
      }]);
      setCurrentIteration(1);
    } else {
      setCurrentIteration(prev => prev + 1);
    }
    
    try {
      const searchTargets = iterations.length === 0 
        ? plannerResponse.searchFocus.slice(0, 5) // Limit to 5 search targets
        : iterations[iterations.length - 1].targets.slice(0, 5);
      
      setResearchProgress(30);
      console.log("Starting research with search targets:", searchTargets);
      
      // First, do the initial scraping
      const results = await WebScraperService.scrapeSearchTargets(searchTargets);
      
      // Check if the research was canceled during scraping
      if (timeoutMessage) {
        return;
      }
      
      setResearchProgress(60);
      
      if (results.length === 0) {
        toast({
          title: "No Initial Results Found",
          description: "No results found for the initial queries. AI will try to improve search.",
          variant: "destructive",
        });
      }
      
      // Now use the AI to refine and improve results
      setIsReasoning(true);
      
      const currentResults = [...researchResults, ...results];
      setResearchResults(currentResults);
      
      setResearchProgress(80);
      
      // Call our edge function to refine the research with a timeout
      const refinementPromise = supabase.functions.invoke('refine-research', {
        body: { 
          searchTargets, 
          currentResults,
          researchGoals: plannerResponse.informationGoals,
          iteration: currentIteration
        }
      });
      
      // Add a timeout for the refinement step
      const refinementTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Edge function timed out")), 45000);
      });
      
      const refinementResponse = await Promise.race([refinementPromise, refinementTimeout])
        .catch(error => {
          console.error("Edge function error:", error);
          return { data: { error: "Edge function timed out" } };
        });
      
      // Check if the research was canceled during refinement
      if (timeoutMessage) {
        return;
      }
      
      const refinementData = refinementResponse.data;
      
      if (refinementData.error) {
        console.error("Research refinement failed:", refinementData.error);
        throw new Error(refinementData.error);
      }
      
      // Update the iterations with the refined targets and results
      const updatedIterations = [...iterations];
      
      // Update the current iteration with the results we got
      if (updatedIterations.length > 0) {
        updatedIterations[updatedIterations.length - 1].results = results;
      }
      
      // Add the new iteration with improved targets
      if (refinementData.improvedTargets && refinementData.improvedTargets.length > 0) {
        updatedIterations.push({
          targets: refinementData.improvedTargets.slice(0, 5), // Limit to 5 targets
          results: refinementData.newResults || [],
          analysis: refinementData.analysis,
          extractionFocus: refinementData.extractionFocus
        });
      }
      
      setIterations(updatedIterations);
      
      // Add any new results
      if (refinementData.newResults && refinementData.newResults.length > 0) {
        setResearchResults(prev => [...prev, ...refinementData.newResults]);
      }
      
      // Set the analysis text
      setAnalysisText(refinementData.analysis || "No analysis available");
      
      setResearchProgress(100);
      
      if (currentResults.length === 0 && (!refinementData.newResults || refinementData.newResults.length === 0)) {
        toast({
          title: "No Results Found",
          description: "No results found after AI refinement. Try a different research question.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Research Complete",
          description: `Found ${currentResults.length + (refinementData.newResults?.length || 0)} relevant results.`,
        });
      }
    } catch (error) {
      console.error("Error executing research:", error);
      toast({
        title: "Research Failed",
        description: "An error occurred while researching. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (researchTimeoutRef.current) {
        window.clearTimeout(researchTimeoutRef.current);
        researchTimeoutRef.current = null;
      }
      setIsResearching(false);
      setIsReasoning(false);
    }
  };

  const continueResearch = () => {
    if (currentIteration < MAX_RESEARCH_ITERATIONS) {
      executeResearch();
    } else {
      toast({
        title: "Research Limit Reached",
        description: `Maximum iterations (${MAX_RESEARCH_ITERATIONS}) reached. Please start a new research question.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">AI Research Assistant</h1>
      
      <div className="mb-8">
        <ApiKeyManager />
      </div>
      
      <ResearchForm
        question={question}
        loading={loading}
        onQuestionChange={setQuestion}
        onSubmit={handleSubmit}
      />

      {plannerResponse && (
        <div className="space-y-6">
          <ResearchPlan plan={plannerResponse} />
          
          <div className="flex justify-center gap-4">
            <Button 
              onClick={currentIteration === 0 ? executeResearch : continueResearch}
              disabled={isResearching}
              size="lg"
              className="mt-4"
              variant={currentIteration === 0 ? "default" : "outline"}
            >
              {isResearching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {currentIteration === 0 ? "Executing Research..." : "Continuing Research..."}
                </>
              ) : (
                <>
                  {currentIteration === 0 ? (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Execute Research Plan
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5" />
                      Continue Research (Iteration {currentIteration + 1}/{MAX_RESEARCH_ITERATIONS})
                    </>
                  )}
                </>
              )}
            </Button>
            
            {isResearching && (
              <Button
                onClick={cancelResearch}
                variant="destructive"
                size="lg"
                className="mt-4"
              >
                <XCircle className="mr-2 h-5 w-5" />
                Cancel Research
              </Button>
            )}
          </div>
          
          <ResearchProgress 
            isResearching={isResearching}
            isReasoning={isReasoning}
            progress={researchProgress}
            timeoutMessage={timeoutMessage}
          />
          
          <ResearchResults 
            results={researchResults}
            analysisText={analysisText}
          />
          
          <ResearchIterations iterations={iterations} />
        </div>
      )}
    </div>
  );
};

export default ResearchPage;
