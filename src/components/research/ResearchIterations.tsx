
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrapingResult } from "@/services/webScraperService";

interface ResearchIteration {
  targets: string[];
  results: ScrapingResult[];
  analysis?: string;
  extractionFocus?: string;
}

interface ResearchIterationsProps {
  iterations: ResearchIteration[];
}

const ResearchIterations: React.FC<ResearchIterationsProps> = ({ iterations }) => {
  if (!iterations.length) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Research Process</CardTitle>
        <CardDescription>
          Showing {iterations.length} research iterations with a total of {
            iterations.reduce((acc, curr) => acc + curr.results.length, 0)
          } results.
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
  );
};

export default ResearchIterations;
