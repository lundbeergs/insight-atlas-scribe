
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createPlannerResponse } from "@/services/planner";
import ResearchPlan from "@/components/ResearchPlan";
import ResearchResults from "@/components/ResearchResults";
import { Loader2, AlertCircle } from "lucide-react";
import { WebScraperService, ScrapingResult } from "@/services/webScraperService";
import { ResearchIteration, ResearchReasonerService, ResearchSummary } from "@/services/researchReasonerService";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface PlannerResponse {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

const MAX_ITERATIONS = 3;

const ResearchPage = () => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [plannerResponse, setPlannerResponse] = useState<PlannerResponse | null>(null);
  const { toast } = useToast();

  // Research state
  const [isExecutingResearch, setIsExecutingResearch] = useState(false);
  const [researchIterations, setResearchIterations] = useState<ResearchIteration[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [researchSummary, setResearchSummary] = useState<ResearchSummary | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

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
    setResearchError(null);
    try {
      const response = await createPlannerResponse(question);
      setPlannerResponse(response);
      // Reset any previous research
      setResearchIterations([]);
      setCurrentIteration(0);
      setResearchSummary(null);
      
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
    if (!plannerResponse) return;
    
    setIsExecutingResearch(true);
    setResearchSummary(null);
    setResearchError(null);

    try {
      await conductIterativeResearch(plannerResponse.searchFocus);
    } catch (error) {
      console.error("Error executing research:", error);
      setResearchError(error instanceof Error ? error.message : String(error));
      toast({
        title: "Research Error",
        description: "An error occurred during research. Please check API keys and try again.",
        variant: "destructive",
      });
    } finally {
      setIsExecutingResearch(false);
    }
  };

  const conductIterativeResearch = async (initialQueries: string[]) => {
    let currentQueries = initialQueries;
    let iterations: ResearchIteration[] = [];
    let iterationCount = 0;
    let isDone = false;

    while (!isDone && iterationCount < MAX_ITERATIONS) {
      setCurrentIteration(iterationCount);
      
      // 1. Search for information using current queries
      toast({
        title: "Researching",
        description: `Iteration ${iterationCount + 1}: Searching for information...`,
      });
      
      const results = await WebScraperService.conductResearch(currentQueries);
      
      if (results.length === 0) {
        toast({
          title: "No Results",
          description: "No results found for the current queries. Please check your API keys.",
          variant: "destructive",
        });
        setResearchError("No search results found. Please verify that your SerpAPI and Firecrawl API keys are valid.");
        break;
      }

      // 2. Analyze results and determine next steps
      toast({
        title: "Analyzing",
        description: `Iteration ${iterationCount + 1}: Analyzing search results...`,
      });
      
      const analysis = await ResearchReasonerService.analyzeResults(
        plannerResponse.originalQuestion, 
        results,
        iterations
      );

      // 3. Save this iteration
      const newIteration: ResearchIteration = {
        id: iterationCount + 1,
        searchQueries: currentQueries,
        results: results,
        analysis: analysis.analysis,
        confidence: analysis.confidence,
        nextSteps: analysis.nextQueries
      };
      
      iterations = [...iterations, newIteration];
      setResearchIterations(iterations);
      
      // 4. Determine whether to continue
      isDone = analysis.isDone || iterationCount >= MAX_ITERATIONS - 1;
      
      if (!isDone) {
        // Prepare for next iteration
        currentQueries = analysis.nextQueries;
        iterationCount++;
      } else {
        // Generate final summary
        toast({
          title: "Completing Research",
          description: "Generating final research summary...",
        });
        
        const summary = await ResearchReasonerService.generateSummary(
          plannerResponse.originalQuestion,
          iterations
        );
        
        setResearchSummary(summary);
        
        toast({
          title: "Research Complete",
          description: "Your research has been completed successfully.",
        });
      }
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-center">AI Research Assistant</h1>
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

      {researchError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {researchError}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          {plannerResponse && (
            <ResearchPlan 
              plan={plannerResponse} 
              onExecute={executeResearch}
              isExecuting={isExecutingResearch}
            />
          )}
        </div>
        
        <div className="lg:col-span-3">
          {(researchIterations.length > 0 || isExecutingResearch) && (
            <ResearchResults 
              iterations={researchIterations}
              summary={researchSummary}
              currentIteration={currentIteration}
              loading={isExecutingResearch}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ResearchPage;
