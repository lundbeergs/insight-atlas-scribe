
import React from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

interface ResearchProgressProps {
  isResearching: boolean;
  isReasoning: boolean;
  progress: number;
}

const ResearchProgress: React.FC<ResearchProgressProps> = ({
  isResearching,
  isReasoning,
  progress,
}) => {
  if (!isResearching) return null;

  return (
    <div className="mt-4">
      <div className="flex justify-between mb-2 text-sm">
        <span>Research Progress</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="mt-2 text-center text-sm text-muted-foreground">
        {isReasoning ? 
          "AI is analyzing results and improving search strategies..." : 
          "Collecting data from target sources..."}
      </div>
    </div>
  );
};

export default ResearchProgress;
