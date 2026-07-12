'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Search, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EMPTY_PROFILE,
  type CitizenProfile,
  type Gender,
  type Locality,
  type SocialCategory,
} from '@/lib/scheme-types';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan',
  'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

type SchemeFormProps = {
  initialProfile?: CitizenProfile;
  isLoading?: boolean;
  onSubmit: (profile: CitizenProfile) => void;
};

// Reusable labelled field wrapper.
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

// Reusable controlled toggle row.
function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="space-y-0.5 pr-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SchemeForm({ initialProfile, isLoading, onSubmit }: SchemeFormProps) {
  const [profile, setProfile] = useState<CitizenProfile>(initialProfile ?? EMPTY_PROFILE);

  const set = <K extends keyof CitizenProfile>(key: K, value: CitizenProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(profile);
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <h2 className="font-headline text-lg font-semibold">Citizen Details</h2>
          <p className="text-sm text-muted-foreground">
            Enter your details to discover eligible government schemes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Age" htmlFor="age">
            <Input
              id="age"
              type="number"
              min={0}
              max={120}
              placeholder="e.g. 34"
              value={profile.age}
              onChange={(e) => set('age', e.target.value === '' ? '' : Number(e.target.value))}
            />
          </Field>

          <Field label="Gender">
            <Select value={profile.gender} onValueChange={(v) => set('gender', v as Gender)}>
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="State">
            <Select value={profile.state} onValueChange={(v) => set('state', v)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Area Type">
            <Select value={profile.locality} onValueChange={(v) => set('locality', v as Locality)}>
              <SelectTrigger><SelectValue placeholder="Rural / Urban" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Rural">Rural</SelectItem>
                <SelectItem value="Urban">Urban</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Annual Income (₹)" htmlFor="income">
            <Input
              id="income"
              type="number"
              min={0}
              placeholder="e.g. 180000"
              value={profile.annualIncome}
              onChange={(e) => set('annualIncome', e.target.value === '' ? '' : Number(e.target.value))}
            />
          </Field>

          <Field label="Occupation" htmlFor="occupation">
            <Input
              id="occupation"
              placeholder="e.g. Agriculture"
              value={profile.occupation}
              onChange={(e) => set('occupation', e.target.value)}
            />
          </Field>

          <Field label="Category">
            <Select value={profile.category} onValueChange={(v) => set('category', v as SocialCategory)}>
              <SelectTrigger><SelectValue placeholder="SC / ST / OBC / General" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SC">SC</SelectItem>
                <SelectItem value="ST">ST</SelectItem>
                <SelectItem value="OBC">OBC</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <ToggleField
            label="Student"
            description="Currently enrolled in education"
            checked={profile.isStudent}
            onChange={(v) => set('isStudent', v)}
          />
          <ToggleField
            label="Farmer"
            description="Engaged in agriculture / land-holding"
            checked={profile.isFarmer}
            onChange={(v) => set('isFarmer', v)}
          />
          <ToggleField
            label="MSME / Entrepreneur"
            description="Runs a micro, small or medium enterprise"
            checked={profile.isMsme}
            onChange={(v) => set('isMsme', v)}
          />
          <ToggleField
            label="Person with Disability"
            description="Eligible for disability-specific schemes"
            checked={profile.hasDisability}
            onChange={(v) => set('hasDisability', v)}
          />
          <Field label="Other status" htmlFor="specialStatus">
            <Input
              id="specialStatus"
              placeholder="e.g. widow"
              value={profile.specialStatus}
              onChange={(e) => set('specialStatus', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t p-4">
        <Button type="submit" className="flex-1 gap-2" disabled={isLoading}>
          <Search className={cn('h-4 w-4', isLoading && 'animate-pulse')} />
          {isLoading ? 'Checking Eligibility…' : 'Check Eligibility'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Reset form"
          onClick={() => setProfile(EMPTY_PROFILE)}
          disabled={isLoading}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
