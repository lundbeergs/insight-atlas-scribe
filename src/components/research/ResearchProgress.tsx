
import React from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface ResearchProgressProps {
  isResearching: boolean;
  isReasoning: boolean;
  progress: number;
  timeoutMessage?: string | null;
}

const ResearchProgress: React.FC<ResearchProgressProps> = ({
  isResearching,
  isReasoning,
  progress,
  timeoutMessage
}) => {
  if (!isResearching && !timeoutMessage) return null;

  return (
    <div className="mt-4">
      {timeoutMessage ? (
        <Card className="bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-800">
          <CardContent className="py-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <span className="text-sm">{timeoutMessage}</span>
          </CardContent>
        </Card>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};

export default ResearchProgress;
