import React, { useState } from "react";
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
import { Loader2, Search, RefreshCw } from "lucide-react";

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
  const { toast } = useToast();

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
    
    // Start with the initial search targets from the planner
    if (iterations.length === 0) {
      setIterations([{
        targets: plannerResponse.searchFocus,
        results: []
      }]);
      setCurrentIteration(1);
    } else {
      setCurrentIteration(prev => prev + 1);
    }
    
    try {
      const searchTargets = iterations.length === 0 
        ? plannerResponse.searchFocus 
        : iterations[iterations.length - 1].targets;
      
      setResearchProgress(30);
      console.log("Starting research with search targets:", searchTargets);
      
      // First, do the initial scraping
      const results = await WebScraperService.scrapeSearchTargets(searchTargets);
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
      
      // Call our edge function to refine the research
      const refinementResponse = await supabase.functions.invoke('refine-research', {
        body: { 
          searchTargets, 
          currentResults,
          researchGoals: plannerResponse.informationGoals,
          iteration: currentIteration
        }
      });
      
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
          targets: refinementData.improvedTargets,
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
      setIsResearching(false);
      setIsReasoning(false);
    }
  };

  const continueResearch = () => {
    if (currentIteration < 3) {
      executeResearch();
    } else {
      toast({
        title: "Research Limit Reached",
        description: "Maximum iterations reached. Please start a new research question.",
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
          
          <div className="flex justify-center">
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
                      Continue Research (Iteration {currentIteration + 1}/3)
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
          
          <ResearchProgress 
            isResearching={isResearching}
            isReasoning={isReasoning}
            progress={researchProgress}
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
