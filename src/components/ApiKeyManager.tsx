
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FirecrawlService } from "@/utils/FirecrawlService";
import { SerpApiService } from "@/utils/SerpApiService";
import { Loader2, Key } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ApiKeyManager: React.FC = () => {
  const [firecrawlApiKey, setFirecrawlApiKey] = useState<string>("");
  const [serpApiKey, setSerpApiKey] = useState<string>("");
  const [isTestingFirecrawl, setIsTestingFirecrawl] = useState<boolean>(false);
  const [hasFirecrawlApiKey, setHasFirecrawlApiKey] = useState<boolean>(false);
  const [hasSerpApiKey, setHasSerpApiKey] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedFirecrawlKey = FirecrawlService.getApiKey();
    const savedSerpApiKey = SerpApiService.getApiKey();
    setHasFirecrawlApiKey(!!savedFirecrawlKey);
    setHasSerpApiKey(!!savedSerpApiKey);
  }, []);

  const handleSaveFirecrawlApiKey = async () => {
    if (!firecrawlApiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid FireCrawl API key.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingFirecrawl(true);
    try {
      const isValid = await FirecrawlService.testApiKey(firecrawlApiKey);
      
      if (isValid) {
        FirecrawlService.saveApiKey(firecrawlApiKey);
        setHasFirecrawlApiKey(true);
        setFirecrawlApiKey("");
        toast({
          title: "Success",
          description: "FireCrawl API key saved successfully.",
        });
      } else {
        toast({
          title: "Invalid API Key",
          description: "The provided FireCrawl API key is not valid. Please check and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate FireCrawl API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTestingFirecrawl(false);
    }
  };

  const handleRemoveFirecrawlApiKey = () => {
    localStorage.removeItem('firecrawl_api_key');
    setHasFirecrawlApiKey(false);
    toast({
      title: "API Key Removed",
      description: "Your FireCrawl API key has been removed.",
    });
  };

  const handleSaveSerpApiKey = () => {
    if (!serpApiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid SerpAPI key.",
        variant: "destructive",
      });
      return;
    }

    try {
      SerpApiService.saveApiKey(serpApiKey);
      setHasSerpApiKey(true);
      setSerpApiKey("");
      toast({
        title: "Success",
        description: "SerpAPI key saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save SerpAPI key. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveSerpApiKey = () => {
    localStorage.removeItem('serpapi_api_key');
    setHasSerpApiKey(false);
    toast({
      title: "API Key Removed",
      description: "Your SerpAPI key has been removed.",
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="firecrawl" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="firecrawl">FireCrawl API</TabsTrigger>
            <TabsTrigger value="serpapi">SerpAPI</TabsTrigger>
          </TabsList>
          
          <TabsContent value="firecrawl">
            {hasFirecrawlApiKey ? (
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
                    value={firecrawlApiKey}
                    onChange={(e) => setFirecrawlApiKey(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {hasFirecrawlApiKey ? (
                <Button variant="destructive" onClick={handleRemoveFirecrawlApiKey}>
                  Remove FireCrawl API Key
                </Button>
              ) : (
                <Button onClick={handleSaveFirecrawlApiKey} disabled={isTestingFirecrawl}>
                  {isTestingFirecrawl ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Save FireCrawl API Key
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="serpapi">
            {hasSerpApiKey ? (
              <div className="text-center">
                <p className="mb-4 text-green-600">✓ SerpAPI key is configured</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To enable search result fetching, please enter your SerpAPI key below.
                  <a
                    href="https://serpapi.com/dashboard"
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
                    placeholder="Enter your SerpAPI key"
                    value={serpApiKey}
                    onChange={(e) => setSerpApiKey(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {hasSerpApiKey ? (
                <Button variant="destructive" onClick={handleRemoveSerpApiKey}>
                  Remove SerpAPI Key
                </Button>
              ) : (
                <Button onClick={handleSaveSerpApiKey}>
                  <Key className="mr-2 h-4 w-4" />
                  Save SerpAPI Key
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ApiKeyManager;
