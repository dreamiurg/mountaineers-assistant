(function () {
  const numberFormatter = new Intl.NumberFormat('en-US');
  const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  });
  const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const ACTIVITY_TYPE_COLORS = [
    '#0ea5e9',
    '#22d3ee',
    '#818cf8',
    '#f59e0b',
    '#94a3b8',
    '#22c55e',
    '#f97316',
    '#38bdf8',
  ];
  const MAX_TIMELINE_SERIES = 5;
  const OTHER_TIMELINE_LABEL = 'Other types';

  function formatNumber(value) {
    return numberFormatter.format(value ?? 0);
  }

  function formatDate(date) {
    return date ? fullDateFormatter.format(date) : '–';
  }

  function formatDateRange(start, end) {
    if (!start && !end) return '–';
    if (!start) return formatDate(end);
    if (!end) return formatDate(start);
    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  function mutateText(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function resetContainer(id) {
    const el = document.getElementById(id);
    if (el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }
    return el;
  }

  function destroyChart(containerId) {
    if (!window.Highcharts || !Array.isArray(window.Highcharts.charts)) return;
    const chart = window.Highcharts.charts.find(
      (instance) => instance && instance.renderTo && instance.renderTo.id === containerId
    );
    if (chart) {
      chart.destroy();
    }
  }

  function renderMetrics(metrics) {
    mutateText('metric-total', formatNumber(metrics.totalActivities));
    mutateText('metric-trips', formatNumber(metrics.tripCount));
    mutateText('metric-courses', formatNumber(metrics.courseCount));
    mutateText('metric-partners', formatNumber(metrics.uniquePartners));
  }

  function renderMeta(meta, metrics) {
    mutateText('coverageRange', formatDateRange(meta.earliest, meta.latest));
    mutateText('lastUpdated', formatDate(meta.lastUpdated));
    mutateText('activityTypeCount', formatNumber(metrics.uniqueTypes));
  }

  function renderTimelineChart(timeline) {
    if (!window.Highcharts) return;
    const containerId = 'activityTimeline';
    destroyChart(containerId);

    window.Highcharts.chart(containerId, {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
      },
      title: { text: null },
      xAxis: {
        categories: timeline.categories,
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
          const total = this.points.reduce((sum, point) => sum + point.y, 0);
          const parts = this.points
            .filter((point) => point.y)
            .map(
              (point) =>
                `<span style="color:${point.color}">●</span> ${point.series.name}: <b>${point.y}</b>`
            );
          parts.push(`<span style="color:#0f172a">Total: <b>${total}</b></span>`);
          return `<span style="font-size:12px">${this.x}</span><br/>${parts.join('<br/>')}`;
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
      colors: ACTIVITY_TYPE_COLORS,
      series: timeline.series.map((series) => ({
        name: series.name,
        data: series.data,
      })),
    });
  }

  function renderActivityTypeChart(activityType) {
    if (!window.Highcharts) return;
    const containerId = 'activityTypeChart';
    destroyChart(containerId);

    const listEl = resetContainer('activityTypeList');
    if (!listEl) return;
    if (!activityType.entries.length) {
      window.Highcharts.chart(containerId, {
        title: {
          text: 'No activity type data',
          style: { color: '#64748b', fontFamily: 'Inter, sans-serif' },
        },
        credits: { enabled: false },
      });
      return;
    }

    const chart = window.Highcharts.chart(containerId, {
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
      },
      title: { text: null },
      credits: { enabled: false },
      tooltip: {
        pointFormat: '<b>{point.percentage:.1f}%</b> ({point.y} activities)',
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
          dataLabels: {
            enabled: false,
          },
        },
      },
      colors: ACTIVITY_TYPE_COLORS,
      series: [
        {
          name: 'Activities',
          data: activityType.entries.map((entry) => ({ name: entry.label, y: entry.value })),
        },
      ],
    });

    const entryLookup = new Map(activityType.entries.map((entry) => [entry.label, entry]));
    chart.series[0].points.forEach((point) => {
      const entry = entryLookup.get(point.name);
      if (!entry) return;
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between text-sm text-slate-600 transition-opacity';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'font-medium text-slate-700';
      labelSpan.textContent = entry.label;

      const valueSpan = document.createElement('span');
      valueSpan.textContent = `${formatNumber(entry.value)} · ${entry.percentage.toFixed(1)}%`;

      li.appendChild(labelSpan);
      li.appendChild(valueSpan);
      if (!point.visible) {
        li.classList.add('opacity-50');
      }

      window.Highcharts.addEvent(point, 'hide', () => {
        li.classList.add('opacity-50');
      });
      window.Highcharts.addEvent(point, 'show', () => {
        li.classList.remove('opacity-50');
      });

      listEl.appendChild(li);
    });
  }

  function renderRoleChart(roles) {
    if (!window.Highcharts) return;
    const containerId = 'roleChart';
    destroyChart(containerId);

    const listEl = resetContainer('roleList');
    if (!listEl) return;
    if (!roles.entries.length) {
      window.Highcharts.chart(containerId, {
        title: {
          text: 'No role data',
          style: { color: '#64748b', fontFamily: 'Inter, sans-serif' },
        },
        credits: { enabled: false },
      });
      return;
    }

    const chart = window.Highcharts.chart(containerId, {
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
      },
      title: { text: null },
      credits: { enabled: false },
      tooltip: {
        pointFormat: '<b>{point.percentage:.1f}%</b> ({point.y} roles)',
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
          dataLabels: {
            enabled: false,
          },
        },
      },
      colors: ['#22c55e', '#0f172a', '#14b8a6', '#f97316', '#94a3b8'],
      series: [
        {
          name: 'Roles',
          data: roles.entries.map((entry) => ({ name: entry.label, y: entry.value })),
        },
      ],
    });

    const entryLookup = new Map(roles.entries.map((entry) => [entry.label, entry]));
    chart.series[0].points.forEach((point) => {
      const entry = entryLookup.get(point.name);
      if (!entry) return;
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between text-sm text-slate-600 transition-opacity';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'font-medium text-slate-700';
      labelSpan.textContent = entry.label;

      const valueSpan = document.createElement('span');
      valueSpan.textContent = `${formatNumber(entry.value)} · ${entry.percentage.toFixed(1)}%`;

      li.appendChild(labelSpan);
      li.appendChild(valueSpan);
      if (!point.visible) {
        li.classList.add('opacity-50');
      }

      window.Highcharts.addEvent(point, 'hide', () => {
        li.classList.add('opacity-50');
      });
      window.Highcharts.addEvent(point, 'show', () => {
        li.classList.remove('opacity-50');
      });

      listEl.appendChild(li);
    });
  }

  function renderPartners(partners, totalPartnerCount) {
    if (partners.length && totalPartnerCount) {
      mutateText(
        'partnerTotal',
        `Showing top ${partners.length} · ${formatNumber(totalPartnerCount)} partners`
      );
    } else {
      mutateText('partnerTotal', 'No partner data yet');
    }

    const table = resetContainer('partnerTable');
    if (!table || !partners.length) return;

    partners.forEach((partner) => {
      const row = document.createElement('tr');
      row.className = 'table-row';

      const nameCell = document.createElement('td');
      nameCell.className = 'py-3 pl-4 pr-4';
      if (partner.profile) {
        const link = document.createElement('a');
        link.className = 'table-link';
        link.href = partner.profile;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = partner.name;
        nameCell.appendChild(link);
      } else {
        nameCell.textContent = partner.name;
      }

      const countCell = document.createElement('td');
      countCell.className = 'py-3 pr-4 text-slate-700';
      countCell.textContent = formatNumber(partner.count);

      const dateCell = document.createElement('td');
      dateCell.className = 'py-3 pr-4 text-slate-500';
      dateCell.textContent = formatDate(partner.lastDate);

      row.appendChild(nameCell);
      row.appendChild(countCell);
      row.appendChild(dateCell);
      table.appendChild(row);
    });
  }

  function renderRecentActivities(activities) {
    const table = resetContainer('recentTable');
    if (!table || !activities.length) return;

    activities.forEach((activity) => {
      const row = document.createElement('tr');
      row.className = 'table-row';

      const dateCell = document.createElement('td');
      dateCell.className = 'py-3 pl-4 pr-4 text-slate-500';
      dateCell.textContent = formatDate(activity.date);

      const titleCell = document.createElement('td');
      titleCell.className = 'py-3 pr-4 text-slate-700';
      const link = document.createElement('a');
      link.className = 'table-link';
      link.href = activity.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = activity.title;
      titleCell.appendChild(link);

      const typeCell = document.createElement('td');
      typeCell.className = 'py-3 pr-4 text-slate-500';
      typeCell.textContent = activity.activity_type;

      row.appendChild(dateCell);
      row.appendChild(titleCell);
      row.appendChild(typeCell);
      table.appendChild(row);
    });
  }

  function prepareData(payload) {
    const activities = Array.isArray(payload.activities) ? payload.activities : [];
    const rosterEntries = Array.isArray(payload.rosterEntries) ? payload.rosterEntries : [];
    const people = Array.isArray(payload.people) ? payload.people : [];
    const currentUserUid = payload.currentUserUid ?? null;
    const lastUpdated = payload.lastUpdated ? new Date(payload.lastUpdated) : null;

    const peopleMap = new Map(people.map((person) => [person.uid, person]));

    const activitiesWithDates = activities
      .map((activity) => ({
        ...activity,
        date: activity.start_date ? new Date(activity.start_date) : null,
      }))
      .filter((activity) => activity.date && !Number.isNaN(activity.date.valueOf()))
      .sort((a, b) => a.date - b.date);

    const validActivityUids = new Set(activitiesWithDates.map((activity) => activity.uid));

    const activityTypeCounts = new Map();
    const monthTypeCounts = new Map();
    const rosterByActivity = new Map();

    activitiesWithDates.forEach((activity) => {
      const typeKey = activity.activity_type || 'Other';
      activityTypeCounts.set(typeKey, (activityTypeCounts.get(typeKey) || 0) + 1);

      const monthKey = `${activity.date.getUTCFullYear()}-${activity.date.getUTCMonth()}`;
      if (!monthTypeCounts.has(monthKey)) {
        monthTypeCounts.set(monthKey, new Map());
      }
      const typeCounts = monthTypeCounts.get(monthKey);
      typeCounts.set(typeKey, (typeCounts.get(typeKey) || 0) + 1);
    });

    rosterEntries.forEach((entry) => {
      if (!validActivityUids.has(entry.activity_uid)) return;
      if (!rosterByActivity.has(entry.activity_uid)) {
        rosterByActivity.set(entry.activity_uid, []);
      }
      rosterByActivity.get(entry.activity_uid).push(entry);
    });

    const roleCounts = new Map();
    rosterEntries.forEach((entry) => {
      if (!validActivityUids.has(entry.activity_uid)) return;
      if (currentUserUid && entry.person_uid !== currentUserUid) return;
      const roleKey = entry.role || 'Participant';
      roleCounts.set(roleKey, (roleCounts.get(roleKey) || 0) + 1);
    });

    const partnerStats = new Map();
    activitiesWithDates.forEach((activity) => {
      const roster = rosterByActivity.get(activity.uid) || [];
      const seen = new Set();
      roster.forEach((entry) => {
        if (entry.person_uid === currentUserUid) return;
        if (seen.has(entry.person_uid)) return;
        seen.add(entry.person_uid);
        const stats = partnerStats.get(entry.person_uid) || { count: 0, lastDate: null };
        stats.count += 1;
        if (!stats.lastDate || stats.lastDate < activity.date) {
          stats.lastDate = activity.date;
        }
        partnerStats.set(entry.person_uid, stats);
      });
    });

    const partners = Array.from(partnerStats.entries())
      .map(([uid, stats]) => ({
        uid,
        name: peopleMap.get(uid)?.name || uid,
        profile: peopleMap.get(uid)?.href || null,
        count: stats.count,
        lastDate: stats.lastDate,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return (b.lastDate ? b.lastDate.getTime() : 0) - (a.lastDate ? a.lastDate.getTime() : 0);
      })
      .slice(0, 10);

    const metrics = {
      totalActivities: activitiesWithDates.length,
      tripCount: activitiesWithDates.filter((activity) => activity.category === 'trip').length,
      courseCount: activitiesWithDates.filter((activity) => activity.category === 'course').length,
      uniquePartners: partnerStats.size,
      uniqueTypes: activityTypeCounts.size,
    };

    const recentActivities = [...activitiesWithDates].sort((a, b) => b.date - a.date).slice(0, 8);

    const rolesSorted = Array.from(roleCounts.entries()).sort((a, b) => b[1] - a[1]);
    const totalRoles = rolesSorted.reduce((sum, [, count]) => sum + count, 0);
    const primaryRoles = rolesSorted.slice(0, 4);
    const otherCount = rolesSorted.slice(4).reduce((sum, [, count]) => sum + count, 0);
    if (otherCount > 0) {
      primaryRoles.push(['Other', otherCount]);
    }

    const roles = {
      entries: primaryRoles.map(([label, value]) => ({
        label,
        value,
        percentage: totalRoles ? (value / totalRoles) * 100 : 0,
      })),
      total: totalRoles,
    };

    const sortedTypeEntries = Array.from(activityTypeCounts.entries()).sort((a, b) => b[1] - a[1]);
    const timelineTypeKeys = sortedTypeEntries
      .slice(0, MAX_TIMELINE_SERIES)
      .map(([label]) => label);
    const timelineTypeSet = new Set(timelineTypeKeys);
    const includeOtherTimelineSeries = sortedTypeEntries.length > timelineTypeKeys.length;
    const timelineSeriesBuckets = new Map();
    timelineTypeKeys.forEach((label) => {
      timelineSeriesBuckets.set(label, []);
    });
    if (includeOtherTimelineSeries) {
      timelineSeriesBuckets.set(OTHER_TIMELINE_LABEL, []);
    }

    const timelineLatest = activitiesWithDates[activitiesWithDates.length - 1]?.date || new Date();
    const anchor = new Date(
      Date.UTC(timelineLatest.getUTCFullYear(), timelineLatest.getUTCMonth(), 1)
    );
    const timelineCategories = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const monthDate = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - offset, 1)
      );
      const key = `${monthDate.getUTCFullYear()}-${monthDate.getUTCMonth()}`;
      const typeCounts = monthTypeCounts.get(key) || new Map();
      timelineCategories.push(monthYearFormatter.format(monthDate));

      timelineTypeKeys.forEach((label) => {
        const dataList = timelineSeriesBuckets.get(label);
        dataList.push(typeCounts.get(label) || 0);
      });

      if (includeOtherTimelineSeries) {
        let otherTotal = 0;
        typeCounts.forEach((count, typeLabel) => {
          if (!timelineTypeSet.has(typeLabel)) {
            otherTotal += count;
          }
        });
        timelineSeriesBuckets.get(OTHER_TIMELINE_LABEL).push(otherTotal);
      }
    }

    const timelineSeries = Array.from(timelineSeriesBuckets.entries()).map(([name, data]) => ({
      name,
      data,
    }));

    const meta = {
      earliest: activitiesWithDates[0]?.date || null,
      latest: activitiesWithDates[activitiesWithDates.length - 1]?.date || null,
      lastUpdated,
    };

    return {
      metrics,
      meta,
      timeline: { categories: timelineCategories, series: timelineSeries },
      activityType: {
        entries: sortedTypeEntries.map(([label, value]) => ({
          label,
          value,
          percentage: metrics.totalActivities ? (value / metrics.totalActivities) * 100 : 0,
        })),
      },
      roles,
      partners,
      recentActivities,
      totals: { partners: partnerStats.size },
    };
  }

  async function loadSampleData() {
    if (window.__SNAPSHOT_SAMPLE_DATA__) {
      return window.__SNAPSHOT_SAMPLE_DATA__;
    }

    const response = await fetch('sample-data.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load sample data (${response.status})`);
    }
    return response.json();
  }

  async function initDashboard() {
    const loadingEl = document.getElementById('loadingState');
    const dashboardEl = document.getElementById('dashboardContent');
    const emptyEl = document.getElementById('emptyState');
    const statusTitle = document.getElementById('statusTitle');
    const statusDetail = document.getElementById('statusDetail');

    try {
      statusTitle.textContent = 'Preparing dashboard';
      statusDetail.textContent = 'Fetching sample data…';

      const data = await loadSampleData();
      const prepared = prepareData(data);

      if (!prepared.metrics.totalActivities) {
        loadingEl.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        return;
      }

      renderMetrics(prepared.metrics);
      renderMeta(prepared.meta, prepared.metrics);
      renderTimelineChart(prepared.timeline);
      renderActivityTypeChart(prepared.activityType);
      renderRoleChart(prepared.roles);
      renderPartners(prepared.partners, prepared.totals.partners);
      renderRecentActivities(prepared.recentActivities);

      loadingEl.classList.add('hidden');
      emptyEl.classList.add('hidden');
      dashboardEl.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      statusTitle.textContent = 'Unable to load dashboard';
      statusDetail.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  document.addEventListener('DOMContentLoaded', initDashboard);
})();
