"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TitleSuggestionsModal } from "./TitleSuggestionsModal";
import { useGenerateArticleTitles } from "@/hooks/useGenerateArticleTitles";
import { toast } from "sonner";

interface CommandBarProps {
  onSelectTitle: (title: string) => void;
}

export const CommandBar = ({ onSelectTitle }: CommandBarProps) => {
  const [inputValue, setInputValue] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const generateTitlesMutation = useGenerateArticleTitles();
  const isLoading = generateTitlesMutation.isPending;

  const fetchTitles = async (value: string) => {
    const result = await generateTitlesMutation.mutateAsync({
      userInput: value,
      language: "en",
    });
    return result.titles ?? [];
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = inputValue.trim();
    if (!value) return;

    try {
      const newTitles = await fetchTitles(value);
      if (newTitles.length > 0) {
        setUserInput(value);
        setTitles(newTitles);
        setIsModalOpen(true);
        setInputValue("");
      } else {
        toast.error("Unable to generate titles.");
      }
    } catch (error) {
      toast.error("Error generating titles.");
    }
  };

  const handleRefresh = async () => {
    if (!userInput) return;
    try {
      const newTitles = await fetchTitles(userInput);
      if (newTitles.length > 0) {
        setTitles(newTitles);
      } else {
        toast.error("Unable to regenerate titles.");
      }
    } catch (error) {
      toast.error("Error during regeneration.");
    }
  };

  const handleSelectTitle = (title: string) => {
    onSelectTitle(title);
    setIsModalOpen(false);
    setUserInput("");
    setTitles([]);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50 shadow-xs transition-all focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/45">
          <div className="relative flex-1">
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Keywords, title, description or article ideas..."
              className="h-12 rounded-xl border-0 bg-transparent pl-12 pr-12 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading}
            />
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 stroke-2 text-primary" />
            {isLoading && (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
          </div>
        </div>
      </form>

      {isModalOpen && (
        <TitleSuggestionsModal
          userInput={userInput}
          titles={titles}
          onSelectTitle={handleSelectTitle}
          onRefresh={handleRefresh}
          onClose={() => {
            setIsModalOpen(false);
            setUserInput("");
            setTitles([]);
          }}
          isRefreshing={generateTitlesMutation.isPending}
        />
      )}
    </>
  );
};
