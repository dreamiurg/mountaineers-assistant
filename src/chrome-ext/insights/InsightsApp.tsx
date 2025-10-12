import { useMemo, useRef, useEffect } from 'react';
import { useInsightsDashboard } from './hooks/useInsightsDashboard';
import type { Options as HighchartsOptions } from 'highcharts';
import type { DistributionEntry, PartnerEntry, TimelineView } from './types';
import ChoicesMultiSelect from './components/ChoicesMultiSelect';
import {
  formatDate,
  formatDateRange,
  formatNumber,
  getActivityTypeColors,
  initials,
  titleCase,
} from './utils';

const LoadingCard = ({ message }: { message: string }) => (
  <div className="glass-card flex items-center gap-4 rounded-2xl px-5 py-6 text-slate-500">
    <svg
      className="h-6 w-6 animate-spin text-sky-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      ></path>
    </svg>
    <div>
      <p className="font-medium">Preparing dashboard</p>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="glass-card rounded-2xl px-5 py-16 text-center text-slate-600">
    <p className="text-xl font-medium text-slate-900">No activities available yet</p>
    <p className="mt-2 text-sm text-slate-500">{message}</p>
  </div>
);

const TimelineChart = ({ data }: { data: TimelineView }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highcharts = (window as typeof window & { Highcharts?: typeof import('highcharts') })
    .Highcharts;

  useEffect(() => {
    if (!containerRef.current || !highcharts) {
      return;
    }

    if (!data.categories.length) {
      const chart = highcharts.chart(containerRef.current, {
        title: {
          text: 'No dated activities yet',
          style: { color: '#64748b', fontFamily: 'Inter, sans-serif' },
        },
        credits: { enabled: false },
      } as unknown as HighchartsOptions);
      return () => {
        chart.destroy();
      };
    }

    const chart = highcharts.chart(containerRef.current, {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
      },
      title: { text: null },
      xAxis: {
        categories: data.categories,
        tickColor: '#cbd5f5',
        lineColor: 'transparent',
        labels: {
          style: { color: '#64748b', fontFamily: 'Inter, sans-serif' },
        },
      },
      yAxis: {
        title: { text: null },
        gridLineColor: 'rgba(148, 163, 184, 0.25)',
        labels: {
          style: { color: '#64748b', fontFamily: 'Inter, sans-serif' },
        },
        min: 0,
        allowDecimals: false,
      },
      tooltip: {
        shared: true,
        borderColor: 'rgba(14, 116, 144, 0.2)',
        backgroundColor: '#ffffff',
        style: { fontFamily: 'Inter, sans-serif' },
        formatter() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const points = (this as any).points as Array<{
            y: number;
            series: { name: string; color: string };
          }>;
          const total = points.reduce((sum, point) => sum + (point.y || 0), 0);
          const parts = points
            .filter((point) => point.y)
            .map(
              (point) =>
                `<span style="color:${point.series.color}">●</span> ${point.series.name}: <b>${point.y}</b>`
            );
          parts.push(`<span style="color:#0f172a">Total: <b>${total}</b></span>`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return `<span style="font-size:12px">${(this as any).x}</span><br/>${parts.join('<br/>')}`;
        },
      },
      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'top',
        itemStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif', fontSize: '12px' },
        itemHoverStyle: { color: '#0f172a' },
      },
      credits: { enabled: false },
      plotOptions: {
        column: {
          stacking: 'normal',
          borderWidth: 0,
          pointPadding: 0.1,
        },
      },
      colors: getActivityTypeColors(),
      series: data.series.map((series) => ({
        name: series.name,
        data: series.data,
      })),
    } as unknown as HighchartsOptions);

    return () => {
      chart.destroy();
    };
  }, [data, highcharts]);

  return <div ref={containerRef} className="absolute inset-0" />;
};

const DistributionChart = ({
  entries,
  label,
  emptyMessage,
  colors,
}: {
  entries: DistributionEntry[];
  label: string;
  emptyMessage: string;
  colors?: string[];
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highcharts = (window as typeof window & { Highcharts?: typeof import('highcharts') })
    .Highcharts;

  useEffect(() => {
    if (!containerRef.current || !highcharts) {
      return;
    }

    if (!entries.length) {
      const chart = highcharts.chart(containerRef.current, {
        title: {
          text: emptyMessage,
          style: { color: '#64748b', fontFamily: 'Inter, sans-serif' },
        },
        credits: { enabled: false },
      } as unknown as HighchartsOptions);
      return () => chart.destroy();
    }

    const chart = highcharts.chart(containerRef.current, {
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
      },
      title: { text: null },
      credits: { enabled: false },
      tooltip: {
        pointFormat: `<b>{point.percentage:.1f}%</b> ({point.y} ${label})`,
        style: { fontFamily: 'Inter, sans-serif' },
      },
      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'bottom',
        itemStyle: { color: '#1e293b', fontFamily: 'Inter, sans-serif', fontSize: '12px' },
        itemHoverStyle: { color: '#0f172a' },
      },
      plotOptions: {
        pie: {
          innerSize: '65%',
          borderWidth: 0,
          dataLabels: { enabled: false },
        },
      },
      colors,
      series: [
        {
          name: label,
          data: entries.map((entry) => ({ name: entry.label, y: entry.value })),
        },
      ],
    } as unknown as HighchartsOptions);

    return () => chart.destroy();
  }, [entries, highcharts, label, emptyMessage, colors]);

  return <div ref={containerRef} className="absolute inset-0" />;
};

const DistributionList = ({ entries }: { entries: DistributionEntry[] }) => (
  <ul className="space-y-2 text-sm text-slate-600">
    {entries.map((entry) => (
      <li key={entry.label} className="flex items-center justify-between">
        <span className="font-medium text-slate-700">{entry.label}</span>
        <span>
          {formatNumber(entry.value)} · {entry.percentage.toFixed(1)}%
        </span>
      </li>
    ))}
  </ul>
);

const PartnerRow = ({ partner, showAvatars }: { partner: PartnerEntry; showAvatars: boolean }) => (
  <tr className="table-row border-b border-slate-200 last:border-b-0">
    <td className="py-3 pl-4 pr-4">
      <div className="flex items-center gap-3">
        {showAvatars && (
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {partner.avatar ? (
              <img
                src={partner.avatar}
                alt={`${partner.name} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true">{initials(partner.name)}</span>
            )}
          </div>
        )}
        {partner.profile ? (
          <a
            href={partner.profile}
            target="_blank"
            rel="noopener noreferrer"
            className="table-link"
          >
            {partner.name}
          </a>
        ) : (
          <span className="text-slate-500">{partner.name}</span>
        )}
      </div>
    </td>
    <td className="py-3 pr-4 text-slate-700">{formatNumber(partner.count)}</td>
    <td className="py-3 pr-4 text-slate-500">{formatDate(partner.lastDate)}</td>
  </tr>
);

const PartnersTable = ({
  partners,
  showAvatars,
}: {
  partners: PartnerEntry[];
  showAvatars: boolean;
}) => {
  if (!partners.length) {
    return (
      <div className="py-6 text-sm text-slate-500">
        Roster insights will appear once activities include partner data.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th scope="col" className="py-3 pl-4 pr-4">
              Partner
            </th>
            <th scope="col" className="py-3 pr-4">
              Appearances
            </th>
            <th scope="col" className="py-3 pr-4">
              Last activity
            </th>
          </tr>
        </thead>
        <tbody>
          {partners.map((partner) => (
            <PartnerRow key={partner.uid} partner={partner} showAvatars={showAvatars} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InsightsApp = () => {
  const {
    loading,
    error,
    empty,
    filters,
    filterOptions,
    settings,
    view,
    summary,
    statusMessage,
    setFilter,
    clearFilters,
  } = useInsightsDashboard();

  const filterDisabled = empty || !view;

  const coverageRange = useMemo(
    () => formatDateRange(view?.meta.earliest ?? null, view?.meta.latest ?? null),
    [view]
  );
  const lastUpdated = useMemo(() => formatDate(view?.meta.lastUpdated ?? null), [view]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <header className="space-y-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
                Mountaineers Assistant
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Activity Insights Dashboard
              </h1>
            </div>
            <div className="glass-card rounded-xl px-4 py-3 text-sm text-slate-600">
              <p>
                Dataset coverage:{' '}
                <span className="font-medium text-slate-900">{coverageRange}</span>
              </p>
              <p className="mt-1">
                Last sync: <span className="font-medium text-slate-900">{lastUpdated}</span>
              </p>
              <p className="mt-1">
                Activity types tracked:{' '}
                <span className="font-medium text-slate-900">
                  {formatNumber(view?.metrics.uniqueTypes ?? 0)}
                </span>
              </p>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-slate-600">{summary}</p>
        </header>

        <section className="glass-card filter-card rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Filters
            </h2>
            <button
              type="button"
              className="text-xs font-medium text-sky-600 hover:underline disabled:text-slate-400"
              onClick={clearFilters}
              disabled={filterDisabled}
            >
              Clear filters
            </button>
          </div>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <ChoicesMultiSelect
              id="filter-activity-type"
              label="Activity type"
              options={filterOptions.activityTypes}
              value={filters.activityType}
              onChange={(values) => setFilter('activityType', values)}
              disabled={filterDisabled}
              formatter={titleCase}
            />
            <ChoicesMultiSelect
              id="filter-category"
              label="Category"
              options={filterOptions.categories}
              value={filters.category}
              onChange={(values) => setFilter('category', values)}
              disabled={filterDisabled}
              formatter={titleCase}
            />
            <ChoicesMultiSelect
              id="filter-role"
              label="Your role"
              options={filterOptions.roles}
              value={filters.role}
              onChange={(values) => setFilter('role', values)}
              disabled={filterDisabled || filterOptions.roles.length === 0}
              helperText={
                filterOptions.roles.length === 0
                  ? 'Role filter available once your roster roles are known.'
                  : undefined
              }
            />
            <ChoicesMultiSelect
              id="filter-partner"
              label="Activity partner"
              options={filterOptions.partners.map((p) => p.uid)}
              value={filters.partner}
              onChange={(values) => setFilter('partner', values)}
              disabled={filterDisabled || filterOptions.partners.length === 0}
              helperText={
                filterOptions.partners.length === 0
                  ? 'Partner filter available once roster data is known.'
                  : undefined
              }
              formatter={(uid) => {
                const partner = filterOptions.partners.find((p) => p.uid === uid);
                return partner?.name ?? uid;
              }}
            />
          </form>
        </section>

        {loading && <LoadingCard message={statusMessage} />}
        {error && !loading && <EmptyState message={error} />}
        {empty && !loading && !error && (
          <EmptyState message="Open the extension popup and run a refresh to populate insights." />
        )}

        {!loading && !error && !empty && view && (
          <div className="space-y-6" id="dashboardContent">
            <section className="grid gap-4 md:grid-cols-4">
              <article className="glass-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Total activities
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {formatNumber(view.metrics.totalActivities)}
                </p>
              </article>
              <article className="glass-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Trip outings
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {formatNumber(view.metrics.tripCount)}
                </p>
              </article>
              <article className="glass-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Courses & training
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {formatNumber(view.metrics.courseCount)}
                </p>
              </article>
              <article className="glass-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Unique partners
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {formatNumber(view.metrics.uniquePartners)}
                </p>
              </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-4">
              <article className="glass-card relative space-y-4 rounded-2xl p-6 xl:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-slate-900">Activities cadence</h2>
                    <p className="text-sm text-slate-500">
                      Monthly count of activities over the trailing year.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-600">
                    <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                    Trailing 12 months
                  </span>
                </div>
                <div className="relative h-96">
                  <TimelineChart data={view.timeline} />
                </div>
              </article>
              <article className="glass-card relative space-y-4 rounded-2xl p-6">
                <div>
                  <h2 className="text-lg font-medium text-slate-900">Activity mix</h2>
                  <p className="text-sm text-slate-500">
                    Distribution of activities by discipline.
                  </p>
                </div>
                <div className="relative h-72">
                  <DistributionChart
                    entries={view.activityType.entries}
                    label="Activities"
                    emptyMessage="No activity type data"
                    colors={getActivityTypeColors()}
                  />
                </div>
                <DistributionList entries={view.activityType.entries} />
              </article>
              <article className="glass-card relative space-y-4 rounded-2xl p-6">
                <div>
                  <h2 className="text-lg font-medium text-slate-900">Your roles</h2>
                  <p className="text-sm text-slate-500">How you showed up across activities.</p>
                </div>
                <div className="relative h-72">
                  <DistributionChart
                    entries={view.roles.entries}
                    label="Roles"
                    emptyMessage="No role data"
                    colors={['#22c55e', '#0f172a', '#14b8a6', '#f97316', '#94a3b8']}
                  />
                </div>
                <DistributionList entries={view.roles.entries} />
              </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="glass-card space-y-4 rounded-2xl p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-slate-900">Top activity partners</h2>
                    <p className="text-sm text-slate-500">
                      Teammates appearing alongside you most frequently.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    Showing top {view.partners.length} · {formatNumber(view.totals.partners)}{' '}
                    partners
                  </span>
                </div>
                <PartnersTable partners={view.partners} showAvatars={settings.showAvatars} />
              </article>
              <article className="glass-card space-y-4 rounded-2xl p-6">
                <div>
                  <h2 className="text-lg font-medium text-slate-900">Recent activities</h2>
                  <p className="text-sm text-slate-500">
                    Latest events with quick links back to mountaineers.org.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th scope="col" className="py-3 pl-4 pr-4">
                          Date
                        </th>
                        <th scope="col" className="py-3 pr-4">
                          Activity
                        </th>
                        <th scope="col" className="py-3 pr-4">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.recentActivities.length ? (
                        view.recentActivities.map((activity) => (
                          <tr
                            key={activity.uid}
                            className="table-row border-b border-slate-200 last:border-b-0"
                          >
                            <td className="py-3 pl-4 pr-4 text-slate-500">
                              {formatDate(activity.date)}
                            </td>
                            <td className="py-3 pr-4 text-slate-700">
                              {activity.href ? (
                                <a
                                  href={activity.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="table-link"
                                >
                                  {activity.title}
                                </a>
                              ) : (
                                <span className="text-slate-500">{activity.title}</span>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-slate-500">{activity.activity_type}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-6 pl-4 pr-4 text-sm text-slate-500">
                            Recent activity details will show here once eligible events are
                            available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsApp;
