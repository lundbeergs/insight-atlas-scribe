
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createPlannerResponse } from "@/services/planner";
import ResearchPlan from "@/components/ResearchPlan";
import { Loader2 } from "lucide-react";

interface PlannerResponse {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

const ResearchPage = () => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [plannerResponse, setPlannerResponse] = useState<PlannerResponse | null>(null);
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

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">AI Research Assistant</h1>
      
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

      {plannerResponse && <ResearchPlan plan={plannerResponse} />}
    </div>
  );
};

export default ResearchPage;
