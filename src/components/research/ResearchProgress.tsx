
import React from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, Activity, Terminal } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface ResearchProgressProps {
  isResearching: boolean;
  isReasoning: boolean;
  progress: number;
  timeoutMessage?: string | null;
  logs: LogEntry[];
  currentStep: string;
  timeElapsed: number; // in seconds
}

const ResearchProgress: React.FC<ResearchProgressProps> = ({
  isResearching,
  isReasoning,
  progress,
  timeoutMessage,
  logs,
  currentStep,
  timeElapsed
}) => {
  if (!isResearching && !timeoutMessage && logs.length === 0) return null;

  const getLogEntryColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'info': return 'text-blue-600 dark:text-blue-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'success': return 'text-green-600 dark:text-green-400';
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {timeoutMessage ? (
        <Card className="bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-800">
          <CardContent className="py-3 flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <span className="text-sm">{timeoutMessage}</span>
          </CardContent>
        </Card>
      ) : isResearching ? (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold">Research Progress</span>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {progress}%
              </span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              <span>Time elapsed: {timeElapsed}s</span>
            </div>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="flex items-center justify-center py-2 px-3 bg-slate-50 dark:bg-slate-900 rounded-md border">
            <Activity className="h-4 w-4 mr-2 text-blue-500 animate-pulse" />
            <span className="text-sm font-medium">
              {isReasoning ? "AI is analyzing results and refining search strategies..." : currentStep}
            </span>
          </div>
        </>
      ) : null}

      {logs.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-md flex items-center">
              <Terminal className="h-4 w-4 mr-2" />
              Research Log
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <ScrollArea className="h-[200px] rounded border p-2 bg-slate-50 dark:bg-slate-900">
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex text-xs">
                    <span className="text-slate-500 dark:text-slate-400 mr-2 font-mono">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={getLogEntryColor(log.type)}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResearchProgress;
