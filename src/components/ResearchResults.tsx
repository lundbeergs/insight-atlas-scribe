
import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ResearchIteration, ResearchSummary } from "@/services/researchReasonerService";
import { Badge } from "@/components/ui/badge";
import { ScrapingResult } from "@/services/webScraperService";

interface ResearchResultsProps {
  iterations: ResearchIteration[];
  summary?: ResearchSummary;
  currentIteration: number;
  loading: boolean;
}

export const ResearchResults: React.FC<ResearchResultsProps> = ({ 
  iterations, 
  summary, 
  currentIteration,
  loading 
}) => {
  if (loading && iterations.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Researching...</CardTitle>
          <CardDescription>
            The AI agent is gathering and analyzing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (iterations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 mt-6">
      {summary && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle>Research Summary</CardTitle>
            <CardDescription>
              Confidence: {summary.confidence}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Answer:</h3>
              <div className="mt-2 whitespace-pre-wrap">{summary.finalAnswer}</div>
            </div>
            {summary.sources.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold">Key Sources:</h3>
                <ul className="list-disc list-inside pl-4 mt-1">
                  {summary.sources.map((source, index) => (
                    <li key={index}>
                      <a 
                        href={source} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {source}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {iterations.map((iteration, index) => (
        <Card key={index} className={index === currentIteration && loading ? "border-dashed border-2 border-primary" : ""}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Iteration {index + 1}</CardTitle>
              <Badge variant={getConfidenceBadgeVariant(iteration.confidence)}>
                Confidence: {iteration.confidence}%
              </Badge>
            </div>
            <CardDescription>
              Search Queries: {iteration.searchQueries.join(", ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Analysis:</h3>
              <div className="mt-2">{iteration.analysis}</div>
            </div>
            
            {iteration.nextSteps && iteration.nextSteps.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold">Next Steps:</h3>
                <ul className="list-disc list-inside pl-4 mt-1">
                  {iteration.nextSteps.map((step, stepIndex) => (
                    <li key={stepIndex}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {iteration.results && iteration.results.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mt-4">Sources:</h3>
                <div className="space-y-2 mt-2">
                  {iteration.results.map((result, resultIndex) => (
                    <SourceCard key={resultIndex} result={result} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          {index === currentIteration && loading && (
            <CardFooter>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Researching next steps...</span>
              </div>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
};

interface SourceCardProps {
  result: ScrapingResult;
}

const SourceCard: React.FC<SourceCardProps> = ({ result }) => {
  return (
    <Card className="bg-muted/30">
      <CardHeader className="p-3 pb-1">
        <div className="flex justify-between items-center">
          <div className="font-medium line-clamp-1">
            {result.title || result.url}
          </div>
          <Badge variant="outline">{result.source}</Badge>
        </div>
        <CardDescription className="text-xs truncate">
          <a 
            href={result.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {result.url}
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="text-sm line-clamp-3">
          {result.content ? (
            result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '')
          ) : (
            <span className="text-muted-foreground italic">No content available</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const getConfidenceBadgeVariant = (confidence: number) => {
  if (confidence >= 80) return "default";
  if (confidence >= 50) return "secondary";
  return "destructive";
};

export default ResearchResults;
