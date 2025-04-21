import React, { useState, useRef, useEffect } from "react";
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

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
}

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
  const [researchLogs, setResearchLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("Initializing research...");
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  
  const { toast } = useToast();
  
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  
  // Add a log entry
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setResearchLogs(prev => [...prev, {
      message,
      timestamp: new Date(),
      type
    }]);
  };
  
  // Update timer
  useEffect(() => {
    if (isResearching && !timerIntervalRef.current) {
      startTimeRef.current = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setTimeElapsed(elapsed);
        }
      }, 1000);
    } else if (!isResearching && timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    return () => {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
    };
  }, [isResearching]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const cancelResearch = () => {
    WebScraperService.cancelResearch();
    setTimeoutMessage("Research canceled by user");
    setIsResearching(false);
    setIsReasoning(false);
    addLog("Research canceled by user", 'warning');
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
    setResearchLogs([]);
    
    try {
      addLog(`Generating research plan for: "${question}"`, 'info');
      const response = await createPlannerResponse(question);
      setPlannerResponse(response);
      setResearchResults([]);
      setIterations([]);
      setCurrentIteration(0);
      setAnalysisText(null);
      setTimeoutMessage(null);
      setTimeElapsed(0);
      
      addLog(`Research plan created with ${response.searchFocus.length} search targets`, 'success');
      
      toast({
        title: "Research Plan Generated",
        description: "Your research plan has been created successfully.",
      });
    } catch (error) {
      console.error("Error generating research plan:", error);
      addLog(`Failed to generate research plan: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      
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
    setResearchProgress(5);
    setTimeoutMessage(null);
    setCurrentStep("Initializing research process...");
    addLog("Starting research execution", 'info');

    // Reset timer
    if (startTimeRef.current) {
      startTimeRef.current = Date.now();
      setTimeElapsed(0);
    }

    if (iterations.length === 0) {
      const initialTargets = plannerResponse.searchFocus.slice(0, 5);
      setIterations([{
        targets: initialTargets,
        results: []
      }]);
      setCurrentIteration(1);
      addLog(`Initialized iteration 1 with ${initialTargets.length} targets`, 'info');
    } else {
      setCurrentIteration(prev => {
        const newIteration = prev + 1;
        addLog(`Starting iteration ${newIteration}`, 'info');
        return newIteration;
      });
    }

    try {
      const searchTargets = iterations.length === 0 
        ? plannerResponse.searchFocus.slice(0, 5)
        : iterations[iterations.length - 1].targets.slice(0, 5);

      setResearchProgress(15);
      setCurrentStep(`Preparing to search ${searchTargets.length} targets...`);
      addLog(`Preparing search for targets: ${searchTargets.join(", ")}`, 'info');

      const allResults = [];
      for (let i = 0; i < searchTargets.length; i++) {
        const target = searchTargets[i];
        const targetProgress = 15 + Math.floor((i / searchTargets.length) * 45);
        setResearchProgress(targetProgress);
        setCurrentStep(`Searching target ${i+1}/${searchTargets.length}: "${target}"...`);
        addLog(`Scraping search target: "${target}"`, 'info');
        try {
          const targetResults = await WebScraperService.scrapeSearchTargets([target]);
          if (targetResults.length > 0) {
            addLog(`Found ${targetResults.length} results for "${target}"`, 'success');
            allResults.push(...targetResults);
          } else {
            addLog(`No results found for "${target}"`, 'warning');
          }
        } catch (error) {
          addLog(`Error scraping "${target}": ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      }

      setResearchProgress(60);

      if (allResults.length === 0) {
        addLog("No results found for any search targets", 'warning');
        toast({
          title: "No Initial Results Found",
          description: "No results found for the initial queries. AI will try to improve search.",
          variant: "destructive",
        });
      } else {
        addLog(`Found a total of ${allResults.length} results across all targets`, 'success');
      }

      setIsReasoning(true);
      setCurrentStep("AI analyzing results and refining search strategy...");
      addLog("Starting AI analysis of search results", 'info');

      const currentResults = [...researchResults, ...allResults];
      setResearchResults(currentResults);

      setResearchProgress(75);

      addLog("Requesting refinement from AI service", 'info');
      const refinementPromise = supabase.functions.invoke('refine-research', {
        body: { 
          searchTargets, 
          currentResults,
          researchGoals: plannerResponse.informationGoals,
          iteration: currentIteration
        }
      });

      const refinementTimeout = new Promise((_, reject) => {
        setTimeout(() => {
          addLog("AI refinement timed out after 45 seconds", 'error');
          reject(new Error("Edge function timed out"));
        }, 45000);
      });

      const refinementResponse = await Promise.race([refinementPromise, refinementTimeout])
        .catch(error => {
          console.error("Edge function error:", error);
          addLog(`AI refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
          return { data: { error: "Edge function timed out" } };
        });

      const refinementData = (refinementResponse as { data: any }).data;

      if (refinementData.error) {
        console.error("Research refinement failed:", refinementData.error);
        addLog(`AI refinement error: ${refinementData.error}`, 'error');
        throw new Error(refinementData.error);
      }

      addLog("AI refinement completed successfully", 'success');

      const updatedIterations = [...iterations];

      if (updatedIterations.length > 0) {
        updatedIterations[updatedIterations.length - 1].results = allResults;
        addLog(`Updated iteration ${updatedIterations.length} with ${allResults.length} results`, 'info');
      }

      if (refinementData.improvedTargets && refinementData.improvedTargets.length > 0) {
        const newTargets = refinementData.improvedTargets.slice(0, 5);
        updatedIterations.push({
          targets: newTargets,
          results: refinementData.newResults || [],
          analysis: refinementData.analysis,
          extractionFocus: refinementData.extractionFocus
        });
        addLog(`Created new iteration with ${newTargets.length} improved search targets`, 'success');
      }

      setIterations(updatedIterations);

      if (refinementData.newResults && refinementData.newResults.length > 0) {
        setResearchResults(prev => [...prev, ...refinementData.newResults]);
        addLog(`Added ${refinementData.newResults.length} additional results from AI refinement`, 'success');
      }

      setAnalysisText(refinementData.analysis || "No analysis available");
      addLog("Research analysis text updated", 'info');

      setResearchProgress(100);
      setCurrentStep("Research completed successfully");

      if (currentResults.length === 0 && (!refinementData.newResults || refinementData.newResults.length === 0)) {
        addLog("No results found after all iterations", 'warning');
        toast({
          title: "No Results Found",
          description: "No results found after AI refinement. Try a different research question.",
          variant: "destructive",
        });
      } else {
        const totalResults = currentResults.length + (refinementData.newResults?.length || 0);
        addLog(`Research completed with ${totalResults} total results`, 'success');
        toast({
          title: "Research Complete",
          description: `Found ${totalResults} relevant results.`,
        });
      }
    } catch (error) {
      console.error("Error executing research:", error);
      addLog(`Research execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
    if (currentIteration < MAX_RESEARCH_ITERATIONS) {
      executeResearch();
    } else {
      addLog(`Maximum iterations (${MAX_RESEARCH_ITERATIONS}) reached`, 'warning');
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
            logs={researchLogs}
            currentStep={currentStep}
            timeElapsed={timeElapsed}
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
