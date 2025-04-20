
import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlannerResponse {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

interface ResearchPlanProps {
  plan: PlannerResponse;
  onExecute: () => void;
  isExecuting: boolean;
}

const ResearchPlan: React.FC<ResearchPlanProps> = ({ plan, onExecute, isExecuting }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[400px] pr-4">
          <div>
            <h3 className="text-lg font-semibold">🧠 User Question:</h3>
            <blockquote className="border-l-4 border-primary pl-4 my-2 italic">
              {plan.originalQuestion}
            </blockquote>
          </div>

          <div>
            <h3 className="text-lg font-semibold">📝 Planner Output:</h3>
            <div className="pl-4 space-y-3 mt-2">
              <div>
                <span className="font-medium">Intent:</span> {plan.intent}
              </div>

              <div>
                <span className="font-medium">Search Focus:</span>
                <ul className="list-disc list-inside pl-4 mt-1">
                  {plan.searchFocus.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="font-medium">Information Goals:</span>
                <ul className="list-disc list-inside pl-4 mt-1">
                  {plan.informationGoals.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button 
          onClick={onExecute} 
          disabled={isExecuting}
          className="w-full md:w-auto"
        >
          {isExecuting ? "Researching..." : "Execute Research Plan"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ResearchPlan;
