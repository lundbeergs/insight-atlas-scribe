
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { ScrapingResult } from "@/services/webScraperService";

interface ResearchResultsProps {
  results: ScrapingResult[];
  analysisText: string | null;
}

const ResearchResults: React.FC<ResearchResultsProps> = ({ results, analysisText }) => {
  if (!results.length && !analysisText) return null;

  return (
    <div className="space-y-6">
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

      {results.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Research Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
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
  );
};

export default ResearchResults;
