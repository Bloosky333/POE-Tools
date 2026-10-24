import { getLeague, getReferenceLeague, leagueDay } from '@poe-tools/shared';
import { useSettings } from '../../lib/useSettings.ts';

export default function CurrencySpeculationPage() {
  const { settings } = useSettings();
  const league = getLeague(settings.leagueId);
  const reference = league && getReferenceLeague(league);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Currency Speculation</h1>
        {league && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {league.name}: day {leagueDay(league.startsAt)}
            {reference && <> · compared with {reference.name}</>}
          </p>
        )}
      </header>
      <p className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        Price data isn't available yet. Suggestions will appear here once the data job is running.
      </p>
    </section>
  );
}
