
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FirecrawlService } from "@/utils/FirecrawlService";
import { Loader2 } from "lucide-react";

const ApiKeyManager: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedKey = FirecrawlService.getApiKey();
    setHasApiKey(!!savedKey);
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const isValid = await FirecrawlService.testApiKey(apiKey);
      
      if (isValid) {
        FirecrawlService.saveApiKey(apiKey);
        setHasApiKey(true);
        setApiKey("");
        toast({
          title: "Success",
          description: "FireCrawl API key saved successfully.",
        });
      } else {
        toast({
          title: "Invalid API Key",
          description: "The provided API key is not valid. Please check and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemoveApiKey = () => {
    localStorage.removeItem('firecrawl_api_key');
    setHasApiKey(false);
    toast({
      title: "API Key Removed",
      description: "Your FireCrawl API key has been removed.",
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>FireCrawl API Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        {hasApiKey ? (
          <div className="text-center">
            <p className="mb-4 text-green-600">✓ FireCrawl API key is configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To enable web scraping, please enter your FireCrawl API key below.
              <a
                href="https://firecrawl.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline ml-1"
              >
                Get a key
              </a>
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter your FireCrawl API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {hasApiKey ? (
          <Button variant="destructive" onClick={handleRemoveApiKey}>
            Remove API Key
          </Button>
        ) : (
          <Button onClick={handleSaveApiKey} disabled={isTesting}>
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              "Save API Key"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ApiKeyManager;
