'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PairingSettings } from '@/lib/wine-pairing';
import type { DimWeights } from '@/lib/kmeans';

const LS_KEY = 'wine_pairing_settings';

const DEFAULTS: Required<Omit<PairingSettings, 'weights'>> & { weights: DimWeights } = {
  k: 5,
  topN: 10,
  sampleM: 3,
  weights: [1, 1, 1, 1, 1, 1, 1, 1],
  samplingMode: 'closest',
};

const DIM_LABELS = ['Acidity', 'Tannin', 'Alcohol', 'Sweetness', 'Body', 'Minerality', 'Oak Influence', 'Fruit Intensity'];

function load(): typeof DEFAULTS {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return { ...DEFAULTS };
    const parsed = JSON.parse(s) as Partial<typeof DEFAULTS>;
    return { ...DEFAULTS, ...parsed, weights: parsed.weights ?? DEFAULTS.weights };
  } catch { return { ...DEFAULTS }; }
}

function save(s: typeof DEFAULTS) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function SliderField({
  label, value, min, max, step, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 cursor-pointer accent-primary"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function FoodPairingSettingsPage() {
  const [settings, setSettings] = useState<typeof DEFAULTS>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(load());
  }, []);

  const update = (patch: Partial<typeof DEFAULTS>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const updateWeight = (i: number, v: number) => {
    const w = [...settings.weights] as DimWeights;
    w[i] = v;
    update({ weights: w });
  };

  const handleSave = () => {
    save(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    save({ ...DEFAULTS });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/food-pairings" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-bold">Pairing Settings</h2>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-5">
        <p className="text-xs text-muted-foreground">
          These settings control the K-means clustering algorithm used to group wines by structural profile.
        </p>

        <SliderField
          label="Clusters (k)"
          value={settings.k}
          min={1} max={10} step={1}
          onChange={v => update({ k: v })}
          hint="Number of style groups to show. More clusters = more variety but smaller groups."
        />
        <SliderField
          label="Candidates per cluster (N)"
          value={settings.topN}
          min={1} max={30} step={1}
          onChange={v => update({ topN: v })}
          hint="Number of nearest-matching wines considered per cluster before sampling."
        />
        <SliderField
          label="Wines shown per group (m)"
          value={settings.sampleM}
          min={1} max={10} step={1}
          onChange={v => update({ sampleM: v })}
          hint="How many wine recommendations to show per style group."
        />

        <div className="space-y-2">
          <p className="text-sm font-medium">Sampling Mode</p>
          <div className="flex gap-3">
            {(['closest', 'diverse'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => update({ samplingMode: mode })}
                className={cn(
                  'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                  settings.samplingMode === mode
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-input'
                )}
              >
                {mode === 'closest' ? 'Closest' : 'Diverse'}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Closest: pick the nearest wines to each centroid. Diverse: maximize variety within each group.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <p className="text-sm font-semibold">Dimension Weights</p>
        <p className="text-xs text-muted-foreground">
          Higher weight = this structural dimension matters more when comparing wines.
        </p>
        {DIM_LABELS.map((label, i) => (
          <SliderField
            key={label}
            label={label}
            value={settings.weights[i]}
            min={0} max={5} step={0.5}
            onChange={v => updateWeight(i, v)}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className={cn(
            'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
            saved
              ? 'bg-green-600 text-white'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
    </div>
  );
}
