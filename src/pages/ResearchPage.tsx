
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { createPlannerResponse } from "@/services/planner";
import ResearchPlan from "@/components/ResearchPlan";
import ApiKeyManager from "@/components/ApiKeyManager";
import { 
  WebScraperService, 
  ScrapingResult, 
  ResearchPlan as ResearchPlanType
} from "@/services/webScraperService";
import { FirecrawlService } from "@/utils/FirecrawlService";
import { ContentAnalysis } from "@/utils/ReasoningService";
import ResearchForm from "@/components/research/ResearchForm";
import ResearchProgress from "@/components/research/ResearchProgress";
import ResearchResults from "@/components/research/ResearchResults";
import ResearchIterations from "@/components/research/ResearchIterations";
import { Button } from "@/components/ui/button";
import { Loader2, Search, RefreshCw } from "lucide-react";

const ResearchPage = () => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [plannerResponse, setPlannerResponse] = useState<ResearchPlanType | null>(null);
  const [researchResults, setResearchResults] = useState<ScrapingResult[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [isReasoning, setIsReasoning] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
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
      
      // Set the research plan in the WebScraperService
      WebScraperService.setResearchPlan(response);
      
      // Reset research state
      setResearchResults([]);
      setCurrentIteration(0);
      setAnalysisText(null);
      setAnalysis(null);
      
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
    
    try {
      // Determine which search targets to use
      const searchTargets = currentIteration === 0 
        ? plannerResponse.searchFocus 
        : analysis?.improvedTargets || [];
      
      if (searchTargets.length === 0) {
        throw new Error("No search targets available");
      }
      
      setCurrentIteration(prev => prev + 1);
      setResearchProgress(30);
      
      // Execute the scraping
      console.log("Starting research with search targets:", searchTargets);
      const results = await WebScraperService.scrapeSearchTargets(
        searchTargets,
        (completed, total) => {
          const progressPercent = 30 + (completed / total) * 30;
          setResearchProgress(Math.min(60, progressPercent));
        }
      );
      
      if (results.length === 0) {
        toast({
          title: "No Results Found",
          description: "No results found for the search queries. Try different search terms.",
          variant: "destructive",
        });
        setIsResearching(false);
        return;
      }
      
      // Add new results to the existing ones
      const allResults = [...researchResults, ...results];
      setResearchResults(allResults);
      
      // Now use the AI to analyze and refine the results
      setIsReasoning(true);
      setResearchProgress(70);
      
      // Analyze the results
      const contentAnalysis = await WebScraperService.analyzeAndRefine(
        allResults,
        plannerResponse.originalQuestion
      );
      
      setAnalysis(contentAnalysis);
      setAnalysisText(contentAnalysis.analysis);
      setResearchProgress(100);
      
      toast({
        title: "Research Complete",
        description: `Found ${results.length} new results. ${contentAnalysis.improvedTargets.length > 0 ? 'Continue researching for more insights.' : ''}`,
      });
    } catch (error) {
      console.error("Error executing research:", error);
      toast({
        title: "Research Failed",
        description: error instanceof Error ? error.message : "An error occurred while researching.",
        variant: "destructive",
      });
    } finally {
      setIsResearching(false);
      setIsReasoning(false);
    }
  };

  const continueResearch = () => {
    if (currentIteration < 3) {
      if (!analysis || analysis.improvedTargets.length === 0) {
        toast({
          title: "No Further Directions",
          description: "The AI couldn't identify any new search directions. Try a new research question.",
          variant: "destructive",
        });
        return;
      }
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
          
          <ResearchIterations iterations={WebScraperService.getIterations()} />
        </div>
      )}
    </div>
  );
};

export default ResearchPage;
