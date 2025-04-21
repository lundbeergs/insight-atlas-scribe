
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, BookOpen, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrapingResult } from "@/services/webScraperService";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface CleanerResponse {
  structuredInsights: Record<string, Array<{fact: string, source: string}>>;
  relevantFindings: string[];
  suggestedNextSteps?: string[];
  analysis: string;
}

interface ResearchResultsProps {
  results: ScrapingResult[];
  analysisText: string | null;
  structuredInsights: CleanerResponse | null;
}

const ResearchResults: React.FC<ResearchResultsProps> = ({ 
  results, 
  analysisText, 
  structuredInsights 
}) => {
  const [activeTab, setActiveTab] = useState("insights");

  if (!results.length && !analysisText && !structuredInsights) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <BookOpen className="h-5 w-5 mr-2" />
          Research Results
        </CardTitle>
        {results.length > 0 && (
          <CardDescription>
            Found {results.length} resources related to your question
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="insights" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="rawData">Raw Data</TabsTrigger>
          </TabsList>
          
          <TabsContent value="insights">
            {structuredInsights ? (
              <div className="space-y-6">
                {/* Key Findings */}
                {structuredInsights.relevantFindings && structuredInsights.relevantFindings.length > 0 && (
                  <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md flex items-center">
                        <CheckCircle2 className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                        Key Findings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-2">
                        {structuredInsights.relevantFindings.map((finding, index) => (
                          <li key={index} className="text-sm">{finding}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                
                {/* Structured Insights */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Detailed Insights</h3>
                  
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(structuredInsights.structuredInsights).map(([category, facts], idx) => (
                      <AccordionItem value={`item-${idx}`} key={idx}>
                        <AccordionTrigger className="text-left font-medium">
                          {category}
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-3">
                            {facts.map((item, factIdx) => (
                              <li key={factIdx} className="border-l-2 border-gray-200 pl-4 py-1">
                                <p className="text-sm">{item.fact}</p>
                                <a 
                                  href={item.source} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                                >
                                  Source
                                </a>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
                
                {/* Next Steps */}
                {structuredInsights.suggestedNextSteps && structuredInsights.suggestedNextSteps.length > 0 && (
                  <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md flex items-center">
                        <ArrowRight className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                        Suggested Next Steps
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-2">
                        {structuredInsights.suggestedNextSteps.map((step, index) => (
                          <li key={index} className="text-sm">{step}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {results.length > 0 ? (
                  <p>Processing data to extract insights...</p>
                ) : (
                  <p>No insights available yet. Execute research to get started.</p>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="analysis">
            {analysisText ? (
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-md flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                    AI Research Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{analysisText}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No analysis available yet.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="rawData">
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((result, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 mr-2" />
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:underline overflow-hidden overflow-ellipsis"
                          >
                            {result.url}
                          </a>
                        </div>
                        {result.searchQuery && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {result.searchQuery}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mt-2 overflow-auto max-h-60 text-sm">
                        <pre className="whitespace-pre-wrap font-sans">{result.content.substring(0, 500)}
                          {result.content.length > 500 && '...'}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No raw data available yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ResearchResults;
