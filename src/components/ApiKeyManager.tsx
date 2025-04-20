
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FirecrawlService } from "@/utils/FirecrawlService";
import { SerpApiService } from "@/services/serpApiService";

export const ApiKeyManager: React.FC = () => {
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [serpApiKey, setSerpApiKey] = useState("");
  const [hasFirecrawlKey, setHasFirecrawlKey] = useState(false);
  const [hasSerpApiKey, setHasSerpApiKey] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedFirecrawlKey = FirecrawlService.getApiKey();
    const storedSerpApiKey = SerpApiService.getApiKey();
    
    setHasFirecrawlKey(!!storedFirecrawlKey);
    setHasSerpApiKey(!!storedSerpApiKey);
  }, []);

  const handleSaveKeys = () => {
    if (firecrawlKey) {
      FirecrawlService.saveApiKey(firecrawlKey);
      setHasFirecrawlKey(true);
      setFirecrawlKey("");
    }

    if (serpApiKey) {
      SerpApiService.saveApiKey(serpApiKey);
      setHasSerpApiKey(true);
      setSerpApiKey("");
    }

    toast({
      title: "API Keys Saved",
      description: "Your API keys have been saved successfully.",
    });

    setOpenDialog(false);
  };

  return (
    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {hasFirecrawlKey && hasSerpApiKey 
            ? "API Keys ✓" 
            : "Set API Keys"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>API Keys Configuration</DialogTitle>
          <DialogDescription>
            Configure your API keys for web scraping and search services.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firecrawl-key" className="col-span-4">
              Firecrawl API Key {hasFirecrawlKey && <span className="text-green-500 ml-2">✓</span>}
            </Label>
            <Input
              id="firecrawl-key"
              placeholder={hasFirecrawlKey ? "********" : "Enter your Firecrawl API key"}
              value={firecrawlKey}
              onChange={(e) => setFirecrawlKey(e.target.value)}
              className="col-span-4"
              type="password"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="serpapi-key" className="col-span-4">
              SerpAPI Key {hasSerpApiKey && <span className="text-green-500 ml-2">✓</span>}
            </Label>
            <Input
              id="serpapi-key"
              placeholder={hasSerpApiKey ? "********" : "Enter your SerpAPI key"}
              value={serpApiKey}
              onChange={(e) => setSerpApiKey(e.target.value)}
              className="col-span-4"
              type="password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSaveKeys}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
