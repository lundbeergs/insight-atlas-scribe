
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createPlannerResponse } from "@/services/planner";
import ResearchPlan from "@/components/ResearchPlan";
import { Loader2, Search, RefreshCw, AlertCircle } from "lucide-react";
import ApiKeyManager from "@/components/ApiKeyManager";
import { WebScraperService, ScrapingResult } from "@/services/webScraperService";
import { FirecrawlService } from "@/utils/FirecrawlService";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

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
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Research Question</CardTitle>
          <CardDescription>
            Enter a free-form research question about competitors, market trends, or product information.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <Textarea
              placeholder="e.g., What is Competitor X's recent event presence? or Which of their products overlap with ours?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-32"
            />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                "Generate Research Plan"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {plannerResponse && (
        <div className="space-y-6">
          <ResearchPlan plan={plannerResponse} />
          
          <div className="flex justify-center">
            {currentIteration === 0 ? (
              <Button 
                onClick={executeResearch}
                disabled={isResearching}
                size="lg"
                className="mt-4"
              >
                {isResearching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Executing Research...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-5 w-5" />
                    Execute Research Plan
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={continueResearch}
                disabled={isResearching}
                size="lg"
                className="mt-4"
                variant="outline"
              >
                {isResearching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Continuing Research...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Continue Research (Iteration {currentIteration + 1}/3)
                  </>
                )}
              </Button>
            )}
          </div>
          
          {isResearching && (
            <div className="mt-4">
              <div className="flex justify-between mb-2 text-sm">
                <span>Research Progress</span>
                <span>{researchProgress}%</span>
              </div>
              <Progress value={researchProgress} className="h-2" />
              <div className="mt-2 text-center text-sm text-muted-foreground">
                {isReasoning ? 
                  "AI is analyzing results and improving search strategies..." : 
                  "Collecting data from target sources..."}
              </div>
            </div>
          )}
          
          {analysisText && (
            <Card className="mt-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-md flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                  AI Research Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{analysisText}</p>
              </CardContent>
            </Card>
          )}
          
          {iterations.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Research Process</CardTitle>
                <CardDescription>
                  Showing {iterations.length} research iterations with a total of {researchResults.length} results.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {iterations.map((iteration, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <h3 className="font-medium text-lg mb-2">Iteration {idx + 1}</h3>
                      
                      <div className="mb-4">
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Search Targets:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {iteration.targets.map((target, targetIdx) => (
                            <li key={targetIdx}>{target}</li>
                          ))}
                        </ul>
                      </div>
                      
                      {iteration.extractionFocus && (
                        <div className="mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded">
                          <h4 className="font-medium text-sm mb-1">Focus Areas:</h4>
                          <p className="text-sm">{iteration.extractionFocus}</p>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">
                          Results Found: {iteration.results.length}
                        </h4>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {researchResults.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Research Results</CardTitle>
                <CardDescription>
                  Found {researchResults.length} relevant sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {researchResults.map((result, index) => (
                    <div key={index} className="border p-4 rounded-lg">
                      <h3 className="font-medium text-lg">Source: {result.url}</h3>
                      <div className="mt-2 overflow-auto max-h-60 text-sm">
                        <pre className="whitespace-pre-wrap">{result.content}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ResearchPage;
