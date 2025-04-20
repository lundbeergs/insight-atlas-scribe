
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlannerResponse {
  intent: string;
  searchFocus: string[];
  informationGoals: string[];
  originalQuestion: string;
}

interface ResearchPlanProps {
  plan: PlannerResponse;
}

const ResearchPlan: React.FC<ResearchPlanProps> = ({ plan }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

            <div>
              <span className="font-medium">Original Question:</span>
              <div className="mt-1">{plan.originalQuestion}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResearchPlan;
