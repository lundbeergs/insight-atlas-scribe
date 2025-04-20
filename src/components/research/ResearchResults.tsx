
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ExternalLink } from "lucide-react";
import { ScrapingResult } from "@/services/webScraperService";

interface ResearchResultsProps {
  results: ScrapingResult[];
  analysisText: string | null;
}

const ResearchResults: React.FC<ResearchResultsProps> = ({ results, analysisText }) => {
  if (!results.length && !analysisText) return null;

  // Sort results by relevance score if available
  const sortedResults = [...results].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

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

      {sortedResults.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Research Results ({sortedResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedResults.map((result, index) => (
                <div 
                  key={index} 
                  className={`border p-4 rounded-lg ${
                    result.relevanceScore && result.relevanceScore > 0.7 
                      ? 'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800' 
                      : result.relevanceScore && result.relevanceScore < 0.3
                        ? 'border-gray-200 bg-gray-50 dark:bg-gray-900/30 dark:border-gray-800'
                        : 'border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-lg">
                      {result.metadata?.title || `Source ${index + 1}`}
                    </h3>
                    {result.relevanceScore !== undefined && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        result.relevanceScore > 0.7 
                          ? 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : result.relevanceScore < 0.3
                            ? 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            : 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        Relevance: {Math.round(result.relevanceScore * 100)}%
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1 mb-2">
                    <a 
                      href={result.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center hover:underline"
                    >
                      {result.url}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                  
                  {result.metadata?.snippet && (
                    <div className="mb-3 text-sm italic border-l-4 border-gray-300 pl-3 py-1">
                      {result.metadata.snippet}
                    </div>
                  )}
                  
                  <div className="mt-2 overflow-auto max-h-60 text-sm">
                    <pre className="whitespace-pre-wrap">{result.content}</pre>
                  </div>
                  
                  {result.extractedData && Object.keys(result.extractedData).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium mb-2">Extracted Data:</h4>
                      <div className="grid gap-2">
                        {Object.entries(result.extractedData).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                            <span>{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
