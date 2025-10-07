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

  const filterState = {
    activityType: [],
    category: [],
    role: [],
  };

  const filterControls = {
    activityType: null,
    category: null,
    role: null,
  };

  const FILTER_KEYS = ['activityType', 'category', 'role'];

  function cloneOptions(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  let suppressFilterChange = false;

  let readyResolve;
  const dashboardReady = new Promise((resolve) => {
    readyResolve = resolve;
  });

  function ensureGlobalApi() {
    if (!window.mountaineersDashboard) {
      window.mountaineersDashboard = {};
    }

    Object.assign(window.mountaineersDashboard, {
      ready: dashboardReady,
      getFilters: () => ({
        activityType: [...filterState.activityType],
        category: [...filterState.category],
        role: [...filterState.role],
      }),
      getFilterOptions: () => (baseData ? cloneOptions(baseData.filterOptions) : null),
      clearFilters() {
        setFiltersFromApi({ activityType: [], category: [], role: [] });
      },
      setFilters: setFiltersFromApi,
    });
  }

  ensureGlobalApi();

  let baseData = null;

  function getActivityTypeLabel(raw) {
    return raw && raw.trim() ? raw : 'Other';
  }

  function getRoleLabel(raw) {
    return raw && raw.trim() ? raw : 'Participant';
  }

  function titleCase(value) {
    if (!value) return 'Uncategorized';
    return value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  const FILTER_DEFINITIONS = {
    activityType: {
      selectId: 'filter-activity-type',
      placeholder: 'All activity types',
      labelFormatter: titleCase,
    },
    category: {
      selectId: 'filter-category',
      placeholder: 'All categories',
      labelFormatter: titleCase,
    },
    role: {
      selectId: 'filter-role',
      placeholder: 'All roles',
      labelFormatter: titleCase,
    },
  };

  function getSelectedValues(selectElement) {
    const values = new Set();
    Array.from(selectElement?.selectedOptions || []).forEach((option) => {
      if (option.value) {
        values.add(option.value);
      }
    });
    return Array.from(values);
  }

  function initializeFilterControls() {
    Object.entries(FILTER_DEFINITIONS).forEach(([key, config]) => {
      if (filterControls[key]) return;
      const select = document.getElementById(config.selectId);
      if (!select) return;

      const hasChoices = typeof window.Choices !== 'undefined';
      const instance = hasChoices
        ? new window.Choices(select, {
            removeItemButton: true,
            allowHTML: false,
            placeholder: true,
            placeholderValue: config.placeholder,
            searchEnabled: true,
            shouldSort: false,
            itemSelectText: '',
          })
        : null;

      select.addEventListener('change', () => {
        if (suppressFilterChange) return;
        filterState[key] = getSelectedValues(select);
        applyFilters();
      });

      filterControls[key] = { instance, config, select };
    });
  }

  function syncSelectSelection(key, values) {
    const control = filterControls[key];
    if (!control) return;

    if (control.instance) {
      control.instance.removeActiveItems();
      values.forEach((value) => {
        control.instance.setChoiceByValue(value);
      });
    } else if (control.select) {
      Array.from(control.select.options).forEach((option) => {
        option.selected = values.includes(option.value);
      });
    }
  }

  function setFiltersFromApi(overrides) {
    if (!overrides || typeof overrides !== 'object') {
      return;
    }

    suppressFilterChange = true;
    try {
      FILTER_KEYS.forEach((key) => {
        const values = Array.isArray(overrides[key])
          ? overrides[key].filter((value) => typeof value === 'string' && value.length)
          : [];
        filterState[key] = values;
        syncSelectSelection(key, values);
      });
    } finally {
      suppressFilterChange = false;
    }

    applyFilters();
  }

  function signalReady(payload) {
    if (readyResolve) {
      readyResolve(payload);
      readyResolve = null;
    }
  }

  function populateNativeSelect(key, values) {
    const control = filterControls[key];
    if (!control || !control.select) return;

    const { select, config } = control;
    const uniqueValues = Array.from(new Set(values));
    const previousSelection = new Set(filterState[key] || []);

    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }

    uniqueValues.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = config.labelFormatter ? config.labelFormatter(value) : value;
      if (previousSelection.has(value)) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    filterState[key] = uniqueValues.filter((value) => previousSelection.has(value));

    if (config.disableWhenEmpty && uniqueValues.length === 0) {
      select.disabled = true;
      select.title = 'Role filter available once your roster roles are known.';
      filterState[key] = [];
    } else {
      select.disabled = false;
      select.title = '';
    }
  }

  function syncFilterChoices(key, values) {
    const control = filterControls[key];
    if (!control) return;

    if (!control.instance) {
      populateNativeSelect(key, values);
      return;
    }

    const uniqueValues = Array.from(new Set(values));
    const previousSelection = new Set(filterState[key] || []);
    const selectedValues = uniqueValues.filter((value) => previousSelection.has(value));

    control.instance.clearChoices();
    control.instance.setChoices(
      uniqueValues.map((value) => ({
        value,
        label: control.config.labelFormatter ? control.config.labelFormatter(value) : value,
        selected: selectedValues.includes(value),
      })),
      'value',
      'label',
      true
    );

    filterState[key] = selectedValues;

    const selectEl = control.select;
    if (control.config.disableWhenEmpty && uniqueValues.length === 0) {
      control.instance.disable();
      control.instance.removeActiveItems();
      filterState[key] = [];
      if (selectEl) {
        selectEl.title = 'Role filter available once your roster roles are known.';
      }
    } else {
      control.instance.enable();
      if (selectEl) {
        selectEl.title = '';
      }
    }
  }

  function populateFilterOptions(options) {
    syncFilterChoices('activityType', options.activityTypes);
    syncFilterChoices('category', options.categories);
    syncFilterChoices('role', options.roles);
  }

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
    const rosterEntriesRaw = Array.isArray(payload.rosterEntries) ? payload.rosterEntries : [];
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

    const rosterEntries = rosterEntriesRaw.filter((entry) =>
      validActivityUids.has(entry.activity_uid)
    );

    const rosterByActivity = new Map();
    rosterEntries.forEach((entry) => {
      if (!rosterByActivity.has(entry.activity_uid)) {
        rosterByActivity.set(entry.activity_uid, []);
      }
      rosterByActivity.get(entry.activity_uid).push(entry);
    });

    const categorySet = new Set();
    const activityTypeSet = new Set();
    const roleSet = new Set();

    const activitiesEnriched = activitiesWithDates.map((activity) => {
      const typeLabel = getActivityTypeLabel(activity.activity_type);
      activityTypeSet.add(typeLabel);

      const categoryKey = activity.category
        ? String(activity.category).toLowerCase()
        : 'uncategorized';
      categorySet.add(categoryKey);

      const roster = rosterByActivity.get(activity.uid) || [];
      const userRoleSet = new Set();
      if (currentUserUid) {
        roster.forEach((entry) => {
          if (entry.person_uid === currentUserUid) {
            const roleLabel = getRoleLabel(entry.role);
            userRoleSet.add(roleLabel);
            roleSet.add(roleLabel);
          }
        });
      }

      const monthKey = activity.date
        ? `${activity.date.getUTCFullYear()}-${activity.date.getUTCMonth()}`
        : null;

      return {
        ...activity,
        typeLabel,
        categoryKey,
        userRoles: Array.from(userRoleSet),
        monthKey,
      };
    });

    const latestActivityDate =
      activitiesEnriched[activitiesEnriched.length - 1]?.date || new Date();
    const timelineMonths = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const monthDate = new Date(
        Date.UTC(latestActivityDate.getUTCFullYear(), latestActivityDate.getUTCMonth() - offset, 1)
      );
      timelineMonths.push({
        key: `${monthDate.getUTCFullYear()}-${monthDate.getUTCMonth()}`,
        label: monthYearFormatter.format(monthDate),
      });
    }

    const activityTypes = Array.from(activityTypeSet).sort((a, b) => a.localeCompare(b));
    const categories = Array.from(categorySet).sort((a, b) => {
      if (a === 'uncategorized') return 1;
      if (b === 'uncategorized') return -1;
      return a.localeCompare(b);
    });
    const roles = Array.from(roleSet).sort((a, b) => a.localeCompare(b));

    return {
      activities: activitiesEnriched,
      rosterByActivity,
      peopleMap,
      currentUserUid,
      lastUpdated,
      timelineMonths,
      filterOptions: {
        activityTypes,
        categories,
        roles,
      },
    };
  }

  function calculateDashboard(prepared, filters) {
    const typeFilter = new Set(filters.activityType || []);
    const categoryFilter = new Set(filters.category || []);
    const roleFilter = new Set(filters.role || []);

    const filteredActivities = prepared.activities.filter((activity) => {
      if (typeFilter.size && !typeFilter.has(activity.typeLabel)) return false;
      if (categoryFilter.size && !categoryFilter.has(activity.categoryKey)) return false;
      if (roleFilter.size) {
        if (!activity.userRoles.length) return false;
        const matchesRole = activity.userRoles.some((role) => roleFilter.has(role));
        if (!matchesRole) return false;
      }
      return true;
    });

    const activityTypeCounts = new Map();
    const monthTypeCounts = new Map();
    filteredActivities.forEach((activity) => {
      const typeKey = activity.typeLabel;
      activityTypeCounts.set(typeKey, (activityTypeCounts.get(typeKey) || 0) + 1);

      if (activity.monthKey) {
        if (!monthTypeCounts.has(activity.monthKey)) {
          monthTypeCounts.set(activity.monthKey, new Map());
        }
        const typeCounts = monthTypeCounts.get(activity.monthKey);
        typeCounts.set(typeKey, (typeCounts.get(typeKey) || 0) + 1);
      }
    });

    const partnerStats = new Map();
    filteredActivities.forEach((activity) => {
      const roster = prepared.rosterByActivity.get(activity.uid) || [];
      const seen = new Set();
      roster.forEach((entry) => {
        if (entry.person_uid === prepared.currentUserUid) return;
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

    const roleCounts = new Map();
    filteredActivities.forEach((activity) => {
      activity.userRoles.forEach((role) => {
        roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
      });
    });

    const partners = Array.from(partnerStats.entries())
      .map(([uid, stats]) => ({
        uid,
        name: prepared.peopleMap.get(uid)?.name || uid,
        profile: prepared.peopleMap.get(uid)?.href || null,
        count: stats.count,
        lastDate: stats.lastDate,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return (b.lastDate ? b.lastDate.getTime() : 0) - (a.lastDate ? a.lastDate.getTime() : 0);
      })
      .slice(0, 10);

    const metrics = {
      totalActivities: filteredActivities.length,
      tripCount: filteredActivities.filter((activity) => activity.categoryKey === 'trip').length,
      courseCount: filteredActivities.filter((activity) => activity.categoryKey === 'course')
        .length,
      uniquePartners: partnerStats.size,
      uniqueTypes: activityTypeCounts.size,
    };

    const recentActivities = [...filteredActivities].sort((a, b) => b.date - a.date).slice(0, 8);

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

    prepared.timelineMonths.forEach((month) => {
      const typeCounts = monthTypeCounts.get(month.key) || new Map();

      timelineTypeKeys.forEach((label) => {
        timelineSeriesBuckets.get(label).push(typeCounts.get(label) || 0);
      });

      if (includeOtherTimelineSeries) {
        let otherTotal = 0;
        typeCounts.forEach((count, label) => {
          if (!timelineTypeSet.has(label)) {
            otherTotal += count;
          }
        });
        timelineSeriesBuckets.get(OTHER_TIMELINE_LABEL).push(otherTotal);
      }
    });

    const timelineSeries = Array.from(timelineSeriesBuckets.entries()).map(([name, data]) => ({
      name,
      data,
    }));

    const meta = {
      earliest: filteredActivities[0]?.date || null,
      latest: filteredActivities[filteredActivities.length - 1]?.date || null,
      lastUpdated: prepared.lastUpdated,
    };

    return {
      metrics,
      meta,
      timeline: {
        categories: prepared.timelineMonths.map((month) => month.label),
        series: timelineSeries,
      },
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

  function applyFilters() {
    if (!baseData || !Array.isArray(baseData.activities) || !baseData.activities.length) {
      return;
    }

    const preparedView = calculateDashboard(baseData, filterState);

    renderMetrics(preparedView.metrics);
    renderMeta(preparedView.meta, preparedView.metrics);
    renderTimelineChart(preparedView.timeline);
    renderActivityTypeChart(preparedView.activityType);
    renderRoleChart(preparedView.roles);
    renderPartners(preparedView.partners, preparedView.totals.partners);
    renderRecentActivities(preparedView.recentActivities);
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

    initializeFilterControls();

    try {
      statusTitle.textContent = 'Preparing dashboard';
      statusDetail.textContent = 'Fetching sample data…';

      const data = await loadSampleData();
      baseData = prepareData(data);

      if (!baseData.activities.length) {
        loadingEl.classList.add('hidden');
        dashboardEl.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        window.mountaineersDashboard.filterOptions = cloneOptions(baseData.filterOptions);
        signalReady({ filterOptions: baseData.filterOptions, empty: true });
        return;
      }

      filterState.activityType = [];
      filterState.category = [];
      filterState.role = [];

      populateFilterOptions(baseData.filterOptions);
      applyFilters();

      window.mountaineersDashboard.filterOptions = cloneOptions(baseData.filterOptions);
      signalReady({ filterOptions: baseData.filterOptions });

      loadingEl.classList.add('hidden');
      emptyEl.classList.add('hidden');
      dashboardEl.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      statusTitle.textContent = 'Unable to load dashboard';
      statusDetail.textContent = error instanceof Error ? error.message : String(error);
      signalReady(null);
    }
  }

  document.addEventListener('DOMContentLoaded', initDashboard);
})();
