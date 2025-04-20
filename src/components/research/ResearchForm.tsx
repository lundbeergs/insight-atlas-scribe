
import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ResearchFormProps {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ResearchForm: React.FC<ResearchFormProps> = ({
  question,
  loading,
  onQuestionChange,
  onSubmit,
}) => {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Research Question</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent>
          <Textarea
            placeholder="e.g., What is Competitor X's recent event presence? or Which of their products overlap with ours?"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            className="min-h-32"
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Plan...
              </>
            ) : (
              "Generate Research Plan"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default ResearchForm;
