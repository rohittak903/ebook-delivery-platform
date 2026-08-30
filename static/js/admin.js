// Admin Dashboard Client Application

let adminToken = localStorage.getItem('ebookvault_admin_token') || '';
let currentAdminTab = 'overview';
let cachedSettings = {};
let allAdminEbooksList = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (adminToken) {
        const isValid = await verifyAuth();
        if (isValid) {
            showDashboard();
        } else {
            showLogin();
        }
    } else {
        showLogin();
    }
});

function showLogin() {
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    lucide.createIcons();
}

function showDashboard() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    switchTab('overview');
    checkOpenTicketsCount();
}

async function verifyAuth() {
    try {
        const res = await fetch('/api/admin/check-auth', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Verifying...`;

    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || 'Login failed. Invalid username or password.');
            return;
        }

        adminToken = data.token;
        localStorage.setItem('ebookvault_admin_token', adminToken);
        showDashboard();
    } catch (err) {
        console.error('Login error', err);
        alert('Network error. Please make sure the server is running.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4 mr-2"></i><span>Sign In to Dashboard</span>`;
        lucide.createIcons();
    }
}

function adminLogout() {
    localStorage.removeItem('ebookvault_admin_token');
    adminToken = '';
    showLogin();
}

function switchTab(tabId) {
    currentAdminTab = tabId;
    
    // Update sidebar styling
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-600', 'text-white');
        btn.classList.add('hover:bg-slate-800', 'text-slate-300');
    });

    const activeBtn = document.getElementById(`tab-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-brand-600', 'text-white');
        activeBtn.classList.remove('hover:bg-slate-800', 'text-slate-300');
    }

    // Hide all panels
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));

    // Show selected panel
    const targetPanel = document.getElementById(`panel-${tabId}`);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }

    // Update title
    const titles = {
        'overview': 'Dashboard Overview',
        'ebooks': 'Ebooks Catalog & Files',
        'slides': 'Hero Slider Banners Manager',
        'customers': 'Registered Customers Directory',
        'orders': 'Orders & Delivery Logs',
        'tickets': 'Customer Support & Missing Books Requests',
        'settings': 'Delivery & Payment Gateway Settings'
    };
    document.getElementById('pageTitle').innerText = titles[tabId] || 'Admin Dashboard';

    // Load data for specific tab
    if (tabId === 'overview') loadOverviewStats();
    if (tabId === 'ebooks') loadAdminEbooks();
    if (tabId === 'slides') loadAdminSlides();
    if (tabId === 'customers') loadAdminCustomers();
    if (tabId === 'orders') loadAdminOrders();
    if (tabId === 'tickets') loadAdminTickets();
    if (tabId === 'settings') loadAdminSettings();

    lucide.createIcons();
}

function refreshCurrentTab() {
    switchTab(currentAdminTab);
}

// 1. OVERVIEW & ANALYTICS
async function loadOverviewStats() {
    try {
        const res = await fetch('/api/admin/analytics', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();

        const curr = cachedSettings.store_currency || '₹';
        document.getElementById('statRevenue').innerText = `${curr}${(data.total_revenue || 0).toFixed(2)}`;
        document.getElementById('statOrders').innerText = data.total_orders || 0;
        document.getElementById('statEbooks').innerText = data.total_ebooks || 0;

        const topList = document.getElementById('topEbooksList');
        if (!data.top_ebooks || data.top_ebooks.length === 0) {
            topList.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">No ebook sales recorded yet.</p>`;
        } else {
            topList.innerHTML = data.top_ebooks.map((item, idx) => `
                <div class="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">${idx + 1}</span>
                        <div>
                            <div class="font-bold text-xs text-slate-800 line-clamp-1">${item.ebook_title}</div>
                            <div class="text-[10px] text-slate-400">${item.sales_count} copies sold</div>
                        </div>
                    </div>
                    <span class="font-extrabold text-xs text-brand-700">${curr}${(item.revenue || 0).toFixed(2)}</span>
                </div>
            `).join('');
        }

        lucide.createIcons();
    } catch (err) {
        console.error('Analytics load error', err);
    }
}

// 2. EBOOKS MANAGER
async function loadAdminEbooks() {
    const tbody = document.getElementById('adminEbooksTableBody');
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Loading catalog...</td></tr>`;

    try {
        const res = await fetch('/api/admin/ebooks', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const ebooks = data.ebooks || [];
        allAdminEbooksList = ebooks;

        if (ebooks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500">No ebooks found. Click 'Add New Ebook' to upload your first PDF or Word document.</td></tr>`;
            return;
        }

        tbody.innerHTML = ebooks.map(b => {
            const format = (b.file_format || 'pdf').toUpperCase();
            let badgeClass = 'badge-pdf';
            if (format.includes('DOC')) badgeClass = 'badge-docx';

            const sizeKB = (b.file_size_bytes / 1024).toFixed(1);

            return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="py-4 px-6">
                        <div class="flex items-center gap-3">
                            <img src="${b.cover_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-10 h-14 object-cover rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
                            <div>
                                <div class="font-bold text-slate-900 text-sm">${b.title}</div>
                                <div class="text-xs text-slate-500">By ${b.author}</div>
                                <div class="text-[10px] text-slate-400 mt-0.5">${sizeKB} KB</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-4 text-xs font-semibold text-slate-600">${b.category}</td>
                    <td class="py-4 px-4">
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${badgeClass}">${format}</span>
                    </td>
                    <td class="py-4 px-4 font-bold text-slate-800 text-xs">
                        ₹${b.price.toFixed(2)}
                        ${b.sale_price ? `<span class="text-[10px] text-emerald-600 block">Sale: ₹${b.sale_price.toFixed(2)}</span>` : ''}
                    </td>
                    <td class="py-4 px-4 text-xs font-semibold text-slate-600">${b.downloads_count || 0}</td>
                    <td class="py-4 px-4">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${b.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
                            ${b.is_active ? 'Active' : 'Draft'}
                        </span>
                    </td>
                    <td class="py-4 px-6 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="handleDeleteEbook(${b.id}, '${b.title}')" class="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Delete">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error('Ebooks load error', err);
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-red-500">Failed to load ebooks.</td></tr>`;
    }
}

function openAddEbookModal() {
    document.getElementById('addEbookForm').reset();
    document.getElementById('addEbookModal').classList.remove('hidden');
    lucide.createIcons();
}

async function handleAddEbookSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveEbookBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Uploading Ebook & Files...`;

    const form = new FormData();
    form.append('title', document.getElementById('ebookTitleInput').value.trim());
    form.append('author', document.getElementById('ebookAuthorInput').value.trim());
    form.append('category', document.getElementById('ebookCategoryInput').value.trim());
    form.append('price', document.getElementById('ebookPriceInput').value);
    
    const salePrice = document.getElementById('ebookSalePriceInput').value;
    if (salePrice) form.append('sale_price', salePrice);
    
    form.append('description', document.getElementById('ebookDescInput').value.trim());

    const ebookFile = document.getElementById('ebookFileInput').files[0];
    if (ebookFile) form.append('ebook_file', ebookFile);

    const coverFile = document.getElementById('coverFileInput').files[0];
    if (coverFile) form.append('cover_file', coverFile);

    try {
        const res = await fetch('/api/admin/ebooks', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: form
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || 'Failed to upload ebook.');
            return;
        }

        alert('Ebook uploaded and published successfully!');
        closeModal('addEbookModal');
        loadAdminEbooks();
    } catch (err) {
        console.error('Upload error', err);
        alert('Network error during upload.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="upload-cloud" class="w-5 h-5 mr-2"></i><span>Upload & Publish Ebook</span>`;
        lucide.createIcons();
    }
}

async function handleDeleteEbook(id, title) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
        const res = await fetch(`/api/admin/ebooks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
            loadAdminEbooks();
        } else {
            alert('Failed to delete ebook.');
        }
    } catch (err) {
        console.error('Delete error', err);
    }
}

// 3. HERO SLIDES MANAGER
async function loadAdminSlides() {
    const tbody = document.getElementById('adminSlidesTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Loading hero slides...</td></tr>`;

    try {
        const res = await fetch('/api/admin/hero-slides', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const slides = data.slides || [];

        if (slides.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No hero slides added yet. Click 'Add New Hero Slide' to create your first banner.</td></tr>`;
            return;
        }

        tbody.innerHTML = slides.map(s => `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="py-4 px-6">
                    <img src="${s.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-20 h-12 object-cover rounded-lg border shadow-sm">
                </td>
                <td class="py-4 px-4">
                    <img src="${s.mobile_image || s.desktop_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-12 h-12 object-cover rounded-lg border shadow-sm">
                </td>
                <td class="py-4 px-4 max-w-xs">
                    <div class="font-bold text-xs text-slate-900 line-clamp-1">${s.title}</div>
                    <div class="text-[11px] text-slate-500 line-clamp-1">${s.subtitle}</div>
                </td>
                <td class="py-4 px-4">
                    <span class="text-xs font-bold text-brand-700 block">${s.badge_text || 'None'}</span>
                    <span class="text-[10px] text-slate-500 font-semibold">${s.cta_text || 'Button'}</span>
                </td>
                <td class="py-4 px-4 text-xs font-bold text-slate-600">${s.sort_order || 0}</td>
                <td class="py-4 px-6 text-right">
                    <button onclick="handleDeleteSlide(${s.id})" class="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Delete Slide">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();
    } catch (err) {
        console.error('Slides load error', err);
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500">Failed to load hero slides.</td></tr>`;
    }
}

function openAddSlideModal() {
    document.getElementById('addSlideForm').reset();
    document.getElementById('addSlideModal').classList.remove('hidden');
    lucide.createIcons();
}

async function handleAddSlideSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveSlideBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Uploading Banners...`;

    const form = new FormData();
    form.append('title', document.getElementById('slideTitleInput').value.trim());
    form.append('subtitle', document.getElementById('slideSubtitleInput').value.trim());
    form.append('badge_text', document.getElementById('slideBadgeInput').value.trim());
    form.append('cta_text', document.getElementById('slideCtaTextInput').value.trim());

    const deskFile = document.getElementById('slideDesktopFileInput').files[0];
    if (deskFile) form.append('desktop_image_file', deskFile);

    const mobFile = document.getElementById('slideMobileFileInput').files[0];
    if (mobFile) form.append('mobile_image_file', mobFile);

    try {
        const res = await fetch('/api/admin/hero-slides', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: form
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || 'Failed to add hero slide.');
            return;
        }

        alert('Hero banner published successfully!');
        closeModal('addSlideModal');
        loadAdminSlides();
    } catch (err) {
        console.error('Slide upload error', err);
        alert('Network error during banner upload.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="upload" class="w-4 h-4 mr-2"></i><span>Publish Hero Banner</span>`;
        lucide.createIcons();
    }
}

async function handleDeleteSlide(id) {
    if (!confirm('Are you sure you want to delete this hero slide banner?')) return;
    try {
        const res = await fetch(`/api/admin/hero-slides/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
            loadAdminSlides();
        } else {
            alert('Failed to delete slide.');
        }
    } catch (err) {
        console.error('Delete slide error', err);
    }
}

// 4. CUSTOMERS CRM DIRECTORY
async function loadAdminCustomers() {
    const tbody = document.getElementById('adminCustomersTableBody');
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Loading customer CRM...</td></tr>`;

    try {
        const res = await fetch('/api/admin/customers', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const customers = data.customers || [];

        if (customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500">No registered customers yet. Customers will appear here as soon as they sign up or purchase.</td></tr>`;
            return;
        }

        tbody.innerHTML = customers.map(c => {
            const dateStr = new Date(c.created_at).toLocaleDateString();

            return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="py-4 px-6 font-bold text-xs text-slate-900">
                        <div class="flex items-center gap-2">
                            <span class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold text-[11px] flex items-center justify-center">${c.name.substring(0,2).toUpperCase()}</span>
                            <span>${c.name}</span>
                        </div>
                    </td>
                    <td class="py-4 px-4 text-xs text-slate-600">${c.email}</td>
                    <td class="py-4 px-4 text-xs font-mono text-emerald-700 font-semibold">${c.phone || 'N/A'}</td>
                    <td class="py-4 px-4 text-xs font-bold text-slate-800">${c.total_orders || 0}</td>
                    <td class="py-4 px-4 text-xs font-extrabold text-brand-700">₹${(c.total_spent || 0).toFixed(2)}</td>
                    <td class="py-4 px-4 text-xs text-slate-500">${dateStr}</td>
                    <td class="py-4 px-6 text-right">
                        <a href="${c.whatsapp_url}" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                            <span>WhatsApp</span>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error('Customers load error', err);
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-red-500">Failed to load customer CRM.</td></tr>`;
    }
}

// 5. ORDERS & DELIVERY LOGS
async function loadAdminOrders() {
    const tbody = document.getElementById('adminOrdersTableBody');
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Loading orders...</td></tr>`;

    try {
        const res = await fetch('/api/admin/orders', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const orders = data.orders || [];

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500">No customer orders placed yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(o => {
            const dateStr = new Date(o.created_at).toLocaleString();
            const emailSent = o.email_status === 'sent';

            return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="py-4 px-6">
                        <div class="font-mono font-bold text-xs text-brand-700">${o.order_code}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${dateStr}</div>
                    </td>
                    <td class="py-4 px-4">
                        <div class="font-bold text-xs text-slate-900">${o.customer_name}</div>
                        <div class="text-[11px] text-slate-500">${o.customer_email}</div>
                        <div class="text-[11px] font-mono text-emerald-600">${o.customer_whatsapp}</div>
                    </td>
                    <td class="py-4 px-4 font-semibold text-xs text-slate-800 max-w-xs truncate">${o.ebook_title}</td>
                    <td class="py-4 px-4 font-bold text-xs text-slate-900">₹${o.amount.toFixed(2)}</td>
                    <td class="py-4 px-4">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <i data-lucide="check" class="w-3 h-3"></i>
                            <span>DELIVERED</span>
                        </span>
                    </td>
                    <td class="py-4 px-4">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                            <i data-lucide="message-circle" class="w-3 h-3"></i>
                            <span>READY</span>
                        </span>
                    </td>
                    <td class="py-4 px-6 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <button onclick="handleResendEmail(${o.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition" title="Resend Email">
                                <i data-lucide="mail" class="w-3.5 h-3.5 inline mr-1"></i> Resend
                            </button>
                            <a href="${o.whatsapp_url}" target="_blank" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition" title="Open WhatsApp Chat">
                                <i data-lucide="message-circle" class="w-3.5 h-3.5 inline mr-1"></i> WhatsApp
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error('Orders load error', err);
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-red-500">Failed to load orders.</td></tr>`;
    }
}

async function handleResendEmail(orderId) {
    try {
        const res = await fetch(`/api/admin/orders/${orderId}/resend-email`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        alert(data.message || 'Email delivery triggered.');
        loadAdminOrders();
    } catch (err) {
        console.error('Resend email error', err);
        alert('Failed to trigger email resend.');
    }
}

// 6. SUPPORT TICKETS
async function loadAdminTickets() {
    const tbody = document.getElementById('adminTicketsTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Loading support tickets...</td></tr>`;

    try {
        const res = await fetch('/api/admin/support-tickets', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const tickets = data.tickets || [];

        const openCount = tickets.filter(t => t.status === 'open').length;
        const badge = document.getElementById('ticketBadge');
        if (openCount > 0) {
            badge.innerText = openCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (tickets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No support tickets submitted yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            const dateStr = new Date(t.created_at).toLocaleString();
            const isOpen = t.status === 'open';

            return `
                <tr class="hover:bg-slate-50/80 transition">
                    <td class="py-4 px-6">
                        <div class="font-mono font-bold text-xs text-brand-700">#TICKET-${t.id}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${dateStr}</div>
                    </td>
                    <td class="py-4 px-4">
                        <div class="font-bold text-xs text-slate-900">${t.customer_name}</div>
                        <div class="text-[11px] text-slate-500">${t.customer_email}</div>
                        <div class="text-[11px] font-mono text-emerald-600">${t.customer_phone}</div>
                    </td>
                    <td class="py-4 px-4">
                        <div class="text-xs font-mono font-bold text-slate-800">${t.order_code || 'N/A'}</div>
                        <div class="text-[11px] text-slate-500 font-mono">UTR: ${t.transaction_ref || 'None'}</div>
                    </td>
                    <td class="py-4 px-4 text-xs text-slate-700 max-w-xs">
                        <p class="line-clamp-2">${t.message}</p>
                    </td>
                    <td class="py-4 px-4">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${isOpen ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                            ${t.status.toUpperCase()}
                        </span>
                    </td>
                    <td class="py-4 px-6 text-right">
                        <a href="${t.whatsapp_reply_url}" target="_blank" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition" title="Open WhatsApp Chat">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5 inline mr-1"></i> WhatsApp
                        </a>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error('Tickets load error', err);
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-500">Failed to load support tickets.</td></tr>`;
    }
}

async function checkOpenTicketsCount() {
    try {
        const res = await fetch('/api/admin/support-tickets', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const openCount = (data.tickets || []).filter(t => t.status === 'open').length;
        const badge = document.getElementById('ticketBadge');
        if (openCount > 0) {
            badge.innerText = openCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch {}
}

// 7. SETTINGS & INTEGRATIONS
async function loadAdminSettings() {
    try {
        const res = await fetch('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        cachedSettings = data.settings || {};

        document.getElementById('setting_razorpay_key_id').value = cachedSettings.razorpay_key_id || 'rzp_live_9035630901';
        document.getElementById('setting_razorpay_key_secret').value = cachedSettings.razorpay_key_secret || '';

        document.getElementById('setting_bank_account_no').value = cachedSettings.bank_account_no || '110076462071';
        document.getElementById('setting_bank_ifsc').value = cachedSettings.bank_ifsc || 'CNRB0002614';
        document.getElementById('setting_bank_name').value = cachedSettings.bank_name || 'Canara Bank';
        document.getElementById('setting_bank_holder_name').value = cachedSettings.bank_holder_name || 'ROHIT TAK';

        const smtpEnabled = (cachedSettings.smtp_enabled === 'true' || cachedSettings.smtp_enabled === '1');
        document.getElementById('setting_smtp_enabled').checked = smtpEnabled;
        document.getElementById('setting_smtp_host').value = cachedSettings.smtp_host || 'smtp.gmail.com';
        document.getElementById('setting_smtp_port').value = cachedSettings.smtp_port || '587';
        document.getElementById('setting_smtp_user').value = cachedSettings.smtp_user || 'rohittak903@gmail.com';
        document.getElementById('setting_smtp_password').value = cachedSettings.smtp_password || '';
    } catch (err) {
        console.error('Settings load error', err);
    }
}

async function saveAllSettings() {
    const payload = {
        razorpay_key_id: document.getElementById('setting_razorpay_key_id')?.value.trim() || 'rzp_live_9035630901',
        razorpay_key_secret: document.getElementById('setting_razorpay_key_secret')?.value.trim() || '',

        bank_account_no: document.getElementById('setting_bank_account_no')?.value.trim() || '110076462071',
        bank_ifsc: document.getElementById('setting_bank_ifsc')?.value.trim() || 'CNRB0002614',
        bank_name: document.getElementById('setting_bank_name')?.value.trim() || 'Canara Bank',
        bank_holder_name: document.getElementById('setting_bank_holder_name')?.value.trim() || 'ROHIT TAK',
        
        smtp_enabled: document.getElementById('setting_smtp_enabled').checked ? 'true' : 'false',
        smtp_host: document.getElementById('setting_smtp_host').value.trim(),
        smtp_port: document.getElementById('setting_smtp_port').value.trim(),
        smtp_user: document.getElementById('setting_smtp_user').value.trim(),
        smtp_password: document.getElementById('setting_smtp_password').value.trim()
    };

    try {
        const res = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ settings: payload })
        });

        const data = await res.json();
        if (res.ok) {
            alert('Settings saved successfully!');
        } else {
            alert(data.detail || 'Failed to save settings.');
        }
    } catch (err) {
        console.error('Settings save error', err);
        alert('Network error while saving settings.');
    }
}

// Modal helper
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}
