
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createPlannerResponse } from "@/services/planner";
import ResearchPlan from "@/components/ResearchPlan";
import { Loader2 } from "lucide-react";
import ApiKeyManager from "@/components/ApiKeyManager";
import { WebScraperService, ScrapingResult } from "@/services/webScraperService";
import { FirecrawlService } from "@/utils/FirecrawlService";

interface PlannerResponse {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

const ResearchPage = () => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [plannerResponse, setPlannerResponse] = useState<PlannerResponse | null>(null);
  const [researchResults, setResearchResults] = useState<ScrapingResult[]>([]);
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
    setResearchResults([]);

    try {
      const searchTargets = plannerResponse.searchFocus.map(focus => {
        // Convert search queries to potential URLs
        if (focus.includes('.com') || focus.includes('.org') || focus.includes('.net')) {
          return focus; // Already looks like a URL
        }
        return focus; // Keep as is for FireCrawl to handle
      });

      console.log("Starting research with search targets:", searchTargets);
      const results = await WebScraperService.scrapeSearchTargets(searchTargets);
      
      if (results.length === 0) {
        toast({
          title: "No Results Found",
          description: "No results found for the current queries.",
          variant: "destructive",
        });
      } else {
        setResearchResults(results);
        toast({
          title: "Research Complete",
          description: `Found ${results.length} relevant results.`,
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
                "Execute Research Plan"
              )}
            </Button>
          </div>
          
          {researchResults.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Research Results</CardTitle>
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
