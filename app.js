// ReliefHub: Flood Relief Coordination Dashboard Client Application
// Full integration with Mock REST API, interactive state, validations, and charts.

const API_BASE = '/api';

// Application State
const state = {
  currentRole: localStorage.getItem('reliefhub_role') || 'Admin', // 'Admin' (Relief Coordinator) | 'Volunteer' (Field Volunteer)
  currentTab: 'dashboard',
  camps: [],
  inventory: [],
  needs: [],
  dispatches: [],
  donations: [],
  volunteers: [],
  loading: false,
  filters: {
    camps: { search: '', district: 'all', status: 'all' },
    needs: { campId: 'all', priority: 'all', status: 'all' },
    inventory: { category: 'all', lowStockOnly: false },
    dispatches: { status: 'all', search: '' },
    donations: { type: 'all', category: 'all' },
    volunteers: { skill: 'all', assignment: 'all', search: '' }
  }
};

// UI Helpers: Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'danger') icon = '⚠️';
  if (type === 'warning') icon = '🔔';

  toast.innerHTML = `<span>${icon}</span><span style="flex:1;">${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(num) {
  return new Intl.NumberFormat().format(num || 0);
}

function formatCurrency(amount) {
  return 'Rs. ' + formatNumber(amount);
}

// REST API Client
async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error [${method} ${endpoint}]:`, err);
    showToast(err.message, 'danger');
    throw err;
  }
}

// Initial Data Fetch
async function loadAllData() {
  state.loading = true;
  updateLoadingIndicator(true);
  try {
    const [camps, inventory, needs, dispatches, donations, volunteers] = await Promise.all([
      apiRequest('/camps'),
      apiRequest('/inventory'),
      apiRequest('/needs'),
      apiRequest('/dispatches'),
      apiRequest('/donations'),
      apiRequest('/volunteers')
    ]);

    state.camps = camps;
    state.inventory = inventory;
    state.needs = needs;
    state.dispatches = dispatches;
    state.donations = donations;
    state.volunteers = volunteers;

    renderCurrentView();
    updateHeaderCounts();
  } catch (err) {
    console.error('Failed to load initial data:', err);
  } finally {
    state.loading = false;
    updateLoadingIndicator(false);
  }
}

function updateLoadingIndicator(isLoading) {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  if (isLoading) {
    el.innerHTML = '🔄 <span style="font-size:0.75rem; color:#94a3b8;">Syncing with API...</span>';
  } else {
    el.innerHTML = '🟢 <span style="font-size:0.75rem; color:#86efac;">API Online (Port 3000)</span>';
  }
}

function updateHeaderCounts() {
  const campCountBadge = document.getElementById('badge-camp-count');
  if (campCountBadge) campCountBadge.textContent = state.camps.length;

  const needsCountBadge = document.getElementById('badge-needs-count');
  if (needsCountBadge) needsCountBadge.textContent = state.needs.length;

  const dispatchCountBadge = document.getElementById('badge-dispatch-count');
  if (dispatchCountBadge) dispatchCountBadge.textContent = state.dispatches.length;

  const volCountBadge = document.getElementById('badge-vol-count');
  if (volCountBadge) volCountBadge.textContent = state.volunteers.length;
}

// Role Switcher Management
function setRole(newRole) {
  state.currentRole = newRole;
  localStorage.setItem('reliefhub_role', newRole);
  updateRoleUI();
  renderCurrentView();
  showToast(`Switched active role to: ${newRole === 'Admin' ? 'Relief Coordinator (Admin)' : 'Field Volunteer'}`, 'info');
}

function updateRoleUI() {
  const btnAdmin = document.getElementById('role-btn-admin');
  const btnVol = document.getElementById('role-btn-vol');
  const roleDesc = document.getElementById('active-role-desc');

  if (state.currentRole === 'Admin') {
    btnAdmin.classList.add('active');
    btnVol.classList.remove('active');
    if (roleDesc) {
      roleDesc.innerHTML = `<span class="badge badge-role-admin">Admin Mode</span> Full permissions: Camp registry, Stock management, Dispatch authorization, Volunteer assignments.`;
    }
  } else {
    btnAdmin.classList.remove('active');
    btnVol.classList.add('active');
    if (roleDesc) {
      roleDesc.innerHTML = `<span class="badge badge-role-vol">Volunteer Mode</span> Field view: Log needs, inspect dispatches, self-assign. Admin mutations restricted.`;
    }
  }
}

function requireAdmin(actionName = 'This action') {
  if (state.currentRole !== 'Admin') {
    showToast(`Permission Denied: ${actionName} requires Relief Coordinator (Admin) privileges. Switch roles in the header to proceed.`, 'warning');
    return false;
  }
  return true;
}

// Tab Switching
function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });
  renderCurrentView();
}

function renderCurrentView() {
  switch (state.currentTab) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'camps':
      renderCampsView();
      break;
    case 'needs':
      renderNeedsAndWarehouseView();
      break;
    case 'dispatches':
      renderDispatchesView();
      break;
    case 'donations':
      renderDonationsAndVolunteersView();
      break;
  }
}

// ==========================================
// MILESTONE 5: DASHBOARD & CRITICAL GAPS
// ==========================================
function renderDashboard() {
  // 1. Calculate KPI Metrics
  const activeCampsCount = state.camps.filter(c => c.status === 'Active' || c.status === 'Full').length;
  const fullCampsCount = state.camps.filter(c => c.status === 'Full').length;
  const closedCampsCount = state.camps.filter(c => c.status === 'Closed').length;

  const totalFamiliesSheltered = state.camps
    .filter(c => c.status !== 'Closed')
    .reduce((sum, c) => sum + (c.current_families || 0), 0);

  const totalCapacity = state.camps
    .filter(c => c.status !== 'Closed')
    .reduce((sum, c) => sum + (c.capacity || 0), 0);

  const capacityRate = totalCapacity > 0 ? Math.round((totalFamiliesSheltered / totalCapacity) * 100) : 0;

  // Fulfilment Rate across all needs
  const totalRequired = state.needs.reduce((sum, n) => sum + (n.required_quantity || 0), 0);
  const totalFulfilled = state.needs.reduce((sum, n) => sum + (n.fulfilled_quantity || 0), 0);
  const overallFulfilmentPct = totalRequired > 0 ? Math.round((totalFulfilled / totalRequired) * 100) : 0;

  // Low Stock Items (stock <= reorder_level)
  const lowStockItems = state.inventory.filter(i => (i.stock || 0) <= (i.reorder_level || 0));

  // Volunteers Deployed
  const deployedVolunteers = state.volunteers.filter(v => v.camp_id !== null).length;
  const totalVolunteers = state.volunteers.length;

  // Update KPI Cards
  document.getElementById('kpi-active-camps').textContent = activeCampsCount;
  document.getElementById('kpi-active-camps-sub').textContent = `${fullCampsCount} at max capacity (${fullCampsCount} Full, ${closedCampsCount} Closed)`;

  document.getElementById('kpi-families').textContent = formatNumber(totalFamiliesSheltered);
  document.getElementById('kpi-families-sub').textContent = `${capacityRate}% of active capacity (${formatNumber(totalCapacity)} max)`;

  document.getElementById('kpi-fulfilment').textContent = `${overallFulfilmentPct}%`;
  document.getElementById('kpi-fulfilment-sub').textContent = `${formatNumber(totalFulfilled)} / ${formatNumber(totalRequired)} units delivered`;

  document.getElementById('kpi-low-stock').textContent = lowStockItems.length;
  document.getElementById('kpi-low-stock-sub').textContent = lowStockItems.length > 0 
    ? `${lowStockItems.map(i => i.name.split(' ')[0]).slice(0, 3).join(', ')}${lowStockItems.length > 3 ? '...' : ''}` 
    : 'All items stocked';

  document.getElementById('kpi-volunteers').textContent = deployedVolunteers;
  document.getElementById('kpi-volunteers-sub').textContent = `${totalVolunteers - deployedVolunteers} available for dispatch`;

  // Render Bar Chart by Item Category
  renderCategoryFulfilmentChart();

  // Render Critical Gaps Table:
  // "Show a Critical Gaps table of High-priority needs under 40% fulfilment, ordered by worst gap, linking back to each camp."
  renderCriticalGapsTable();
}

function renderCategoryFulfilmentChart() {
  const container = document.getElementById('category-chart-container');
  if (!container) return;

  // Aggregate fulfilment by category
  const categoryStats = {};
  state.inventory.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { category: item.category, required: 0, fulfilled: 0 };
    }
  });

  state.needs.forEach(need => {
    const item = state.inventory.find(i => i.id === need.inventory_item_id);
    const cat = item ? item.category : 'Other';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { category: cat, required: 0, fulfilled: 0 };
    }
    categoryStats[cat].required += (need.required_quantity || 0);
    categoryStats[cat].fulfilled += (need.fulfilled_quantity || 0);
  });

  const categories = Object.values(categoryStats);

  // If Chart.js is available on window, draw Canvas Chart
  if (window.Chart) {
    const canvas = document.getElementById('categoryChartCanvas');
    if (canvas) {
      if (window.activeCategoryChart) {
        window.activeCategoryChart.destroy();
      }

      const labels = categories.map(c => c.category);
      const percentages = categories.map(c => c.required > 0 ? Math.round((c.fulfilled / c.required) * 100) : 0);
      const backgroundColors = percentages.map(pct => {
        if (pct < 40) return '#ef4444';
        if (pct < 75) return '#f59e0b';
        return '#10b981';
      });

      const ctx = canvas.getContext('2d');
      window.activeCategoryChart = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Fulfilment %',
            data: percentages,
            backgroundColor: backgroundColors,
            borderRadius: 6,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { callback: v => v + '%' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (context) {
                  const cat = categories[context.dataIndex];
                  return `${context.parsed.y}% (${formatNumber(cat.fulfilled)} of ${formatNumber(cat.required)} units)`;
                }
              }
            }
          }
        }
      });
      return;
    }
  }

  // Fallback CSS Bar Chart rendering (offline / sandboxed mode)
  let html = `<div class="category-bars-list">`;
  categories.forEach(cat => {
    const pct = cat.required > 0 ? Math.round((cat.fulfilled / cat.required) * 100) : 0;
    let colorClass = 'progress-fill-green';
    if (pct < 40) colorClass = 'progress-fill-red';
    else if (pct < 75) colorClass = 'progress-fill-amber';

    html += `
      <div class="category-bar-row">
        <div class="category-bar-header">
          <span>${escapeHtml(cat.category)}</span>
          <span style="font-weight:700;">${pct}% <small style="color:#64748b; font-weight:normal;">(${formatNumber(cat.fulfilled)} / ${formatNumber(cat.required)})</small></span>
        </div>
        <div class="progress-track" style="height:12px;">
          <div class="progress-fill ${colorClass}" style="width: ${Math.min(100, pct)}%;"></div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function renderCriticalGapsTable() {
  const tbody = document.getElementById('critical-gaps-tbody');
  if (!tbody) return;

  // Milestone 5: "Show a Critical Gaps table of High-priority needs under 40% fulfilment, ordered by worst gap, linking back to each camp."
  const criticalNeeds = state.needs
    .filter(n => {
      if (n.priority !== 'High') return false;
      const pct = n.required_quantity > 0 ? (n.fulfilled_quantity / n.required_quantity) : 0;
      return pct < 0.40;
    })
    .map(n => {
      const camp = state.camps.find(c => c.id === n.camp_id) || { name: 'Unknown Camp', district: 'Unknown' };
      const item = state.inventory.find(i => i.id === n.inventory_item_id) || { name: 'Unknown Item', unit: 'units', category: 'Other', stock: 0 };
      const pct = n.required_quantity > 0 ? Math.round((n.fulfilled_quantity / n.required_quantity) * 100) : 0;
      const deficit = n.required_quantity - n.fulfilled_quantity;

      // Calculate active pending dispatches for this need
      const pendingDispatches = state.dispatches
        .filter(d => d.need_id === n.id && (d.status === 'Pending' || d.status === 'In Transit'))
        .reduce((sum, d) => sum + d.quantity, 0);

      const unreservedDeficit = deficit - pendingDispatches;

      return {
        ...n,
        camp,
        item,
        pct,
        deficit,
        unreservedDeficit,
        pendingDispatches
      };
    })
    // Order by worst gap (ascending fulfilment percentage, then largest deficit)
    .sort((a, b) => a.pct - b.pct || b.deficit - a.deficit);

  const countBadge = document.getElementById('critical-gaps-count');
  if (countBadge) countBadge.textContent = `${criticalNeeds.length} Urgent Gaps`;

  if (criticalNeeds.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #16a34a;">
          🎉 <strong>No critical gaps detected!</strong> All high-priority camp needs are currently at 40%+ fulfilment.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = criticalNeeds.map(item => `
    <tr>
      <td>
        <div style="font-weight: 700; color: #0f172a;">${escapeHtml(item.camp.name)}</div>
        <div style="font-size: 0.75rem; color: #64748b;">📍 ${escapeHtml(item.camp.district)} &bull; ${item.camp.current_families} families</div>
      </td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(item.item.name)}</div>
        <div style="font-size: 0.72rem; color: #0284c7;">Category: ${escapeHtml(item.item.category)}</div>
      </td>
      <td><span class="badge badge-high">🔥 High</span></td>
      <td>
        <div class="progress-container">
          <div class="progress-text">
            <span>${item.pct}%</span>
            <span>${item.fulfilled_quantity} / ${item.required_quantity} ${escapeHtml(item.item.unit)}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill progress-fill-red" style="width: ${item.pct}%;"></div>
          </div>
        </div>
      </td>
      <td>
        <span style="color: #dc2626; font-weight: 700;">-${item.deficit} ${escapeHtml(item.item.unit)}</span>
        ${item.pendingDispatches > 0 ? `<div style="font-size: 0.72rem; color: #d97706;">(${item.pendingDispatches} in transit)</div>` : ''}
      </td>
      <td>
        <span class="badge ${item.item.stock > 0 ? 'badge-delivered' : 'badge-cancelled'}">
          ${item.item.stock} in warehouse
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          <button class="btn btn-sm btn-primary" onclick="openDispatchModalForNeed(${item.id})">
            ⚡ Dispatch
          </button>
          <button class="btn btn-sm btn-secondary" onclick="viewCampDetails(${item.camp.id})">
            ⛺ View Camp
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Navigation Helper from Critical Gaps table back to Camp
function viewCampDetails(campId) {
  switchTab('camps');
  const searchInput = document.getElementById('search-camps');
  const camp = state.camps.find(c => c.id === campId);
  if (searchInput && camp) {
    searchInput.value = camp.name;
    state.filters.camps.search = camp.name;
    renderCampsView();
  }
}

// ==========================================
// MILESTONE 1: CAMP MANAGEMENT
// ==========================================
function renderCampsView() {
  const container = document.getElementById('camps-container');
  if (!container) return;

  const { search, district, status } = state.filters.camps;

  const filteredCamps = state.camps.filter(camp => {
    const matchesSearch = !search || 
      camp.name.toLowerCase().includes(search.toLowerCase()) || 
      camp.district.toLowerCase().includes(search.toLowerCase());
    const matchesDistrict = district === 'all' || camp.district === district;
    const matchesStatus = status === 'all' || camp.status === status;
    return matchesSearch && matchesDistrict && matchesStatus;
  });

  // Populate district dropdown options dynamically
  const districtSelect = document.getElementById('filter-camp-district');
  if (districtSelect && districtSelect.options.length <= 1) {
    const districts = [...new Set(state.camps.map(c => c.district))].sort();
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      districtSelect.appendChild(opt);
    });
  }

  if (filteredCamps.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: 10px; border: 1px dashed #cbd5e1;">
        <p style="color: #64748b; font-size: 1rem;">No relief camps match your search or filter criteria.</p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 0.75rem;" onclick="resetCampFilters()">Clear Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredCamps.map(camp => {
    // Associated volunteers
    const assignedVolunteers = state.volunteers.filter(v => v.camp_id === camp.id);
    // Associated needs
    const campNeeds = state.needs.filter(n => n.camp_id === camp.id);
    const criticalNeedsCount = campNeeds.filter(n => n.priority === 'High' && (n.fulfilled_quantity / n.required_quantity) < 0.4).length;
    
    // Capacity percentage
    const capPct = camp.capacity > 0 ? Math.min(100, Math.round((camp.current_families / camp.capacity) * 100)) : 0;

    let statusBadgeClass = 'badge-active';
    let statusBorderClass = 'status-active';
    if (camp.status === 'Full') {
      statusBadgeClass = 'badge-full';
      statusBorderClass = 'status-full';
    } else if (camp.status === 'Closed') {
      statusBadgeClass = 'badge-closed';
      statusBorderClass = 'status-closed';
    }

    return `
      <div class="camp-card ${statusBorderClass}">
        <div>
          <div class="camp-card-top">
            <div>
              <div class="camp-name">${escapeHtml(camp.name)}</div>
              <div class="camp-district">📍 District: <strong>${escapeHtml(camp.district)}</strong></div>
            </div>
            <span class="badge ${statusBadgeClass}">${escapeHtml(camp.status)}</span>
          </div>

          <div class="camp-stats-grid">
            <div class="camp-stat-item">
              <span class="camp-stat-label">Families</span>
              <span class="camp-stat-value">${camp.current_families} <small style="font-size:0.75rem; color:#64748b; font-weight:normal;">/ ${camp.capacity}</small></span>
            </div>
            <div class="camp-stat-item">
              <span class="camp-stat-label">Occupancy</span>
              <span class="camp-stat-value">${capPct}%</span>
            </div>
          </div>

          <!-- Capacity Bar -->
          <div class="progress-track" style="height: 6px; margin-bottom: 0.85rem;">
            <div class="progress-fill ${camp.status === 'Full' ? 'progress-fill-amber' : (capPct > 80 ? 'progress-fill-amber' : 'progress-fill-green')}" style="width: ${capPct}%;"></div>
          </div>

          <div style="font-size: 0.78rem; color: #475569; display: flex; justify-content: space-between;">
            <span>🤝 <strong>${assignedVolunteers.length}</strong> Volunteers</span>
            <span>📦 <strong>${campNeeds.length}</strong> Needs ${criticalNeedsCount > 0 ? `<span style="color:#ef4444; font-weight:700;">(${criticalNeedsCount} urgent)</span>` : ''}</span>
          </div>
        </div>

        <div class="camp-card-actions">
          <button class="btn btn-sm btn-secondary" onclick="viewNeedsForCamp(${camp.id})">
            Needs (${campNeeds.length})
          </button>
          <button class="btn btn-sm btn-secondary" onclick="openEditCampModal(${camp.id})">
            ✏️ Edit
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteCampPrompt(${camp.id})" ${state.currentRole !== 'Admin' ? 'disabled title="Coordinator privilege required"' : ''}>
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function resetCampFilters() {
  state.filters.camps = { search: '', district: 'all', status: 'all' };
  const searchInput = document.getElementById('search-camps');
  if (searchInput) searchInput.value = '';
  const distSelect = document.getElementById('filter-camp-district');
  if (distSelect) distSelect.value = 'all';
  const statusSelect = document.getElementById('filter-camp-status');
  if (statusSelect) statusSelect.value = 'all';
  renderCampsView();
}

function viewNeedsForCamp(campId) {
  switchTab('needs');
  const campFilter = document.getElementById('filter-need-camp');
  if (campFilter) {
    campFilter.value = String(campId);
    state.filters.needs.campId = String(campId);
    renderNeedsAndWarehouseView();
  }
}

// Camp CRUD Modals & Handlers
function openAddCampModal() {
  if (!requireAdmin('Adding a new camp')) return;
  document.getElementById('camp-modal-title').textContent = '➕ Register New Relief Camp';
  document.getElementById('camp-id-input').value = '';
  document.getElementById('camp-name-input').value = '';
  document.getElementById('camp-district-input').value = '';
  document.getElementById('camp-capacity-input').value = '200';
  document.getElementById('camp-families-input').value = '0';
  document.getElementById('camp-status-input').value = 'Active';
  checkCampCapacityRule();
  openModal('modal-camp');
}

function openEditCampModal(campId) {
  if (!requireAdmin('Editing camp details')) return;
  const camp = state.camps.find(c => c.id === campId);
  if (!camp) return;

  document.getElementById('camp-modal-title').textContent = '✏️ Edit Relief Camp';
  document.getElementById('camp-id-input').value = camp.id;
  document.getElementById('camp-name-input').value = camp.name;
  document.getElementById('camp-district-input').value = camp.district;
  document.getElementById('camp-capacity-input').value = camp.capacity;
  document.getElementById('camp-families-input').value = camp.current_families;
  document.getElementById('camp-status-input').value = camp.status;
  checkCampCapacityRule();
  openModal('modal-camp');
}

function checkCampCapacityRule() {
  const cap = parseInt(document.getElementById('camp-capacity-input').value, 10) || 0;
  const fam = parseInt(document.getElementById('camp-families-input').value, 10) || 0;
  const statusSelect = document.getElementById('camp-status-input');
  const alertBox = document.getElementById('camp-capacity-alert');

  if (fam >= cap && cap > 0) {
    alertBox.style.display = 'block';
    alertBox.innerHTML = `⚠️ <strong>Auto-Full Rule Active:</strong> Current families (${fam}) reach capacity (${cap}). Status will automatically be set to <strong>Full</strong> upon saving.`;
    if (statusSelect.value !== 'Closed') {
      statusSelect.value = 'Full';
    }
  } else {
    alertBox.style.display = 'none';
    if (statusSelect.value === 'Full' && fam < cap) {
      statusSelect.value = 'Active';
    }
  }
}

async function saveCampForm(e) {
  e.preventDefault();
  const id = document.getElementById('camp-id-input').value;
  const name = document.getElementById('camp-name-input').value.trim();
  const district = document.getElementById('camp-district-input').value.trim();
  const capacity = parseInt(document.getElementById('camp-capacity-input').value, 10);
  const current_families = parseInt(document.getElementById('camp-families-input').value, 10);
  let status = document.getElementById('camp-status-input').value;

  if (!name || !district) {
    showToast('Camp name and district are required.', 'warning');
    return;
  }
  if (isNaN(capacity) || capacity <= 0) {
    showToast('Capacity must be a positive number.', 'warning');
    return;
  }
  if (isNaN(current_families) || current_families < 0) {
    showToast('Current families must be >= 0.', 'warning');
    return;
  }

  // Automatic "Full" rule
  if (current_families >= capacity && status !== 'Closed') {
    status = 'Full';
  }

  const payload = { name, district, capacity, current_families, status };

  try {
    if (id) {
      const updated = await apiRequest(`/camps/${id}`, 'PUT', payload);
      const idx = state.camps.findIndex(c => c.id === parseInt(id, 10));
      if (idx !== -1) state.camps[idx] = updated;
      showToast(`Camp "${updated.name}" updated successfully!`, 'success');
    } else {
      const created = await apiRequest('/camps', 'POST', payload);
      state.camps.push(created);
      showToast(`Camp "${created.name}" registered successfully!`, 'success');
    }
    closeModal('modal-camp');
    renderCurrentView();
    updateHeaderCounts();
  } catch (err) {
    // Handled in apiRequest
  }
}

async function deleteCampPrompt(campId) {
  if (!requireAdmin('Deleting a camp')) return;
  const camp = state.camps.find(c => c.id === campId);
  if (!camp) return;

  if (confirm(`Are you sure you want to delete camp "${camp.name}"? This will unassign any volunteers and remove its needs.`)) {
    try {
      await apiRequest(`/camps/${campId}`, 'DELETE');
      state.camps = state.camps.filter(c => c.id !== campId);
      // unassign volunteers locally
      state.volunteers.forEach(v => {
        if (v.camp_id === campId) v.camp_id = null;
      });
      state.needs = state.needs.filter(n => n.camp_id !== campId);
      state.dispatches = state.dispatches.filter(d => d.camp_id !== campId);
      showToast(`Camp "${camp.name}" deleted.`, 'success');
      renderCurrentView();
      updateHeaderCounts();
    } catch (err) {
      // Handled
    }
  }
}

// ==========================================
// MILESTONE 2: CAMP NEEDS & WAREHOUSE
// ==========================================
function renderNeedsAndWarehouseView() {
  // Render Camp Needs Table
  renderNeedsTable();
  // Render Warehouse Inventory Table
  renderWarehouseTable();
}

function renderNeedsTable() {
  const tbody = document.getElementById('needs-table-tbody');
  if (!tbody) return;

  const { campId, priority, status } = state.filters.needs;

  // Populate Camp Filter dropdown if not done
  const campSelect = document.getElementById('filter-need-camp');
  if (campSelect && campSelect.options.length <= 1) {
    state.camps.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.district})`;
      campSelect.appendChild(opt);
    });
  }

  const filteredNeeds = state.needs.filter(need => {
    const matchesCamp = campId === 'all' || need.camp_id === parseInt(campId, 10);
    const matchesPriority = priority === 'all' || need.priority === priority;
    
    const pct = need.required_quantity > 0 ? (need.fulfilled_quantity / need.required_quantity) : 0;
    let matchesStatus = true;
    if (status === 'critical') matchesStatus = (pct < 0.40 && need.priority === 'High');
    else if (status === 'progress') matchesStatus = (pct > 0 && pct < 1);
    else if (status === 'fulfilled') matchesStatus = (pct >= 1);

    return matchesCamp && matchesPriority && matchesStatus;
  });

  if (filteredNeeds.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
          No camp needs found matching current filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredNeeds.map(need => {
    const camp = state.camps.find(c => c.id === need.camp_id) || { name: 'Unknown', district: 'Unknown' };
    const item = state.inventory.find(i => i.id === need.inventory_item_id) || { name: 'Unknown Item', unit: 'units', category: 'Other', stock: 0 };
    const pct = need.required_quantity > 0 ? Math.round((need.fulfilled_quantity / need.required_quantity) * 100) : 0;
    
    let priorityBadge = 'badge-low';
    if (need.priority === 'High') priorityBadge = 'badge-high';
    else if (need.priority === 'Medium') priorityBadge = 'badge-medium';

    let progressFill = 'progress-fill-green';
    if (pct < 40) progressFill = 'progress-fill-red';
    else if (pct < 75) progressFill = 'progress-fill-amber';

    // Calculate active pending dispatches
    const activeDispatches = state.dispatches.filter(d => 
      d.need_id === need.id && (d.status === 'Pending' || d.status === 'In Transit')
    );
    const reservedSum = activeDispatches.reduce((acc, d) => acc + d.quantity, 0);

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(camp.name)}</div>
          <div style="font-size: 0.72rem; color: #64748b;">📍 ${escapeHtml(camp.district)}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.name)}</div>
          <span style="font-size: 0.72rem; color: #0369a1; background: #e0f2fe; padding: 0.1rem 0.4rem; border-radius: 4px;">
            ${escapeHtml(item.category)}
          </span>
        </td>
        <td><span class="badge ${priorityBadge}">${need.priority}</span></td>
        <td>
          <div class="progress-container">
            <div class="progress-text">
              <span>${pct}% Fulfilled</span>
              <span>${need.fulfilled_quantity} / ${need.required_quantity} ${escapeHtml(item.unit)}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${progressFill}" style="width: ${Math.min(100, pct)}%;"></div>
            </div>
            ${reservedSum > 0 ? `<div style="font-size: 0.7rem; color: #0284c7; margin-top: 2px;">🚚 ${reservedSum} ${escapeHtml(item.unit)} reserved in transit/pending</div>` : ''}
          </div>
        </td>
        <td>
          <span style="font-weight: 600; color: ${item.stock <= item.reorder_level ? '#dc2626' : '#15803d'};">
            ${item.stock} ${escapeHtml(item.unit)}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-primary" onclick="openDispatchModalForNeed(${need.id})">
              ⚡ Dispatch
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openEditNeedModal(${need.id})">
              ✏️
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteNeedPrompt(${need.id})" ${state.currentRole !== 'Admin' ? 'disabled title="Coordinator privilege required"' : ''}>
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderWarehouseTable() {
  const tbody = document.getElementById('inventory-table-tbody');
  if (!tbody) return;

  const { category, lowStockOnly } = state.filters.inventory;

  const filteredItems = state.inventory.filter(item => {
    const matchesCat = category === 'all' || item.category === category;
    const isLow = (item.stock || 0) <= (item.reorder_level || 0);
    const matchesLow = !lowStockOnly || isLow;
    return matchesCat && matchesLow;
  });

  if (filteredItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">
          No inventory items found matching filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredItems.map(item => {
    const isLowStock = (item.stock || 0) <= (item.reorder_level || 0);
    return `
      <tr style="${isLowStock ? 'background-color: #fef2f2;' : ''}">
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(item.name)}</div>
        </td>
        <td>
          <span style="font-size: 0.78rem; font-weight: 600; color: #334155; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 6px;">
            ${escapeHtml(item.category)}
          </span>
        </td>
        <td style="font-weight: 600; color: #475569;">${escapeHtml(item.unit)}</td>
        <td>
          <span style="font-size: 1.1rem; font-weight: 800; color: ${isLowStock ? '#dc2626' : '#0f172a'};">
            ${formatNumber(item.stock)}
          </span>
        </td>
        <td style="color: #64748b; font-weight: 600;">
          ${formatNumber(item.reorder_level)}
        </td>
        <td>
          ${isLowStock ? `<span class="badge badge-low-stock">⚠️ Low Stock</span>` : `<span class="badge badge-delivered">Adequate</span>`}
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-secondary" onclick="openReceiveStockModal(${item.id})">
              + Stock
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openEditInventoryModal(${item.id})">
              ✏️
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteInventoryPrompt(${item.id})" ${state.currentRole !== 'Admin' ? 'disabled title="Coordinator privilege required"' : ''}>
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Needs CRUD Handlers
function openAddNeedModal() {
  document.getElementById('need-modal-title').textContent = '➕ Add Camp Supply Demand';
  document.getElementById('need-id-input').value = '';
  document.getElementById('need-camp-input').innerHTML = state.camps
    .filter(c => c.status !== 'Closed')
    .map(c => `<option value="${c.id}">${c.name} (${c.district})</option>`).join('');

  document.getElementById('need-item-input').innerHTML = state.inventory
    .map(i => `<option value="${i.id}">${i.name} [Stock: ${i.stock} ${i.unit}]</option>`).join('');

  document.getElementById('need-qty-input').value = '100';
  document.getElementById('need-priority-input').value = 'High';
  document.getElementById('need-fulfilled-input').value = '0';
  openModal('modal-need');
}

function openEditNeedModal(needId) {
  const need = state.needs.find(n => n.id === needId);
  if (!need) return;

  document.getElementById('need-modal-title').textContent = '✏️ Edit Camp Supply Demand';
  document.getElementById('need-id-input').value = need.id;
  document.getElementById('need-camp-input').innerHTML = state.camps
    .map(c => `<option value="${c.id}" ${c.id === need.camp_id ? 'selected' : ''}>${c.name} (${c.district})</option>`).join('');

  document.getElementById('need-item-input').innerHTML = state.inventory
    .map(i => `<option value="${i.id}" ${i.id === need.inventory_item_id ? 'selected' : ''}>${i.name} [Stock: ${i.stock} ${i.unit}]</option>`).join('');

  document.getElementById('need-qty-input').value = need.required_quantity;
  document.getElementById('need-priority-input').value = need.priority;
  document.getElementById('need-fulfilled-input').value = need.fulfilled_quantity;
  openModal('modal-need');
}

async function saveNeedForm(e) {
  e.preventDefault();
  const id = document.getElementById('need-id-input').value;
  const camp_id = parseInt(document.getElementById('need-camp-input').value, 10);
  const inventory_item_id = parseInt(document.getElementById('need-item-input').value, 10);
  const required_quantity = parseInt(document.getElementById('need-qty-input').value, 10);
  const priority = document.getElementById('need-priority-input').value;
  const fulfilled_quantity = parseInt(document.getElementById('need-fulfilled-input').value, 10) || 0;

  if (isNaN(required_quantity) || required_quantity <= 0) {
    showToast('Required quantity must be a positive number.', 'warning');
    return;
  }

  const payload = { camp_id, inventory_item_id, required_quantity, priority, fulfilled_quantity };

  try {
    if (id) {
      const updated = await apiRequest(`/needs/${id}`, 'PUT', payload);
      const idx = state.needs.findIndex(n => n.id === parseInt(id, 10));
      if (idx !== -1) state.needs[idx] = updated;
      showToast('Need updated successfully!', 'success');
    } else {
      const created = await apiRequest('/needs', 'POST', payload);
      state.needs.push(created);
      showToast('New camp need registered!', 'success');
    }
    closeModal('modal-need');
    renderCurrentView();
    updateHeaderCounts();
  } catch (err) {
    // Handled
  }
}

async function deleteNeedPrompt(needId) {
  if (!requireAdmin('Removing a need')) return;
  if (confirm('Are you sure you want to remove this need entry?')) {
    try {
      await apiRequest(`/needs/${needId}`, 'DELETE');
      state.needs = state.needs.filter(n => n.id !== needId);
      showToast('Need removed.', 'success');
      renderCurrentView();
      updateHeaderCounts();
    } catch (err) {}
  }
}

// Inventory CRUD Handlers
function openAddInventoryModal() {
  if (!requireAdmin('Adding new inventory items')) return;
  document.getElementById('inv-modal-title').textContent = '➕ Add Warehouse Inventory Item';
  document.getElementById('inv-id-input').value = '';
  document.getElementById('inv-name-input').value = '';
  document.getElementById('inv-category-input').value = 'Food';
  document.getElementById('inv-unit-input').value = 'bag';
  document.getElementById('inv-stock-input').value = '100';
  document.getElementById('inv-reorder-input').value = '30';
  openModal('modal-inventory');
}

function openEditInventoryModal(itemId) {
  if (!requireAdmin('Editing inventory items')) return;
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('inv-modal-title').textContent = '✏️ Edit Inventory Item';
  document.getElementById('inv-id-input').value = item.id;
  document.getElementById('inv-name-input').value = item.name;
  document.getElementById('inv-category-input').value = item.category;
  document.getElementById('inv-unit-input').value = item.unit;
  document.getElementById('inv-stock-input').value = item.stock;
  document.getElementById('inv-reorder-input').value = item.reorder_level;
  openModal('modal-inventory');
}

function openReceiveStockModal(itemId) {
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;
  // Open donation modal pre-selected as In-Kind for this item
  switchTab('donations');
  openAddDonationModal();
  document.getElementById('donation-type-input').value = 'In-Kind';
  toggleDonationFields();
  document.getElementById('donation-item-input').value = item.id;
}

async function saveInventoryForm(e) {
  e.preventDefault();
  const id = document.getElementById('inv-id-input').value;
  const name = document.getElementById('inv-name-input').value.trim();
  const category = document.getElementById('inv-category-input').value.trim();
  const unit = document.getElementById('inv-unit-input').value.trim();
  const stock = parseInt(document.getElementById('inv-stock-input').value, 10);
  const reorder_level = parseInt(document.getElementById('inv-reorder-input').value, 10);

  if (!name || !unit) {
    showToast('Name and unit are required.', 'warning');
    return;
  }
  if (isNaN(stock) || stock < 0 || isNaN(reorder_level) || reorder_level < 0) {
    showToast('Stock and reorder level must be positive integers.', 'warning');
    return;
  }

  const payload = { name, category, unit, stock, reorder_level };

  try {
    if (id) {
      const updated = await apiRequest(`/inventory/${id}`, 'PUT', payload);
      const idx = state.inventory.findIndex(i => i.id === parseInt(id, 10));
      if (idx !== -1) state.inventory[idx] = updated;
      showToast(`Item "${updated.name}" updated!`, 'success');
    } else {
      const created = await apiRequest('/inventory', 'POST', payload);
      state.inventory.push(created);
      showToast(`Item "${created.name}" created!`, 'success');
    }
    closeModal('modal-inventory');
    renderCurrentView();
  } catch (err) {}
}

async function deleteInventoryPrompt(itemId) {
  if (!requireAdmin('Deleting inventory items')) return;
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;

  if (confirm(`Delete "${item.name}" from inventory?`)) {
    try {
      await apiRequest(`/inventory/${itemId}`, 'DELETE');
      state.inventory = state.inventory.filter(i => i.id !== itemId);
      showToast(`Item "${item.name}" deleted.`, 'success');
      renderCurrentView();
    } catch (err) {}
  }
}

// ==========================================
// MILESTONE 3: DISPATCHES & STOCK RESERVATIONS
// ==========================================
function renderDispatchesView() {
  const tbody = document.getElementById('dispatches-table-tbody');
  if (!tbody) return;

  const { status, search } = state.filters.dispatches;

  const filteredDispatches = state.dispatches.filter(d => {
    const matchesStatus = status === 'all' || d.status === status;
    const camp = state.camps.find(c => c.id === d.camp_id);
    const need = state.needs.find(n => n.id === d.need_id);
    const item = need ? state.inventory.find(i => i.id === need.inventory_item_id) : null;
    
    const campName = camp ? camp.name.toLowerCase() : '';
    const itemName = item ? item.name.toLowerCase() : '';
    const matchesSearch = !search || campName.includes(search.toLowerCase()) || itemName.includes(search.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  if (filteredDispatches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">
          No dispatches found matching filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredDispatches.map(d => {
    const camp = state.camps.find(c => c.id === d.camp_id) || { name: 'Unknown Camp', district: 'Unknown' };
    const need = state.needs.find(n => n.id === d.need_id);
    const item = need ? state.inventory.find(i => i.id === need.inventory_item_id) : { name: 'Supplies', unit: 'units' };

    let statusBadge = 'badge-pending';
    if (d.status === 'In Transit') statusBadge = 'badge-in-transit';
    else if (d.status === 'Delivered') statusBadge = 'badge-delivered';
    else if (d.status === 'Cancelled') statusBadge = 'badge-cancelled';

    return `
      <tr>
        <td style="font-weight: 700; color: #475569;">#DSP-${d.id}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(camp.name)}</div>
          <div style="font-size: 0.72rem; color: #64748b;">📍 ${escapeHtml(camp.district)}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.name)}</div>
          <div style="font-size: 0.72rem; color: #64748b;">Need ID #${d.need_id}</div>
        </td>
        <td>
          <span style="font-size: 1.05rem; font-weight: 800; color: #0f172a;">
            ${formatNumber(d.quantity)}
          </span>
          <span style="font-size: 0.75rem; color: #64748b;"> ${escapeHtml(item.unit)}</span>
        </td>
        <td>
          <span class="badge ${statusBadge}">${d.status}</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            ${d.status === 'Pending' ? `
              <button class="btn btn-sm btn-primary" onclick="updateDispatchStatus(${d.id}, 'In Transit')">
                🚚 Mark In Transit
              </button>
              <button class="btn btn-sm btn-success" onclick="updateDispatchStatus(${d.id}, 'Delivered')">
                ✅ Mark Delivered
              </button>
              <button class="btn btn-sm btn-danger" onclick="updateDispatchStatus(${d.id}, 'Cancelled')">
                ❌ Cancel
              </button>
            ` : ''}

            ${d.status === 'In Transit' ? `
              <button class="btn btn-sm btn-success" onclick="updateDispatchStatus(${d.id}, 'Delivered')">
                ✅ Mark Delivered
              </button>
              <button class="btn btn-sm btn-danger" onclick="updateDispatchStatus(${d.id}, 'Cancelled')">
                ❌ Cancel
              </button>
            ` : ''}

            ${d.status === 'Delivered' ? `
              <span style="font-size: 0.75rem; color: #16a34a; font-weight: 600;">Fulfilment Recorded</span>
            ` : ''}

            ${d.status === 'Cancelled' ? `
              <span style="font-size: 0.75rem; color: #b91c1c; font-weight: 600;">Stock Restored</span>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Milestone 3: Dispatch Status Transitions
async function updateDispatchStatus(dispatchId, newStatus) {
  if (!requireAdmin('Updating dispatch status')) return;
  const dispatch = state.dispatches.find(d => d.id === dispatchId);
  if (!dispatch) return;

  if (newStatus === 'Cancelled') {
    if (!confirm(`Are you sure you want to cancel dispatch #DSP-${dispatchId}? This will immediately RESTORE ${dispatch.quantity} unit(s) back to warehouse inventory.`)) {
      return;
    }
  }

  try {
    const updated = await apiRequest(`/dispatches/${dispatchId}`, 'PUT', { status: newStatus });
    dispatch.status = updated.status;
    showToast(`Dispatch #DSP-${dispatchId} marked as ${newStatus}!`, 'success');
    
    // Reload database state to reflect updated need fulfilment or restored inventory stock
    await loadAllData();
  } catch (err) {}
}

// Dispatch Creation Modal with Live Milestone 3 Constraints
function openNewDispatchModal() {
  if (!requireAdmin('Creating a dispatch')) return;
  document.getElementById('dispatch-camp-select').innerHTML = `
    <option value="">-- Choose Relief Camp --</option>
    ${state.camps.filter(c => c.status !== 'Closed').map(c => `<option value="${c.id}">${c.name} (${c.district})</option>`).join('')}
  `;
  document.getElementById('dispatch-need-select').innerHTML = `<option value="">-- Select Camp First --</option>`;
  document.getElementById('dispatch-qty-input').value = '';
  document.getElementById('dispatch-rule-feedback').innerHTML = '';
  document.getElementById('btn-confirm-dispatch').disabled = true;
  openModal('modal-dispatch');
}

function openDispatchModalForNeed(needId) {
  if (!requireAdmin('Creating a dispatch')) return;
  const need = state.needs.find(n => n.id === needId);
  if (!need) return;

  openNewDispatchModal();
  document.getElementById('dispatch-camp-select').value = need.camp_id;
  onDispatchCampChange(needId);
}

function onDispatchCampChange(preselectedNeedId = null) {
  const campId = parseInt(document.getElementById('dispatch-camp-select').value, 10);
  const needSelect = document.getElementById('dispatch-need-select');
  const feedback = document.getElementById('dispatch-rule-feedback');
  feedback.innerHTML = '';

  if (!campId) {
    needSelect.innerHTML = `<option value="">-- Select Camp First --</option>`;
    return;
  }

  const campNeeds = state.needs.filter(n => n.camp_id === campId);
  if (campNeeds.length === 0) {
    needSelect.innerHTML = `<option value="">-- No Needs Recorded for this Camp --</option>`;
    return;
  }

  needSelect.innerHTML = `
    <option value="">-- Choose Supply Need --</option>
    ${campNeeds.map(n => {
      const item = state.inventory.find(i => i.id === n.inventory_item_id) || { name: 'Item', unit: 'units' };
      const selected = (preselectedNeedId && n.id === preselectedNeedId) ? 'selected' : '';
      return `<option value="${n.id}" ${selected}>${item.name} (${n.priority} priority - Needs ${n.required_quantity - n.fulfilled_quantity} ${item.unit})</option>`;
    }).join('')}
  `;

  if (preselectedNeedId) {
    onDispatchNeedChange();
  }
}

function onDispatchNeedChange() {
  const needId = parseInt(document.getElementById('dispatch-need-select').value, 10);
  const feedback = document.getElementById('dispatch-rule-feedback');
  const qtyInput = document.getElementById('dispatch-qty-input');
  const btn = document.getElementById('btn-confirm-dispatch');

  if (!needId) {
    feedback.innerHTML = '';
    btn.disabled = true;
    return;
  }

  const need = state.needs.find(n => n.id === needId);
  if (!need) return;

  const item = state.inventory.find(i => i.id === need.inventory_item_id);
  if (!item) return;

  // Milestone 3 calculations:
  // 1. Available warehouse stock
  const availableStock = item.stock || 0;

  // 2. Remaining unreserved quantity: required - fulfilled - other Pending/In Transit dispatches
  const activeDispatches = state.dispatches.filter(d => 
    d.need_id === need.id && (d.status === 'Pending' || d.status === 'In Transit')
  );
  const pendingQty = activeDispatches.reduce((acc, d) => acc + d.quantity, 0);
  const remainingUnreserved = Math.max(0, need.required_quantity - need.fulfilled_quantity - pendingQty);

  // Maximum allowed
  const maxDispatchable = Math.min(availableStock, remainingUnreserved);

  // Default suggested quantity
  qtyInput.value = maxDispatchable > 0 ? Math.min(maxDispatchable, 50) : 0;
  qtyInput.max = maxDispatchable;

  validateDispatchQuantity();
}

function validateDispatchQuantity() {
  const needId = parseInt(document.getElementById('dispatch-need-select').value, 10);
  const qtyInput = document.getElementById('dispatch-qty-input');
  const qty = parseInt(qtyInput.value, 10);
  const feedback = document.getElementById('dispatch-rule-feedback');
  const btn = document.getElementById('btn-confirm-dispatch');

  if (!needId || isNaN(qty) || qty <= 0) {
    btn.disabled = true;
    return;
  }

  const need = state.needs.find(n => n.id === needId);
  const item = state.inventory.find(i => i.id === need.inventory_item_id);

  const availableStock = item.stock || 0;
  const activeDispatches = state.dispatches.filter(d => 
    d.need_id === need.id && (d.status === 'Pending' || d.status === 'In Transit')
  );
  const pendingQty = activeDispatches.reduce((acc, d) => acc + d.quantity, 0);
  const remainingUnreserved = Math.max(0, need.required_quantity - need.fulfilled_quantity - pendingQty);

  if (qty > availableStock) {
    feedback.innerHTML = `
      <div class="form-alert form-alert-danger">
        ❌ <strong>Stock Violation:</strong> Cannot dispatch ${qty} ${item.unit}(s). Available warehouse stock is only ${availableStock} ${item.unit}(s).
      </div>
    `;
    btn.disabled = true;
    return;
  }

  if (qty > remainingUnreserved) {
    feedback.innerHTML = `
      <div class="form-alert form-alert-danger">
        ❌ <strong>Over-allocation Violation:</strong> Quantity exceeds remaining unreserved demand (${remainingUnreserved} ${item.unit}(s)).
        <div style="font-size:0.72rem; margin-top:2px;">(Required: ${need.required_quantity}, Fulfilled: ${need.fulfilled_quantity}, In Transit: ${pendingQty})</div>
      </div>
    `;
    btn.disabled = true;
    return;
  }

  // All valid!
  feedback.innerHTML = `
    <div class="form-alert form-alert-info">
      ✅ <strong>Allocation Valid:</strong> Stock is available (${availableStock} ${item.unit}(s)) and unreserved need is met (${remainingUnreserved} ${item.unit}(s) unreserved).
      <div style="font-size:0.72rem; margin-top:2px;">${qty} ${item.unit}(s) will be reserved immediately upon confirmation.</div>
    </div>
  `;
  btn.disabled = false;
}

async function createDispatchForm(e) {
  e.preventDefault();
  const camp_id = parseInt(document.getElementById('dispatch-camp-select').value, 10);
  const need_id = parseInt(document.getElementById('dispatch-need-select').value, 10);
  const quantity = parseInt(document.getElementById('dispatch-qty-input').value, 10);
  const initialStatus = document.getElementById('dispatch-status-select').value;

  try {
    const created = await apiRequest('/dispatches', 'POST', {
      camp_id,
      need_id,
      quantity,
      status: initialStatus
    });

    showToast(`Dispatch #DSP-${created.id} created and supplies reserved!`, 'success');
    closeModal('modal-dispatch');
    await loadAllData();
  } catch (err) {}
}

// ==========================================
// MILESTONE 4: DONATIONS & VOLUNTEERS
// ==========================================
function renderDonationsAndVolunteersView() {
  renderDonationsSection();
  renderVolunteersSection();
}

function renderDonationsSection() {
  const tbody = document.getElementById('donations-table-tbody');
  if (!tbody) return;

  // 1. Calculate Cash totals
  const cashDonations = state.donations.filter(d => d.type === 'Cash');
  const totalCash = cashDonations.reduce((sum, d) => sum + (d.amount_or_quantity || 0), 0);

  // Totals per donation category (Milestone 4: "Show total cash received and totals per donation category")
  const categoryTotals = {};
  state.donations.forEach(d => {
    const cat = d.category || 'General';
    if (!categoryTotals[cat]) categoryTotals[cat] = { cash: 0, items: 0 };
    if (d.type === 'Cash') categoryTotals[cat].cash += d.amount_or_quantity;
    else categoryTotals[cat].items += d.amount_or_quantity;
  });

  const inKindDonations = state.donations.filter(d => d.type === 'In-Kind');
  const totalInKindCount = inKindDonations.reduce((sum, d) => sum + (d.amount_or_quantity || 0), 0);

  document.getElementById('stat-total-cash').textContent = formatCurrency(totalCash);
  document.getElementById('stat-total-inkind').textContent = `${formatNumber(totalInKindCount)} items`;

  // Render Category Breakdown Pills
  const catContainer = document.getElementById('donation-category-breakdown');
  if (catContainer) {
    catContainer.innerHTML = Object.entries(categoryTotals).map(([cat, vals]) => `
      <div class="donation-stat-box">
        <div class="donation-stat-val" style="font-size: 1.1rem; color: #0284c7;">${formatCurrency(vals.cash)}</div>
        <div class="donation-stat-sub">${escapeHtml(cat)} Funds</div>
        ${vals.items > 0 ? `<div style="font-size:0.7rem; color:#16a34a; font-weight:600;">+ ${formatNumber(vals.items)} units in-kind</div>` : ''}
      </div>
    `).join('');
  }

  // Filter Table
  const { type, category } = state.filters.donations;
  const filteredDonations = state.donations.filter(d => {
    const matchesType = type === 'all' || d.type === type;
    const matchesCategory = category === 'all' || d.category === category;
    return matchesType && matchesCategory;
  });

  tbody.innerHTML = filteredDonations.map(d => {
    const item = d.item_id ? state.inventory.find(i => i.id === d.item_id) : null;
    return `
      <tr>
        <td style="font-weight: 700; color: #64748b;">#DON-${d.id}</td>
        <td>
          <span class="badge ${d.type === 'Cash' ? 'badge-delivered' : 'badge-in-transit'}">
            ${d.type === 'Cash' ? '💵 Cash' : '📦 In-Kind'}
          </span>
        </td>
        <td>
          ${d.type === 'Cash' 
            ? `<span style="font-size: 1.05rem; font-weight: 800; color: #16a34a;">${formatCurrency(d.amount_or_quantity)}</span>` 
            : `<span style="font-size: 1.05rem; font-weight: 800; color: #0284c7;">${formatNumber(d.amount_or_quantity)} ${item ? escapeHtml(item.unit) : 'units'}</span>
               <div style="font-size:0.72rem; color:#64748b;">${item ? escapeHtml(item.name) : 'Supplies'}</div>`
          }
        </td>
        <td>
          <span style="font-weight: 600; color: #334155; background: #f1f5f9; padding: 0.15rem 0.5rem; border-radius: 4px;">
            ${escapeHtml(d.category)}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderVolunteersSection() {
  const tbody = document.getElementById('volunteers-table-tbody');
  if (!tbody) return;

  const { skill, assignment, search } = state.filters.volunteers;

  const filteredVolunteers = state.volunteers.filter(v => {
    const matchesSkill = skill === 'all' || v.skill === skill;
    const isAssigned = v.camp_id !== null;
    let matchesAssignment = true;
    if (assignment === 'assigned') matchesAssignment = isAssigned;
    else if (assignment === 'unassigned') matchesAssignment = !isAssigned;

    const matchesSearch = !search || v.name.toLowerCase().includes(search.toLowerCase());
    return matchesSkill && matchesAssignment && matchesSearch;
  });

  if (filteredVolunteers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
          No volunteers found matching filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredVolunteers.map(v => {
    const camp = v.camp_id ? state.camps.find(c => c.id === v.camp_id) : null;
    
    // Skill color
    let skillColor = '#2563eb';
    let skillIcon = '🛠️';
    if (v.skill === 'Medical') { skillColor = '#dc2626'; skillIcon = '🩺'; }
    else if (v.skill === 'Logistics') { skillColor = '#0284c7'; skillIcon = '📦'; }
    else if (v.skill === 'Cooking') { skillColor = '#d97706'; skillIcon = '🍲'; }
    else if (v.skill === 'Driving') { skillColor = '#16a34a'; skillIcon = '🚐'; }
    else if (v.skill === 'Counselling') { skillColor = '#9333ea'; skillIcon = '💬'; }

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(v.name)}</div>
        </td>
        <td>
          <span style="font-size: 0.78rem; font-weight: 700; color: ${skillColor}; background: #eff6ff; padding: 0.2rem 0.6rem; border-radius: 9999px;">
            ${skillIcon} ${v.skill}
          </span>
        </td>
        <td>
          ${camp ? `
            <div>
              <strong>${escapeHtml(camp.name)}</strong>
              <div style="font-size: 0.72rem; color: #64748b;">📍 ${escapeHtml(camp.district)}</div>
            </div>
          ` : `
            <span class="badge badge-low">Unassigned (Standby)</span>
          `}
        </td>
        <td>
          ${camp ? `
            <span class="badge ${camp.status === 'Full' ? 'badge-full' : (camp.status === 'Closed' ? 'badge-closed' : 'badge-active')}">
              ${camp.status}
            </span>
          ` : '—'}
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-secondary" onclick="openAssignVolunteerModal(${v.id})">
              ${v.camp_id ? '🔄 Reassign' : '📍 Assign Camp'}
            </button>
            ${v.camp_id ? `
              <button class="btn btn-sm btn-danger" onclick="unassignVolunteer(${v.id})">
                Unassign
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Donation Modal & Form Handlers
function openAddDonationModal() {
  document.getElementById('donation-type-input').value = 'Cash';
  document.getElementById('donation-amount-input').value = '50000';
  document.getElementById('donation-category-input').value = 'Food';
  toggleDonationFields();

  // Populate item dropdown for in-kind
  document.getElementById('donation-item-input').innerHTML = state.inventory.map(i => `
    <option value="${i.id}">${i.name} (${i.category}) [Current Stock: ${i.stock} ${i.unit}]</option>
  `).join('');

  openModal('modal-donation');
}

function toggleDonationFields() {
  const type = document.getElementById('donation-type-input').value;
  const inKindGroup = document.getElementById('group-inkind-item');
  const amountLabel = document.getElementById('label-donation-amount');
  const noticeBox = document.getElementById('inkind-stock-notice');

  if (type === 'In-Kind') {
    inKindGroup.style.display = 'block';
    amountLabel.textContent = 'Quantity Donated:';
    noticeBox.style.display = 'block';
  } else {
    inKindGroup.style.display = 'none';
    amountLabel.textContent = 'Amount (PKR):';
    noticeBox.style.display = 'none';
  }
}

async function saveDonationForm(e) {
  e.preventDefault();
  const type = document.getElementById('donation-type-input').value;
  const amount_or_quantity = parseFloat(document.getElementById('donation-amount-input').value);
  const item_id = type === 'In-Kind' ? parseInt(document.getElementById('donation-item-input').value, 10) : null;
  const category = document.getElementById('donation-category-input').value;

  if (isNaN(amount_or_quantity) || amount_or_quantity <= 0) {
    showToast('Please enter a valid amount or quantity greater than zero.', 'warning');
    return;
  }

  try {
    const created = await apiRequest('/donations', 'POST', {
      type,
      amount_or_quantity,
      item_id,
      category
    });

    showToast(`Donation recorded! ${type === 'In-Kind' ? 'Warehouse stock increased.' : ''}`, 'success');
    closeModal('modal-donation');
    await loadAllData();
  } catch (err) {}
}

// Volunteer Registration & Assignment
function openAddVolunteerModal() {
  document.getElementById('vol-name-input').value = '';
  document.getElementById('vol-skill-input').value = 'Medical';
  
  // Rule: Cannot be assigned to a Closed camp!
  const campSelect = document.getElementById('vol-camp-input');
  campSelect.innerHTML = `
    <option value="">-- Leave Unassigned (Standby) --</option>
    ${state.camps
      .filter(c => c.status !== 'Closed') // Exclude Closed camps
      .map(c => `<option value="${c.id}">${c.name} (${c.district}) - ${c.status}</option>`).join('')}
  `;

  openModal('modal-volunteer');
}

async function saveVolunteerForm(e) {
  e.preventDefault();
  const name = document.getElementById('vol-name-input').value.trim();
  const skill = document.getElementById('vol-skill-input').value;
  const campVal = document.getElementById('vol-camp-input').value;
  const camp_id = campVal ? parseInt(campVal, 10) : null;

  if (!name) {
    showToast('Volunteer name is required.', 'warning');
    return;
  }

  try {
    const created = await apiRequest('/volunteers', 'POST', { name, skill, camp_id });
    state.volunteers.push(created);
    showToast(`Volunteer "${created.name}" registered successfully!`, 'success');
    closeModal('modal-volunteer');
    renderCurrentView();
    updateHeaderCounts();
  } catch (err) {}
}

function openAssignVolunteerModal(volunteerId) {
  const v = state.volunteers.find(x => x.id === volunteerId);
  if (!v) return;

  document.getElementById('assign-vol-id').value = v.id;
  document.getElementById('assign-vol-name').textContent = v.name;
  document.getElementById('assign-vol-skill').textContent = v.skill;

  const campSelect = document.getElementById('assign-vol-camp');
  // Milestone 4: Cannot be assigned to a Closed camp!
  campSelect.innerHTML = `
    <option value="">-- Unassign (Standby) --</option>
    ${state.camps
      .filter(c => c.status !== 'Closed') // Enforces rule: Cannot be assigned to Closed camp
      .map(c => `<option value="${c.id}" ${c.id === v.camp_id ? 'selected' : ''}>${c.name} (${c.district}) - ${c.status}</option>`).join('')}
  `;

  openModal('modal-assign-vol');
}

async function saveAssignVolunteerForm(e) {
  e.preventDefault();
  const volId = parseInt(document.getElementById('assign-vol-id').value, 10);
  const campVal = document.getElementById('assign-vol-camp').value;
  const camp_id = campVal ? parseInt(campVal, 10) : null;

  try {
    const updated = await apiRequest(`/volunteers/${volId}`, 'PUT', { camp_id });
    const idx = state.volunteers.findIndex(v => v.id === volId);
    if (idx !== -1) state.volunteers[idx] = updated;
    showToast(`Volunteer deployment updated!`, 'success');
    closeModal('modal-assign-vol');
    renderCurrentView();
    updateHeaderCounts();
  } catch (err) {}
}

async function unassignVolunteer(volId) {
  try {
    const updated = await apiRequest(`/volunteers/${volId}`, 'PUT', { camp_id: null });
    const idx = state.volunteers.findIndex(v => v.id === volId);
    if (idx !== -1) state.volunteers[idx] = updated;
    showToast(`Volunteer unassigned from camp.`, 'info');
    renderCurrentView();
    updateHeaderCounts();
  } catch (err) {}
}

// ==========================================
// SEED RESET (Milestone 6)
// ==========================================
async function promptResetSeedData() {
  if (confirm('Are you sure you want to reset all ReliefHub data back to pristine Hackathon Seed Data? (8 camps, 12 inventory items, 20 needs, 10 dispatches, 10 donations, 15 volunteers)')) {
    try {
      const res = await apiRequest('/reset', 'POST');
      showToast(res.message, 'success');
      await loadAllData();
    } catch (err) {}
  }
}

// Modal open/close helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

// Event Listeners Setup
function setupEventListeners() {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // Role buttons
  document.getElementById('role-btn-admin').addEventListener('click', () => setRole('Admin'));
  document.getElementById('role-btn-vol').addEventListener('click', () => setRole('Volunteer'));

  // Seed Reset
  document.getElementById('btn-reset-db').addEventListener('click', promptResetSeedData);

  // Camp Filters
  const searchCamps = document.getElementById('search-camps');
  if (searchCamps) {
    searchCamps.addEventListener('input', (e) => {
      state.filters.camps.search = e.target.value;
      renderCampsView();
    });
  }
  const filterDistrict = document.getElementById('filter-camp-district');
  if (filterDistrict) {
    filterDistrict.addEventListener('change', (e) => {
      state.filters.camps.district = e.target.value;
      renderCampsView();
    });
  }
  const filterCampStatus = document.getElementById('filter-camp-status');
  if (filterCampStatus) {
    filterCampStatus.addEventListener('change', (e) => {
      state.filters.camps.status = e.target.value;
      renderCampsView();
    });
  }

  // Needs Filters
  const filterNeedCamp = document.getElementById('filter-need-camp');
  if (filterNeedCamp) {
    filterNeedCamp.addEventListener('change', (e) => {
      state.filters.needs.campId = e.target.value;
      renderNeedsTable();
    });
  }
  const filterNeedPriority = document.getElementById('filter-need-priority');
  if (filterNeedPriority) {
    filterNeedPriority.addEventListener('change', (e) => {
      state.filters.needs.priority = e.target.value;
      renderNeedsTable();
    });
  }
  const filterNeedStatus = document.getElementById('filter-need-status');
  if (filterNeedStatus) {
    filterNeedStatus.addEventListener('change', (e) => {
      state.filters.needs.status = e.target.value;
      renderNeedsTable();
    });
  }

  // Inventory Filters
  const filterInvCat = document.getElementById('filter-inventory-cat');
  if (filterInvCat) {
    filterInvCat.addEventListener('change', (e) => {
      state.filters.inventory.category = e.target.value;
      renderWarehouseTable();
    });
  }
  const filterInvLow = document.getElementById('filter-inventory-low');
  if (filterInvLow) {
    filterInvLow.addEventListener('change', (e) => {
      state.filters.inventory.lowStockOnly = e.target.checked;
      renderWarehouseTable();
    });
  }

  // Dispatch Filters
  const filterDspStatus = document.getElementById('filter-dispatch-status');
  if (filterDspStatus) {
    filterDspStatus.addEventListener('change', (e) => {
      state.filters.dispatches.status = e.target.value;
      renderDispatchesView();
    });
  }
  const searchDsp = document.getElementById('search-dispatches');
  if (searchDsp) {
    searchDsp.addEventListener('input', (e) => {
      state.filters.dispatches.search = e.target.value;
      renderDispatchesView();
    });
  }

  // Donation Filters
  const filterDonType = document.getElementById('filter-donation-type');
  if (filterDonType) {
    filterDonType.addEventListener('change', (e) => {
      state.filters.donations.type = e.target.value;
      renderDonationsSection();
    });
  }

  // Volunteer Filters
  const filterVolSkill = document.getElementById('filter-volunteer-skill');
  if (filterVolSkill) {
    filterVolSkill.addEventListener('change', (e) => {
      state.filters.volunteers.skill = e.target.value;
      renderVolunteersSection();
    });
  }
  const filterVolAssign = document.getElementById('filter-volunteer-assignment');
  if (filterVolAssign) {
    filterVolAssign.addEventListener('change', (e) => {
      state.filters.volunteers.assignment = e.target.value;
      renderVolunteersSection();
    });
  }
  const searchVol = document.getElementById('search-volunteers');
  if (searchVol) {
    searchVol.addEventListener('input', (e) => {
      state.filters.volunteers.search = e.target.value;
      renderVolunteersSection();
    });
  }

  // Form Submissions
  document.getElementById('form-camp').addEventListener('submit', saveCampForm);
  document.getElementById('form-need').addEventListener('submit', saveNeedForm);
  document.getElementById('form-inventory').addEventListener('submit', saveInventoryForm);
  document.getElementById('form-dispatch').addEventListener('submit', createDispatchForm);
  document.getElementById('form-donation').addEventListener('submit', saveDonationForm);
  document.getElementById('form-volunteer').addEventListener('submit', saveVolunteerForm);
  document.getElementById('form-assign-volunteer').addEventListener('submit', saveAssignVolunteerForm);

  // Live input change listeners
  document.getElementById('camp-capacity-input').addEventListener('input', checkCampCapacityRule);
  document.getElementById('camp-families-input').addEventListener('input', checkCampCapacityRule);

  document.getElementById('dispatch-camp-select').addEventListener('change', () => onDispatchCampChange());
  document.getElementById('dispatch-need-select').addEventListener('change', onDispatchNeedChange);
  document.getElementById('dispatch-qty-input').addEventListener('input', validateDispatchQuantity);

  document.getElementById('donation-type-input').addEventListener('change', toggleDonationFields);

  // Modal Backdrop click to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });
}

// Window load init
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateRoleUI();
  loadAllData();
});

