import { useState } from 'react';
import { Save, Trash2, GitCompare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Scenario, RuleOverrides } from '@/types/simulation';

interface ScenarioManagerProps {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  compareScenarioIds: string[];
  currentOverrides: RuleOverrides;
  monthCount: number;
  onSave: (scenario: Scenario) => void;
  onLoad: (scenarioId: string) => void;
  onDelete: (scenarioId: string) => void;
  onToggleCompare: (scenarioId: string) => void;
  onClearComparison: () => void;
}

export default function ScenarioManager({
  scenarios,
  activeScenarioId,
  compareScenarioIds,
  currentOverrides,
  monthCount,
  onSave,
  onLoad,
  onDelete,
  onToggleCompare,
  onClearComparison,
}: ScenarioManagerProps) {
  const [saveName, setSaveName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);

  function handleSave() {
    if (!saveName.trim()) return;
    onSave({
      id: crypto.randomUUID(),
      name: saveName.trim(),
      overrides: { ...currentOverrides },
      monthCount,
    });
    setSaveName('');
    setSaveOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Save scenario dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            <Save className="w-3 h-3" />
            Save Scenario
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Save Current Scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="e.g. Pay extra on Visa"
              className="h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <Button onClick={handleSave} disabled={!saveName.trim()} className="w-full h-8 text-xs">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load scenario */}
      {scenarios.length > 0 && (
        <Select
          value={activeScenarioId ?? 'none'}
          onValueChange={v => { if (v !== 'none') onLoad(v); }}
        >
          <SelectTrigger className="h-7 text-xs w-40 bg-secondary border-border">
            <SelectValue placeholder="Load scenario..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Current (unsaved)</SelectItem>
            {scenarios.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Compare toggle */}
      {scenarios.length >= 1 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <GitCompare className="w-3 h-3" />
              Compare
              {compareScenarioIds.length > 0 && (
                <Badge variant="secondary" className="text-[9px] ml-0.5">{compareScenarioIds.length}</Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-sm">Compare Scenarios</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 pt-2">
              <p className="text-[11px] text-muted-foreground">Select scenarios to overlay on the chart (max 3)</p>
              {scenarios.map(s => {
                const isComparing = compareScenarioIds.includes(s.id);
                const isActive = s.id === activeScenarioId;
                return (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleCompare(s.id)}
                        disabled={isActive || (!isComparing && compareScenarioIds.length >= 3)}
                        className={`w-4 h-4 rounded border text-[10px] flex items-center justify-center transition-colors ${
                          isComparing ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary'
                        } ${isActive ? 'opacity-30' : ''}`}
                      >
                        {isComparing && '✓'}
                      </button>
                      <span className="text-xs">{s.name}</span>
                      {isActive && <Badge variant="secondary" className="text-[8px]">Active</Badge>}
                    </div>
                    <button onClick={() => onDelete(s.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {compareScenarioIds.length > 0 && (
                <Button variant="ghost" size="sm" onClick={onClearComparison} className="text-xs gap-1 h-7 w-full">
                  <X className="w-3 h-3" /> Clear Comparison
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
