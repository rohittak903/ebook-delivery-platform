// Admin Dashboard Logic - Raja Rohit Tak

let adminToken = localStorage.getItem('ebookvault_admin_token') || localStorage.getItem('qelvoria_admin_token') || '';
let currentTab = 'overview';
let cachedEbooks = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (adminToken) {
        const isValid = await verifyAdminSession();
        if (isValid) {
            showDashboard();
            return;
        } else {
            adminToken = '';
            localStorage.removeItem('ebookvault_admin_token');
            localStorage.removeItem('qelvoria_admin_token');
        }
    }
    showLogin();
});

// --- Auth Handling ---

async function verifyAdminSession() {
    try {
        const res = await fetch('/api/admin/check-auth', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        return res.ok;
    } catch {
        return false;
    }
}

function showLogin() {
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    lucide.createIcons();
    switchTab('overview');
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    btn.innerText = 'Verifying...';

    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (res.ok) {
            adminToken = data.token;
            localStorage.setItem('ebookvault_admin_token', adminToken);
            localStorage.setItem('qelvoria_admin_token', adminToken);
            showDashboard();
        } else {
            alert(data.detail || 'Login failed. Please check your username and password.');
        }
    } catch (err) {
        console.error('Login error', err);
        alert('Network error during login.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4 mr-2"></i><span>Sign In to Dashboard</span>`;
        lucide.createIcons();
    }
}

function adminLogout() {
    adminToken = '';
    localStorage.removeItem('ebookvault_admin_token');
    showLogin();
}

// --- Navigation Tabs ---

function switchTab(tabId) {
    currentTab = tabId;
    
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-600', 'text-white');
        btn.classList.add('hover:bg-slate-800', 'text-slate-300');
    });
    
    const activeBtn = document.getElementById(`tab-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove('hover:bg-slate-800', 'text-slate-300');
        activeBtn.classList.add('bg-brand-600', 'text-white');
    }

    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
    const activePanel = document.getElementById(`panel-${tabId}`);
    if (activePanel) activePanel.classList.remove('hidden');

    const titles = {
        'overview': 'Dashboard Overview',
        'ebooks': 'Ebooks Catalog & External Links',
        'bundles': 'Special Bundle Deals Manager',
        'coupons': 'Promo Codes & Discounts',
        'reviews': 'Customer & AI Reviews Manager',
        'slides': 'Hero Slider Banners',
        'customers': 'Registered Customers CRM',
        'orders': 'Orders & Delivery Logs',
        'tickets': 'Support Ticket Desk',
        'settings': 'Settings & Admin Password'
    };
    document.getElementById('pageTitle').innerText = titles[tabId] || 'Admin';

    refreshCurrentTab();
}

function refreshCurrentTab() {
    if (currentTab === 'overview') loadAdminStats();
    else if (currentTab === 'ebooks') loadAdminEbooks();
    else if (currentTab === 'bundles') loadAdminBundles();
    else if (currentTab === 'coupons') loadAdminCoupons();
    else if (currentTab === 'reviews') loadAdminReviews();
    else if (currentTab === 'slides') loadAdminSlides();
    else if (currentTab === 'customers') loadAdminCustomers();
    else if (currentTab === 'orders') loadAdminOrders();
    else if (currentTab === 'tickets') loadAdminTickets();
    else if (currentTab === 'settings') loadAdminSettings();
    lucide.createIcons();
}

// --- Overview Stats ---

async function loadAdminStats() {
    try {
        const res = await fetch('/api/admin/orders', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const orders = data.orders || [];

        const totalRevenue = orders.reduce((acc, o) => acc + (o.amount || 0), 0);
        document.getElementById('statRevenue').innerText = `₹${totalRevenue.toFixed(2)}`;
        document.getElementById('statOrders').innerText = orders.length;

        const ebRes = await fetch('/api/admin/ebooks', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const ebData = await ebRes.json();
        cachedEbooks = ebData.ebooks || [];
        document.getElementById('statEbooks').innerText = cachedEbooks.length;
    } catch (e) {
        console.error('Stats load error', e);
    }
}

// --- Ebooks Management ---

async function loadAdminEbooks() {
    const tbody = document.getElementById('adminEbooksTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading catalog...</td></tr>`;

    try {
        const res = await fetch('/api/admin/ebooks', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        cachedEbooks = data.ebooks || [];

        if (cachedEbooks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No ebooks uploaded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = cachedEbooks.map(b => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6">
                    <div class="flex items-center gap-3">
                        <img src="${b.cover_image || '/uploads/covers/python-ai-cover.jpg'}" class="w-10 h-14 object-cover rounded-lg border border-slate-800">
                        <div>
                            <div class="font-bold text-white">${b.title}</div>
                            <div class="text-[11px] text-slate-400">By ${b.author}</div>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4 text-slate-300 font-medium">${b.category || 'General'}</td>
                <td class="py-3 px-4 font-bold text-emerald-400">₹${(b.sale_price || b.price).toFixed(2)}</td>
                <td class="py-3 px-4">
                    <div class="flex items-center gap-1.5 text-[11px]">
                        ${b.google_books_url ? `<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800" title="${b.google_books_url}">Google</span>` : ''}
                        ${b.kindle_url ? `<span class="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800" title="${b.kindle_url}">Kindle</span>` : ''}
                        ${b.apple_books_url ? `<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300" title="${b.apple_books_url}">Apple</span>` : ''}
                        ${(!b.google_books_url && !b.kindle_url && !b.apple_books_url) ? `<span class="text-slate-500 italic">None</span>` : ''}
                    </div>
                </td>
                <td class="py-3 px-4 font-mono text-slate-400">${b.downloads_count || 0}</td>
                <td class="py-3 px-6 text-right">
                    <button onclick="deleteAdminEbook(${b.id})" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Ebooks load error', e);
    }
}

function openAddEbookModal() {
    openModal('addEbookModal');
}

async function handleAddEbookSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveEbookBtn');
    btn.disabled = true;
    btn.innerText = 'Uploading...';

    const formData = new FormData();
    formData.append('title', document.getElementById('ebookTitleInput').value.trim());
    formData.append('author', document.getElementById('ebookAuthorInput').value.trim());
    formData.append('category', document.getElementById('ebookCategoryInput').value.trim());
    formData.append('price', document.getElementById('ebookPriceInput').value);
    
    const salePrice = document.getElementById('ebookSalePriceInput').value;
    if (salePrice) formData.append('sale_price', salePrice);

    const gUrl = document.getElementById('ebookGoogleBooksInput').value.trim();
    if (gUrl) formData.append('google_books_url', gUrl);

    const kUrl = document.getElementById('ebookKindleInput').value.trim();
    if (kUrl) formData.append('kindle_url', kUrl);

    const aUrl = document.getElementById('ebookAppleBooksInput').value.trim();
    if (aUrl) formData.append('apple_books_url', aUrl);

    formData.append('description', document.getElementById('ebookDescInput').value.trim());

    const ebookFile = document.getElementById('ebookFileInput').files[0];
    if (ebookFile) formData.append('ebook_file', ebookFile);

    const coverFile = document.getElementById('coverFileInput').files[0];
    if (coverFile) formData.append('cover_file', coverFile);

    try {
        const res = await fetch('/api/admin/ebooks', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: formData
        });

        const data = await res.json();
        if (res.ok) {
            alert(`🎉 Success: ${data.message || 'Ebook published successfully!'}`);
            document.getElementById('addEbookForm').reset();
            closeModal('addEbookModal');
            loadAdminEbooks();
        } else {
            if (res.status === 401) {
                alert('⚠️ Session expired. Please log in to admin panel again.');
                showLogin();
            } else {
                alert(`⚠️ Error: ${data.detail || 'Upload failed. Please check your inputs.'}`);
            }
        }
    } catch (err) {
        console.error('Upload error', err);
        alert('Network error while uploading ebook. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Upload & Publish Ebook';
    }
}

async function deleteAdminEbook(id) {
    if (!confirm('Are you sure you want to delete this ebook?')) return;
    try {
        const res = await fetch(`/api/admin/ebooks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) loadAdminEbooks();
    } catch (e) {
        console.error('Delete ebook error', e);
    }
}

// --- Bundle Offers Management ---

async function loadAdminBundles() {
    const tbody = document.getElementById('adminBundlesTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading bundles...</td></tr>`;

    try {
        const res = await fetch('/api/admin/bundles', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const bundles = data.bundles || [];

        if (bundles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No bundles created yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = bundles.map(b => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6 font-bold text-white">${b.title}</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-extrabold border border-amber-800">${b.badge_text || 'BUNDLE'}</span></td>
                <td class="py-3 px-4 font-mono text-slate-400 text-xs">${b.ebook_ids}</td>
                <td class="py-3 px-4 text-slate-400 line-through">₹${b.price.toFixed(2)}</td>
                <td class="py-3 px-4 font-bold text-emerald-400">₹${b.sale_price.toFixed(2)}</td>
                <td class="py-3 px-6 text-right">
                    <button onclick="deleteAdminBundle(${b.id})" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Bundles load error', e);
    }
}

async function openAddBundleModal() {
    // Ensure ebooks are loaded for checkbox list
    if (cachedEbooks.length === 0) {
        const res = await fetch('/api/admin/ebooks', { headers: { 'Authorization': `Bearer ${adminToken}` } });
        const data = await res.json();
        cachedEbooks = data.ebooks || [];
    }

    const list = document.getElementById('bundleEbooksCheckboxList');
    list.innerHTML = cachedEbooks.map(eb => `
        <label class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-900 rounded-lg">
            <input type="checkbox" name="bundleEbookCheck" value="${eb.id}" class="rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500">
            <span class="text-white font-medium truncate">${eb.title} (₹${eb.sale_price || eb.price})</span>
        </label>
    `).join('');

    openModal('addBundleModal');
}

async function handleAddBundleSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveBundleBtn');
    btn.disabled = true;

    const checked = Array.from(document.querySelectorAll('input[name="bundleEbookCheck"]:checked')).map(cb => parseInt(cb.value));
    if (checked.length < 2) {
        alert('Please select at least 2 ebooks to form a bundle deal.');
        btn.disabled = false;
        return;
    }

    const formData = new FormData();
    formData.append('title', document.getElementById('bundleTitleInput').value.trim());
    formData.append('price', document.getElementById('bundlePriceInput').value);
    formData.append('sale_price', document.getElementById('bundleSalePriceInput').value);
    formData.append('badge_text', document.getElementById('bundleBadgeInput').value.trim());
    formData.append('ebook_ids', JSON.stringify(checked));
    formData.append('description', document.getElementById('bundleDescInput').value.trim());

    try {
        const res = await fetch('/api/admin/bundles', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: formData
        });
        if (res.ok) {
            alert('Bundle offer published!');
            closeModal('addBundleModal');
            loadAdminBundles();
        } else {
            alert('Failed to create bundle.');
        }
    } catch (e) {
        console.error('Bundle submit error', e);
    } finally {
        btn.disabled = false;
    }
}

async function deleteAdminBundle(id) {
    if (!confirm('Delete this bundle offer?')) return;
    try {
        const res = await fetch(`/api/admin/bundles/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) loadAdminBundles();
    } catch (e) {
        console.error('Bundle delete error', e);
    }
}

// --- Promo Codes / Coupons Management ---

async function loadAdminCoupons() {
    const tbody = document.getElementById('adminCouponsTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading coupons...</td></tr>`;

    try {
        const res = await fetch('/api/admin/coupons', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const coupons = data.coupons || [];

        if (coupons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No promo codes created yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = coupons.map(c => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6 font-mono font-bold text-brand-300">${c.code}</td>
                <td class="py-3 px-4 font-bold text-white">${c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}</td>
                <td class="py-3 px-4 text-slate-400">₹${c.min_order_amount.toFixed(2)}</td>
                <td class="py-3 px-4 font-mono text-slate-300">${c.used_count || 0}</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">ACTIVE</span></td>
                <td class="py-3 px-6 text-right">
                    <button onclick="deleteAdminCoupon(${c.id})" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Coupons load error', e);
    }
}

function openAddCouponModal() {
    openModal('addCouponModal');
}

async function handleAddCouponSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveCouponBtn');
    btn.disabled = true;

    const payload = {
        code: document.getElementById('couponCodeInput').value.trim().toUpperCase(),
        discount_type: document.getElementById('couponTypeInput').value,
        discount_value: parseFloat(document.getElementById('couponValueInput').value),
        min_order_amount: parseFloat(document.getElementById('couponMinOrderInput').value || 0)
    };

    try {
        const res = await fetch('/api/admin/coupons', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert(`Coupon '${payload.code}' created!`);
            closeModal('addCouponModal');
            loadAdminCoupons();
        } else {
            alert(data.detail || 'Failed to create coupon.');
        }
    } catch (e) {
        console.error('Coupon create error', e);
    } finally {
        btn.disabled = false;
    }
}

async function deleteAdminCoupon(id) {
    if (!confirm('Delete this promo code?')) return;
    try {
        const res = await fetch(`/api/admin/coupons/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) loadAdminCoupons();
    } catch (e) {
        console.error('Coupon delete error', e);
    }
}

// --- Customer & AI Reviews Management ---

async function loadAdminReviews() {
    const tbody = document.getElementById('adminReviewsTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading reviews...</td></tr>`;

    try {
        const res = await fetch('/api/admin/reviews', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const reviews = data.reviews || [];

        if (reviews.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No reviews submitted yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = reviews.map(r => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6 font-bold text-white max-w-xs truncate">${r.ebook_title || `Ebook #${r.ebook_id}`}</td>
                <td class="py-3 px-4 font-medium text-slate-300">${r.customer_name}</td>
                <td class="py-3 px-4 text-amber-400 font-bold">${'★'.repeat(r.rating || 5)}</td>
                <td class="py-3 px-4 text-slate-400 max-w-sm truncate italic">"${r.review_text}"</td>
                <td class="py-3 px-4">
                    ${r.is_ai_generated ? 
                        `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">AI Review</span>` : 
                        `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Verified Buyer</span>`
                    }
                </td>
                <td class="py-3 px-6 text-right">
                    <button onclick="deleteAdminReview(${r.id})" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Reviews load error', e);
    }
}

async function openAddAiReviewModal() {
    if (cachedEbooks.length === 0) {
        const res = await fetch('/api/admin/ebooks', { headers: { 'Authorization': `Bearer ${adminToken}` } });
        const data = await res.json();
        cachedEbooks = data.ebooks || [];
    }

    const select = document.getElementById('reviewEbookSelect');
    select.innerHTML = cachedEbooks.map(eb => `<option value="${eb.id}">${eb.title}</option>`).join('');

    openModal('addAiReviewModal');
}

async function handleAddAiReviewSubmit(e) {
    e.preventDefault();
    const payload = {
        ebook_id: parseInt(document.getElementById('reviewEbookSelect').value),
        customer_name: document.getElementById('aiReviewerName').value.trim(),
        rating: parseInt(document.getElementById('aiReviewRating').value),
        title: document.getElementById('aiReviewHeadline').value.trim(),
        review_text: document.getElementById('aiReviewText').value.trim(),
        is_ai_generated: true
    };

    try {
        const res = await fetch('/api/admin/reviews', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert('AI review added!');
            closeModal('addAiReviewModal');
            loadAdminReviews();
        } else {
            alert('Failed to add review.');
        }
    } catch (err) {
        console.error('AI review error', err);
    }
}

async function deleteAdminReview(id) {
    if (!confirm('Delete this review?')) return;
    try {
        const res = await fetch(`/api/admin/reviews/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) loadAdminReviews();
    } catch (e) {
        console.error('Delete review error', e);
    }
}

// --- Hero Slides Management ---

async function loadAdminSlides() {
    const tbody = document.getElementById('adminSlidesTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Loading hero slides...</td></tr>`;

    try {
        const res = await fetch('/api/admin/hero-slides', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const slides = data.slides || [];

        if (slides.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">No slides configured.</td></tr>`;
            return;
        }

        tbody.innerHTML = slides.map(s => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6">
                    <img src="${s.desktop_image}" class="w-16 h-10 object-cover rounded-lg border border-slate-800">
                </td>
                <td class="py-3 px-4">
                    <img src="${s.mobile_image || s.desktop_image}" class="w-10 h-10 object-cover rounded-lg border border-slate-800">
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-white">${s.title}</div>
                    <div class="text-[11px] text-slate-400 line-clamp-1">${s.subtitle}</div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded bg-brand-950 text-brand-300 text-[10px] font-bold border border-brand-800">${s.cta_text || 'CTA'}</span>
                </td>
                <td class="py-3 px-6 text-right">
                    <button onclick="deleteAdminSlide(${s.id})" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Slides load error', e);
    }
}

async function deleteAdminSlide(id) {
    if (!confirm('Delete this banner slide?')) return;
    try {
        const res = await fetch(`/api/admin/hero-slides/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) loadAdminSlides();
    } catch (e) {
        console.error('Delete slide error', e);
    }
}

// --- Customer CRM ---

async function loadAdminCustomers() {
    const tbody = document.getElementById('adminCustomersTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading customers...</td></tr>`;

    try {
        const res = await fetch('/api/admin/customers', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const customers = data.customers || [];

        if (customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No registered customers yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = customers.map(c => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6 font-bold text-white">${c.name}</td>
                <td class="py-3 px-4 text-slate-300">${c.email}<br><span class="text-[11px] text-slate-500">${c.phone || 'No phone'}</span></td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 uppercase">${c.auth_provider || 'Email'}</span></td>
                <td class="py-3 px-4 font-mono font-bold text-white">${c.total_orders || 0}</td>
                <td class="py-3 px-4 font-bold text-emerald-400">₹${(c.total_spent || 0).toFixed(2)}</td>
                <td class="py-3 px-6 text-right">
                    ${c.whatsapp_url ? `
                        <a href="${c.whatsapp_url}" target="_blank" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1">
                            <span>WhatsApp</span>
                        </a>
                    ` : `<span class="text-slate-500 italic">None</span>`}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Customers load error', e);
    }
}

// --- Orders & Logs ---

async function loadAdminOrders() {
    const tbody = document.getElementById('adminOrdersTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading orders...</td></tr>`;

    try {
        const res = await fetch('/api/admin/orders', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const orders = data.orders || [];

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No orders recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6">
                    <div class="font-mono font-bold text-brand-300">${o.order_code}</div>
                    <div class="text-[10px] text-slate-500">${new Date(o.created_at).toLocaleString()}</div>
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-white">${o.customer_name}</div>
                    <div class="text-[11px] text-slate-400">${o.customer_email}</div>
                </td>
                <td class="py-3 px-4 text-slate-200 font-medium">${o.ebook_title}</td>
                <td class="py-3 px-4 font-bold text-emerald-400">₹${o.amount.toFixed(2)}</td>
                <td class="py-3 px-4 font-mono text-xs text-purple-300">${o.coupon_code || '-'}</td>
                <td class="py-3 px-6 text-right">
                    <a href="/api/download/${o.access_token}" target="_blank" class="px-2.5 py-1 bg-brand-600 text-white rounded text-[11px] font-bold">Download</a>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Orders load error', e);
    }
}

// --- Support Tickets Desk ---

async function loadAdminTickets() {
    const tbody = document.getElementById('adminTicketsTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Loading tickets...</td></tr>`;

    try {
        const res = await fetch('/api/admin/support/tickets', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const tickets = data.tickets || [];

        if (tickets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">No support tickets.</td></tr>`;
            return;
        }

        tbody.innerHTML = tickets.map(t => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6 font-mono font-bold text-rose-300">#TICK-${t.id}</td>
                <td class="py-3 px-4">
                    <div class="font-bold text-white">${t.customer_name}</div>
                    <div class="text-[11px] text-slate-400">${t.customer_email} • ${t.customer_phone}</div>
                </td>
                <td class="py-3 px-4 text-slate-300 text-xs">${t.message}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'resolved' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}">
                        ${t.status.toUpperCase()}
                    </span>
                </td>
                <td class="py-3 px-6 text-right">
                    ${t.status !== 'resolved' ? `
                        <button onclick="resolveAdminTicket(${t.id})" class="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold">Deliver & Resolve</button>
                    ` : `<span class="text-slate-500 text-xs font-semibold">Resolved</span>`}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Tickets load error', e);
    }
}

async function resolveAdminTicket(ticketId) {
    if (cachedEbooks.length === 0) {
        const res = await fetch('/api/admin/ebooks', { headers: { 'Authorization': `Bearer ${adminToken}` } });
        const data = await res.json();
        cachedEbooks = data.ebooks || [];
    }
    const ebookId = cachedEbooks.length > 0 ? cachedEbooks[0].id : 1;

    try {
        const res = await fetch(`/api/admin/support/resolve-and-deliver/${ticketId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ebook_id: ebookId })
        });
        if (res.ok) {
            alert('Ticket resolved and ebook dispatched to customer!');
            loadAdminTickets();
        }
    } catch (e) {
        console.error('Resolve error', e);
    }
}

// --- Settings & Admin Password Change ---

async function loadAdminSettings() {
    try {
        const res = await fetch('/api/store-info');
        const data = await res.json();
        if (data.bank_account_no) document.getElementById('setting_bank_account_no').value = data.bank_account_no;
        if (data.bank_ifsc) document.getElementById('setting_bank_ifsc').value = data.bank_ifsc;
    } catch (e) {
        console.error('Settings load error', e);
    }
}

async function handleAdminPasswordChange(e) {
    e.preventDefault();
    const btn = document.getElementById('changePassBtn');
    btn.disabled = true;
    btn.innerText = 'Updating...';

    const cur = document.getElementById('adminCurrentPass').value.trim();
    const neu = document.getElementById('adminNewPass').value.trim();

    try {
        const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ current_password: cur, new_password: neu })
        });
        const data = await res.json();
        if (res.ok) {
            alert('Admin password updated successfully! Please remember your new password.');
            document.getElementById('adminCurrentPass').value = '';
            document.getElementById('adminNewPass').value = '';
        } else {
            alert(data.detail || 'Password change failed.');
        }
    } catch (err) {
        console.error('Password change error', err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Update Password';
    }
}

async function saveAllSettings() {
    const payload = {
        settings: {
            bank_account_no: document.getElementById('setting_bank_account_no').value.trim(),
            bank_ifsc: document.getElementById('setting_bank_ifsc').value.trim(),
            razorpay_key_id: document.getElementById('setting_razorpay_key_id').value.trim()
        }
    };

    try {
        const res = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert('Store settings saved successfully!');
        } else {
            alert('Failed to save settings');
        }
    } catch (e) {
        console.error('Settings save error', e);
    }
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        lucide.createIcons();
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}
