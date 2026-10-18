import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppHeading } from '@/components/design';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { monthLabel } from '@/lib/wrapUpArchive';
import { wrapUpMonthInYear } from '@/lib/wrapUpPresentation';
import WrapUpSlide from './WrapUpSlide';

export default function WrapUpMonthNavigation({ monthKey, months }: { monthKey: string; months: string[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(monthKey);
  const keys = [...months].sort();
  const index = keys.indexOf(monthKey);
  const years = [...new Set(keys.map(key => key.slice(0, 4)))].reverse();
  function go(key: string) {
    setOpen(false);
    navigate(`/wrap-ups/${key}`);
  }
  return (
    <nav aria-label="Wrap-up month" className="mx-auto grid w-full max-w-md grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem] sm:gap-4">
      <Button className="size-10 sm:size-12" variant="ghost" size="icon-lg" aria-label="Previous month" disabled={index <= 0} onClick={() => go(keys[index - 1])}>
        <ChevronLeft className="size-6 sm:size-7" aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={value => { if (value) setChoice(monthKey); setOpen(value); }}>
        <AppHeading level={2} className="text-center text-xl min-[375px]:text-2xl sm:text-4xl">
          <DialogTrigger asChild>
            <button className="rounded-md transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Choose month, ${monthLabel(monthKey)}`}>
              <WrapUpSlide monthKey={monthKey} inline>{key => monthLabel(key)}</WrapUpSlide>
            </button>
          </DialogTrigger>
        </AppHeading>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Choose a wrap-up</DialogTitle><DialogDescription>Select a month and year from your reading history.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wrap-up-month">Month</Label>
              <Select value={choice.slice(5)} onValueChange={month => setChoice(`${choice.slice(0, 4)}-${month}`)}>
                <SelectTrigger id="wrap-up-month" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return <SelectItem key={month} value={month} disabled={!keys.includes(`${choice.slice(0, 4)}-${month}`)}>{monthLabel(`2000-${month}`).replace(' 2000', '')}</SelectItem>;
                })}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wrap-up-year">Year</Label>
              <Select value={choice.slice(0, 4)} onValueChange={year => setChoice(wrapUpMonthInYear(keys, year, choice.slice(5))!)}>
                <SelectTrigger id="wrap-up-year" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => go(choice)} disabled={!keys.includes(choice)}>Open wrap-up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button className="size-10 sm:size-12" variant="ghost" size="icon-lg" aria-label="Next month" disabled={index < 0 || index === keys.length - 1} onClick={() => go(keys[index + 1])}>
        <ChevronRight className="size-6 sm:size-7" aria-hidden="true" />
      </Button>
    </nav>
  );
}
