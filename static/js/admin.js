// Admin Dashboard Logic - Raja Rohit Tak

let adminToken = '';
let currentTab = 'overview';
let cachedEbooks = [];

document.addEventListener('DOMContentLoaded', () => {
    // Strictly clear all tokens on page load / refresh to always require login
    adminToken = '';
    sessionStorage.removeItem('ebookvault_admin_token');
    sessionStorage.removeItem('qelvoria_admin_token');
    localStorage.removeItem('ebookvault_admin_token');
    localStorage.removeItem('qelvoria_admin_token');

    const uInput = document.getElementById('adminUsername');
    const pInput = document.getElementById('adminPassword');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';

    showLogin();
});

// --- Auth Handling ---

async function verifyAdminSession() {
    if (!adminToken) return false;
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
    const uInput = document.getElementById('adminUsername');
    const pInput = document.getElementById('adminPassword');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
}

function showDashboard() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    lucide.createIcons();
    switchTab('overview');
}

async function handleAdminLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('loginSubmitBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Verifying...`;
    }

    const usernameInput = document.getElementById('adminUsername');
    const passwordInput = document.getElementById('adminPassword');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!username || !password) {
        alert('Please enter both username and password.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="lock" class="w-4 h-4 mr-2"></i><span>Sign In to Dashboard</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        return;
    }

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        let data;
        try {
            data = await res.json();
        } catch (parseErr) {
            alert('Server is syncing. Please click Sign In again in a moment.');
            return;
        }

        if (res.ok && data.token) {
            adminToken = data.token;
            sessionStorage.setItem('ebookvault_admin_token', adminToken);
            sessionStorage.setItem('qelvoria_admin_token', adminToken);
            showDashboard();
        } else {
            alert(data.detail || 'Invalid username or password. Please try again.');
        }
    } catch (err) {
        console.error('Login error', err);
        alert('Network error during login: ' + (err.message || 'Connection failed'));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="lock" class="w-4 h-4 mr-2"></i><span>Sign In to Dashboard</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

function adminLogout() {
    adminToken = '';
    sessionStorage.removeItem('ebookvault_admin_token');
    sessionStorage.removeItem('qelvoria_admin_token');
    localStorage.removeItem('ebookvault_admin_token');
    localStorage.removeItem('qelvoria_admin_token');
    showLogin();
}

// --- Navigation Tabs ---

function switchTab(tabId) {
    currentTab = tabId;
    
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-slate-950', 'font-bold', 'shadow-md');
        btn.classList.add('hover:bg-slate-800', 'text-slate-300');
    });
    
    const activeBtn = document.getElementById(`tab-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove('hover:bg-slate-800', 'text-slate-300');
        activeBtn.classList.add('bg-white', 'text-slate-950', 'font-bold', 'shadow-md');
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
        'livechats': 'Live Customer Chat Desk',
        'tickets': 'Support Tickets Desk',
        'settings': 'Store Settings & Password',
    };
    const titleEl = document.getElementById('adminPageTitle');
    if (titleEl) titleEl.innerText = titles[tabId] || 'Admin Dashboard';

    if (tabId === 'overview') loadAdminStats();
    else if (tabId === 'ebooks') loadAdminEbooks();
    else if (tabId === 'bundles') loadAdminBundles();
    else if (tabId === 'coupons') loadAdminCoupons();
    else if (tabId === 'reviews') loadAdminReviews();
    else if (tabId === 'slides') loadAdminSlides();
    else if (tabId === 'customers') loadAdminCustomers();
    else if (tabId === 'orders') loadAdminOrders();
    else if (tabId === 'livechats') loadAdminChatSessions();
    else if (tabId === 'tickets') loadAdminTickets();
    else if (tabId === 'settings') loadAdminSettings();

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
                <td class="py-3 px-6 text-right whitespace-nowrap">
                    <button onclick="openEditEbookModal(${b.id})" class="p-1.5 text-slate-400 hover:text-brand-400 rounded-lg hover:bg-slate-800 transition mr-1" title="Edit Ebook & Pricing">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteAdminEbook(${b.id})" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    } catch (e) {
        console.error('Ebooks load error', e);
    }
}

function openEditEbookModal(id) {
    const book = cachedEbooks.find(b => b.id === id);
    if (!book) return;

    document.getElementById('editEbookId').value = book.id;
    document.getElementById('editEbookTitle').value = book.title || '';
    document.getElementById('editEbookAuthor').value = book.author || '';
    document.getElementById('editEbookCategory').value = book.category || 'Technology';
    document.getElementById('editEbookPrice').value = book.price || '';
    document.getElementById('editEbookSalePrice').value = book.sale_price !== null && book.sale_price !== undefined ? book.sale_price : '';
    document.getElementById('editEbookGoogle').value = book.google_books_url || '';
    document.getElementById('editEbookKindle').value = book.kindle_url || '';
    document.getElementById('editEbookApple').value = book.apple_books_url || '';
    document.getElementById('editEbookDesc').value = book.description || '';
    document.getElementById('editEbookFeatured').checked = !!book.is_featured;

    openModal('editEbookModal');
}

async function handleEditEbookSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('updateEbookBtn');
    btn.disabled = true;
    btn.innerText = 'Saving Changes...';

    const id = document.getElementById('editEbookId').value;
    const saleVal = document.getElementById('editEbookSalePrice').value.trim();
    const payload = {
        title: document.getElementById('editEbookTitle').value.trim(),
        author: document.getElementById('editEbookAuthor').value.trim(),
        category: document.getElementById('editEbookCategory').value,
        price: parseFloat(document.getElementById('editEbookPrice').value),
        sale_price: saleVal ? parseFloat(saleVal) : null,
        google_books_url: document.getElementById('editEbookGoogle').value.trim() || null,
        kindle_url: document.getElementById('editEbookKindle').value.trim() || null,
        apple_books_url: document.getElementById('editEbookApple').value.trim() || null,
        description: document.getElementById('editEbookDesc').value.trim(),
        is_featured: document.getElementById('editEbookFeatured').checked
    };

    try {
        const res = await fetch(`/api/admin/ebooks/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            alert('🎉 Ebook and pricing updated successfully!');
            closeModal('editEbookModal');
            loadAdminEbooks();
        } else {
            alert(`⚠️ Update failed: ${data.detail || 'Could not update ebook'}`);
        }
    } catch (err) {
        console.error('Edit error', err);
        alert('Network error while updating ebook.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-1"></i><span>Save Ebook Changes</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
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

        let data;
        try {
            data = await res.json();
        } catch {
            data = { detail: `Server responded with status ${res.status}` };
        }

        if (res.ok) {
            alert(`🎉 Success: ${data.message || 'Ebook published successfully!'}`);
            document.getElementById('addEbookForm').reset();
            closeModal('addEbookModal');
            loadAdminEbooks();
        } else {
            if (res.status === 401) {
                alert('⚠️ Session expired. Please log in to admin panel again.');
                showLogin();
            } else if (res.status === 413) {
                alert('⚠️ File too large! On serverless cloud hosting, please upload files smaller than 4.5MB or use standard PDF formats.');
            } else {
                alert(`⚠️ Upload Error (${res.status}): ${data.detail || 'Upload failed. Please check your inputs.'}`);
            }
        }
    } catch (err) {
        console.error('Upload error', err);
        alert('Network/Server connection notice: Please try uploading again in a few seconds.');
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
                        `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">AI Review</span>` : 
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

let cachedSlides = [];

async function loadAdminSlides() {
    const tbody = document.getElementById('adminSlidesTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Loading hero slides...</td></tr>`;

    try {
        const res = await fetch('/api/admin/hero-slides', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        cachedSlides = data.slides || [];

        if (cachedSlides.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">No banner slides configured. Click "Add Hero Slide" above to create one.</td></tr>`;
            return;
        }

        tbody.innerHTML = cachedSlides.map(s => `
            <tr class="hover:bg-slate-900/60 transition">
                <td class="py-3 px-6">
                    <div class="space-y-1">
                        <img src="${s.desktop_image}" class="w-24 h-12 object-cover rounded-lg border border-slate-800 shadow-sm" alt="${s.title}">
                        <span class="text-[9px] text-slate-500 font-mono block">1400×520px</span>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <div class="space-y-1">
                        <img src="${s.mobile_image || s.desktop_image}" class="w-10 h-14 object-cover rounded-lg border border-slate-800 shadow-sm" alt="${s.title}">
                        <span class="text-[9px] text-slate-500 font-mono block">375×600px</span>
                    </div>
                </td>
                <td class="py-3 px-4">
                    ${s.badge_text ? `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-200 border border-slate-700 mb-1 inline-block">${s.badge_text}</span>` : ''}
                    <div class="font-bold text-white leading-snug">${s.title}</div>
                    <div class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">${s.subtitle}</div>
                </td>
                <td class="py-3 px-4">
                    <div class="space-y-1">
                        <span class="px-2 py-1 rounded bg-white text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 shadow-sm">
                            <i data-lucide="mouse-pointer" class="w-3 h-3"></i>
                            ${s.cta_text || 'CTA'}
                        </span>
                        <div class="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title="${s.cta_url}">
                            ${s.cta_url || '#'}
                        </div>
                    </div>
                </td>
                <td class="py-3 px-6 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="openEditSlideModal(${s.id})" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-700" title="Edit / Replace">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            <span>Replace</span>
                        </button>
                        <button onclick="deleteAdminSlide(${s.id})" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition" title="Delete">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    } catch (e) {
        console.error('Slides load error', e);
    }
}

function openAddSlideModal() {
    document.getElementById('slideForm').reset();
    document.getElementById('slideId').value = '';
    document.getElementById('slideModalTitle').innerText = 'Add Hero Banner Slide';
    document.getElementById('saveSlideBtnText').innerText = 'Save & Publish Banner';
    document.getElementById('slideCtaText').value = 'Explore Best Sellers';
    document.getElementById('slideCtaUrl').value = '/#catalog';
    document.getElementById('slideSortOrder').value = '0';
    openModal('slideModal');
}

function openEditSlideModal(slideId) {
    const slide = cachedSlides.find(s => s.id === slideId);
    if (!slide) return;

    document.getElementById('slideForm').reset();
    document.getElementById('slideId').value = slide.id;
    document.getElementById('slideModalTitle').innerText = 'Replace / Edit Hero Banner';
    document.getElementById('saveSlideBtnText').innerText = 'Update & Replace Banner';
    document.getElementById('slideTitle').value = slide.title || '';
    document.getElementById('slideSubtitle').value = slide.subtitle || '';
    document.getElementById('slideBadgeText').value = slide.badge_text || '';
    document.getElementById('slideCtaText').value = slide.cta_text || 'Explore Collection';
    document.getElementById('slideCtaUrl').value = slide.cta_url || '/#catalog';
    document.getElementById('slideDesktopUrl').value = slide.desktop_image || '';
    document.getElementById('slideMobileUrl').value = slide.mobile_image || '';
    document.getElementById('slideSortOrder').value = slide.sort_order || 0;

    openModal('slideModal');
}

async function handleSlideSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveSlideBtn');
    const slideId = document.getElementById('slideId').value.trim();
    const isEdit = !!slideId;

    btn.disabled = true;
    btn.innerHTML = `<span>Saving...</span>`;

    const formData = new FormData();
    formData.append('title', document.getElementById('slideTitle').value.trim());
    formData.append('subtitle', document.getElementById('slideSubtitle').value.trim());
    formData.append('badge_text', document.getElementById('slideBadgeText').value.trim());
    formData.append('cta_text', document.getElementById('slideCtaText').value.trim());
    formData.append('cta_url', document.getElementById('slideCtaUrl').value.trim());
    formData.append('sort_order', document.getElementById('slideSortOrder').value.trim() || '0');

    const deskFile = document.getElementById('slideDesktopFile').files[0];
    if (deskFile) formData.append('desktop_image_file', deskFile);
    formData.append('desktop_image_url', document.getElementById('slideDesktopUrl').value.trim());

    const mobFile = document.getElementById('slideMobileFile').files[0];
    if (mobFile) formData.append('mobile_image_file', mobFile);
    formData.append('mobile_image_url', document.getElementById('slideMobileUrl').value.trim());

    try {
        const url = isEdit ? `/api/admin/hero-slides/${slideId}` : '/api/admin/hero-slides';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: formData
        });

        const data = await res.json();
        if (res.ok && data.success) {
            alert(data.message || (isEdit ? 'Hero banner updated successfully!' : 'Hero banner added successfully!'));
            closeModal('slideModal');
            loadAdminSlides();
        } else {
            alert(data.detail || 'Failed to save banner slide.');
        }
    } catch (err) {
        console.error('Slide save error', err);
        alert('An error occurred while saving the banner.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span id="saveSlideBtnText">${isEdit ? 'Update & Replace Banner' : 'Save & Publish Banner'}</span>`;
        lucide.createIcons();
    }
}

async function deleteAdminSlide(id) {
    if (!confirm('Are you sure you want to delete this banner slide?')) return;
    try {
        const res = await fetch(`/api/admin/hero-slides/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
            loadAdminSlides();
        } else {
            alert('Failed to delete slide');
        }
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
                    <div class="font-mono font-bold text-slate-300">${o.order_code}</div>
                    <div class="text-[10px] text-slate-500">${new Date(o.created_at).toLocaleString()}</div>
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-white">${o.customer_name}</div>
                    <div class="text-[11px] text-slate-400">${o.customer_email}</div>
                </td>
                <td class="py-3 px-4 text-slate-200 font-medium">${o.ebook_title}</td>
                <td class="py-3 px-4 font-bold text-emerald-400">₹${o.amount.toFixed(2)}</td>
                <td class="py-3 px-4 font-mono text-xs text-slate-300">${o.coupon_code || '-'}</td>
                <td class="py-3 px-6 text-right">
                    <a href="/api/download/${o.access_token}" target="_blank" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-950 rounded-lg text-[11px] font-extrabold shadow-sm">Download</a>
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
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">Loading tickets...</td></tr>`;

    try {
        const res = await fetch('/api/admin/support-tickets', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const tickets = data.tickets || [];

        if (tickets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No support tickets recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = tickets.map(t => {
            const hasAttachment = t.attachment_file && t.attachment_file.trim().length > 0;
            const waUrl = t.whatsapp_reply_url || `https://wa.me/${(t.customer_phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${t.customer_name}, this is QELVORIA Support regarding your support ticket #${t.id}. How can we assist you?`)}`;

            return `
                <tr class="hover:bg-slate-900/60 transition">
                    <td class="py-3 px-6">
                        <div class="font-mono font-bold text-rose-400">#TICK-${t.id}</div>
                        <div class="text-[10px] text-slate-500">${new Date(t.created_at).toLocaleString()}</div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-bold text-white">${t.customer_name}</div>
                        <div class="text-[11px] text-slate-400 mb-1">${t.customer_email}</div>
                        ${t.customer_phone ? `
                            <a href="${waUrl}" target="_blank" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold hover:bg-emerald-900 transition">
                                <span>📱 ${t.customer_phone}</span>
                            </a>
                        ` : ''}
                    </td>
                    <td class="py-3 px-4 text-slate-300 text-xs max-w-xs">
                        ${t.order_code ? `<div class="font-mono text-[10px] text-brand-400 font-bold mb-0.5">Order/Ref: ${t.order_code}</div>` : ''}
                        <div class="line-clamp-3">${t.message}</div>
                    </td>
                    <td class="py-3 px-4">
                        ${hasAttachment ? `
                            <a href="${t.attachment_file}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold border border-slate-700 transition">
                                <span>📎 View File</span>
                            </a>
                        ` : `<span class="text-slate-500 text-xs italic">No attachment</span>`}
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'resolved' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}">
                            ${(t.status || 'open').toUpperCase()}
                        </span>
                    </td>
                    <td class="py-3 px-6 text-right space-x-1.5 whitespace-nowrap">
                        <button onclick="jumpToChatSession('${t.session_id || ''}', '${t.customer_email || ''}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1" title="Open live chat with customer">
                            <i data-lucide="message-square" class="w-3 h-3"></i>
                            <span>Chat</span>
                        </button>
                        ${t.status !== 'resolved' ? `
                            <button onclick="resolveAdminTicket(${t.id})" class="px-3 py-1 bg-white hover:bg-slate-200 text-slate-950 rounded-lg text-xs font-bold shadow-sm transition">Resolve & Deliver</button>
                        ` : `<span class="text-slate-500 text-xs font-semibold">Resolved</span>`}
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    } catch (e) {
        console.error('Tickets load error', e);
    }
}

function jumpToChatSession(sessionId, email) {
    switchTab('livechats');
    if (sessionId) {
        openAdminChatSession(sessionId);
    } else if (email) {
        const inp = document.getElementById('chatSessionSearch');
        if (inp) {
            inp.value = email;
            filterChatSessions();
        }
        if (cachedChatSessions.length > 0) {
            openAdminChatSession(cachedChatSessions[0].session_id);
        }
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
        const res = await fetch('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const s = data.settings || {};

        if (s.bank_account_no && document.getElementById('setting_bank_account_no')) document.getElementById('setting_bank_account_no').value = s.bank_account_no;
        if (s.bank_ifsc && document.getElementById('setting_bank_ifsc')) document.getElementById('setting_bank_ifsc').value = s.bank_ifsc;
        if (s.razorpay_key_id && document.getElementById('setting_razorpay_key_id')) document.getElementById('setting_razorpay_key_id').value = s.razorpay_key_id;

        // Announcement Banner
        if (document.getElementById('setting_announcement_enabled')) {
            document.getElementById('setting_announcement_enabled').checked = (s.announcement_enabled !== 'false' && s.announcement_enabled !== false);
        }
        if (document.getElementById('setting_announcement_text')) {
            document.getElementById('setting_announcement_text').value = s.announcement_text || '';
        }
        if (document.getElementById('setting_announcement_coupon')) {
            document.getElementById('setting_announcement_coupon').value = s.announcement_coupon || '';
        }
        if (document.getElementById('setting_announcement_link')) {
            document.getElementById('setting_announcement_link').value = s.announcement_link || '';
        }

        // Social Media Accounts
        if (document.getElementById('setting_social_instagram')) document.getElementById('setting_social_instagram').value = s.social_instagram || '';
        if (document.getElementById('setting_social_youtube')) document.getElementById('setting_social_youtube').value = s.social_youtube || '';
        if (document.getElementById('setting_social_twitter')) document.getElementById('setting_social_twitter').value = s.social_twitter || '';
        if (document.getElementById('setting_social_linkedin')) document.getElementById('setting_social_linkedin').value = s.social_linkedin || '';
        if (document.getElementById('setting_social_facebook')) document.getElementById('setting_social_facebook').value = s.social_facebook || '';
        if (document.getElementById('setting_social_telegram')) document.getElementById('setting_social_telegram').value = s.social_telegram || '';
        if (document.getElementById('setting_social_whatsapp')) document.getElementById('setting_social_whatsapp').value = s.social_whatsapp || '';
    } catch (e) {
        console.error('Settings load error', e);
    }
}

function clearSocialInput(inputId) {
    const el = document.getElementById(inputId);
    if (el) {
        el.value = '';
        el.focus();
    }
}

function clearAllSocialLinks() {
    if (confirm('Are you sure you want to clear/delete all social media links?')) {
        const ids = [
            'setting_social_instagram',
            'setting_social_youtube',
            'setting_social_twitter',
            'setting_social_linkedin',
            'setting_social_facebook',
            'setting_social_telegram',
            'setting_social_whatsapp'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
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
            bank_account_no: document.getElementById('setting_bank_account_no')?.value.trim() || '',
            bank_ifsc: document.getElementById('setting_bank_ifsc')?.value.trim() || '',
            razorpay_key_id: document.getElementById('setting_razorpay_key_id')?.value.trim() || '',
            announcement_enabled: document.getElementById('setting_announcement_enabled')?.checked ? 'true' : 'false',
            announcement_text: document.getElementById('setting_announcement_text')?.value.trim() || '',
            announcement_coupon: document.getElementById('setting_announcement_coupon')?.value.trim() || '',
            announcement_link: document.getElementById('setting_announcement_link')?.value.trim() || '',
            social_instagram: document.getElementById('setting_social_instagram')?.value.trim() || '',
            social_youtube: document.getElementById('setting_social_youtube')?.value.trim() || '',
            social_twitter: document.getElementById('setting_social_twitter')?.value.trim() || '',
            social_linkedin: document.getElementById('setting_social_linkedin')?.value.trim() || '',
            social_facebook: document.getElementById('setting_social_facebook')?.value.trim() || '',
            social_telegram: document.getElementById('setting_social_telegram')?.value.trim() || '',
            social_whatsapp: document.getElementById('setting_social_whatsapp')?.value.trim() || ''
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
            alert('Store settings & social links saved successfully! Live store updated.');
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

// ================= LIVE CUSTOMER CHAT DESK (ADMIN) =================

let activeChatSessionId = null;
let cachedChatSessions = [];
let chatDeskPollTimer = null;
let currentSessionData = null;

async function loadAdminChatSessions() {
    if (!adminToken) return;
    try {
        const res = await fetch('/api/admin/chat/sessions', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        cachedChatSessions = data.sessions || [];

        // Update Total Unread Badge in Sidebar
        const totalUnread = cachedChatSessions.reduce((acc, s) => acc + (s.unread_admin_count || 0), 0);
        const badge = document.getElementById('adminLiveChatUnreadBadge');
        if (badge) {
            if (totalUnread > 0) {
                badge.innerText = totalUnread;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        renderAdminChatSessionsList(cachedChatSessions);

        if (activeChatSessionId) {
            pollActiveChatMessages();
        }
    } catch (e) {
        console.error('Error loading chat sessions', e);
    }
}

function renderAdminChatSessionsList(sessions) {
    const listEl = document.getElementById('adminChatSessionsList');
    if (!listEl) return;

    if (sessions.length === 0) {
        listEl.innerHTML = `
            <div class="py-16 text-center text-slate-500 px-4">
                <i data-lucide="message-square" class="w-8 h-8 mx-auto mb-2 text-slate-700"></i>
                <div class="font-bold">No live chats yet</div>
                <div class="text-[11px] text-slate-500 mt-1">When visitors start chatting on your website, conversations will appear here in real-time.</div>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    listEl.innerHTML = sessions.map(s => {
        const isSelected = s.session_id === activeChatSessionId;
        const isTakeover = s.status === 'admin_joined';
        const isClosed = s.status === 'closed';
        const unread = s.unread_admin_count || 0;
        const hasTicket = !!s.latest_ticket_id;

        return `
            <div onclick="openAdminChatSession('${s.session_id}')" class="p-3.5 cursor-pointer transition flex items-start gap-3 ${isSelected ? 'bg-slate-900 border-l-4 border-emerald-500' : 'hover:bg-slate-900/50'}">
                <div class="relative w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                    <span>${(s.visitor_name || 'V').charAt(0).toUpperCase()}</span>
                    ${unread > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 text-[9px] font-extrabold rounded-full flex items-center justify-center">${unread}</span>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1 mb-0.5">
                        <span class="font-bold text-white truncate text-xs">${s.visitor_name || 'Visitor'}</span>
                        <span class="text-[10px] text-slate-500 whitespace-nowrap">${formatChatTime(s.last_activity)}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 truncate mb-1.5">${s.last_message || 'Started a conversation'}</p>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        ${hasTicket ? `
                            <span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-950 text-amber-300 border border-amber-800">
                                📋 Ticket #${s.latest_ticket_id}
                            </span>
                        ` : ''}
                        <span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold ${isTakeover ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : (isClosed ? 'bg-slate-800 text-slate-400' : 'bg-blue-950 text-blue-300 border border-blue-800')}">
                            ${isTakeover ? '🛡️ Live Joined' : (isClosed ? '🔒 Closed' : '🤖 AI Bot Active')}
                        </span>
                        <span class="text-[10px] text-slate-500 font-mono">${s.total_messages || 0} msgs</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function filterChatSessions() {
    const q = (document.getElementById('chatSessionSearch')?.value || '').toLowerCase().trim();
    if (!q) {
        renderAdminChatSessionsList(cachedChatSessions);
        return;
    }
    const filtered = cachedChatSessions.filter(s => 
        (s.visitor_name || '').toLowerCase().includes(q) ||
        (s.visitor_email || '').toLowerCase().includes(q) ||
        (s.last_message || '').toLowerCase().includes(q) ||
        (s.session_id || '').toLowerCase().includes(q)
    );
    renderAdminChatSessionsList(filtered);
}

function formatChatTime(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

let lastRenderedMessagesKey = '';
let activeChatForceScrollBottom = false;

async function openAdminChatSession(sessionId) {
    if (activeChatSessionId !== sessionId) {
        lastRenderedMessagesKey = '';
        activeChatForceScrollBottom = true;
    }
    activeChatSessionId = sessionId;
    
    // Toggle UI views
    const emptyState = document.getElementById('adminChatEmptyState');
    const activeView = document.getElementById('adminChatActiveView');
    if (emptyState) emptyState.classList.add('hidden');
    if (activeView) activeView.classList.remove('hidden');

    renderAdminChatSessionsList(cachedChatSessions);
    await pollActiveChatMessages();
}

async function pollActiveChatMessages() {
    if (!activeChatSessionId) return;

    try {
        const res = await fetch(`/api/admin/chat/sessions/${activeChatSessionId}/messages`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        currentSessionData = data.session || {};
        const messages = data.messages || [];

        // Update header details
        const visitorNameEl = document.getElementById('activeChatVisitorName');
        const visitorAvatarEl = document.getElementById('activeChatAvatar');
        const visitorContactEl = document.getElementById('activeChatVisitorContact');
        
        if (visitorNameEl) visitorNameEl.innerText = currentSessionData.visitor_name || 'Visitor';
        if (visitorAvatarEl) visitorAvatarEl.innerText = (currentSessionData.visitor_name || 'V').charAt(0).toUpperCase();
        if (visitorContactEl) visitorContactEl.innerText = `Session: ${currentSessionData.session_id} • ${currentSessionData.visitor_email || 'No email'}`;

        const isTakeover = currentSessionData.status === 'admin_joined';
        const badgeEl = document.getElementById('activeChatStatusBadge');
        const takeoverBtn = document.getElementById('toggleTakeoverBtn');
        const takeoverText = document.getElementById('takeoverBtnText');

        if (badgeEl) {
            if (isTakeover) {
                badgeEl.className = 'px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800';
                badgeEl.innerText = '🛡️ Live Support Joined';
            } else {
                badgeEl.className = 'px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-950 text-blue-300 border border-blue-800';
                badgeEl.innerText = '🤖 AI Bot Active';
            }
        }

        if (takeoverText) {
            takeoverText.innerText = isTakeover ? 'Hand Over to AI Bot' : 'Take Over Chat';
        }
        if (takeoverBtn) {
            takeoverBtn.className = isTakeover 
                ? 'px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5'
                : 'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5';
        }

        // Render messages
        const stream = document.getElementById('adminChatMessagesStream');
        if (!stream) return;

        const lastMsg = messages[messages.length - 1];
        const messagesKey = `${activeChatSessionId}_${messages.length}_${lastMsg?.id || ''}_${lastMsg?.message?.length || ''}`;
        const isNearBottom = (stream.scrollHeight - stream.scrollTop - stream.clientHeight) < 95;

        if (messagesKey !== lastRenderedMessagesKey) {
            lastRenderedMessagesKey = messagesKey;

            stream.innerHTML = messages.map(m => {
                const isVisitor = m.sender === 'visitor';
                const isAdmin = m.sender === 'admin';
                const isBot = m.sender === 'bot';
                const isTicketCard = (m.message || '').includes('SUPPORT TICKET SUBMITTED');

                let bubbleClass = 'bg-slate-900 border border-slate-800 text-slate-200';
                let alignClass = 'items-start';
                let senderLabel = '🤖 QELVORIA Assistant';

                if (isTicketCard) {
                    bubbleClass = 'bg-amber-950/40 border border-amber-800/80 text-amber-100 shadow-md';
                    alignClass = 'items-start';
                    senderLabel = `📋 Support Ticket Form (Customer)`;
                } else if (isVisitor) {
                    bubbleClass = 'bg-slate-800 border border-slate-700 text-white';
                    alignClass = 'items-start';
                    senderLabel = `👤 ${m.sender_name || 'Customer'}`;
                } else if (isAdmin) {
                    bubbleClass = 'bg-emerald-950/80 border border-emerald-700 text-emerald-100';
                    alignClass = 'items-end';
                    senderLabel = `🛡️ Support Specialist (You)`;
                }

                // Format markdown
                let formattedMsg = (m.message || '')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-amber-400 underline font-bold hover:text-amber-300 inline-flex items-center gap-1"><span>$1</span> ↗</a>')
                    .replace(/\n/g, '<br>');

                return `
                    <div class="flex flex-col ${alignClass} space-y-1">
                        <span class="text-[10px] font-bold text-slate-400 px-1">${senderLabel} • ${formatChatTime(m.created_at)}</span>
                        <div class="max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${bubbleClass}">
                            ${formattedMsg}
                        </div>
                    </div>
                `;
            }).join('');

            if (activeChatForceScrollBottom || isNearBottom) {
                setTimeout(() => {
                    stream.scrollTop = stream.scrollHeight;
                }, 10);
                activeChatForceScrollBottom = false;
            }
        }
    } catch (e) {
        console.error('Error polling chat messages', e);
    }
}

async function handleAdminReplySubmit(e) {
    if (e) e.preventDefault();
    if (!activeChatSessionId) return;

    const inp = document.getElementById('adminReplyInput');
    const msg = (inp?.value || '').trim();
    if (!msg) return;

    const btn = document.getElementById('adminSendReplyBtn');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`/api/admin/chat/sessions/${activeChatSessionId}/reply`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: msg, takeover: true })
        });

        if (res.ok) {
            if (inp) inp.value = '';
            activeChatForceScrollBottom = true;
            await pollActiveChatMessages();
            await loadAdminChatSessions();
        } else {
            alert('Failed to send reply');
        }
    } catch (err) {
        console.error('Admin reply error', err);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function toggleAdminTakeover() {
    if (!activeChatSessionId || !currentSessionData) return;
    const newStatus = currentSessionData.status === 'admin_joined' ? 'bot_active' : 'admin_joined';

    try {
        const res = await fetch(`/api/admin/chat/sessions/${activeChatSessionId}/status`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            await pollActiveChatMessages();
            await loadAdminChatSessions();
        }
    } catch (e) {
        console.error('Toggle takeover error', e);
    }
}

async function closeActiveChatSession() {
    if (!activeChatSessionId) return;
    if (!confirm('Close this chat conversation?')) return;

    try {
        await fetch(`/api/admin/chat/sessions/${activeChatSessionId}/status`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'closed' })
        });
        await pollActiveChatMessages();
        await loadAdminChatSessions();
    } catch (e) {}
}

async function sendTicketFormShortcut() {
    if (!activeChatSessionId) return;

    try {
        const res = await fetch(`/api/admin/chat/sessions/${activeChatSessionId}/send-ticket-form`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (res.ok) {
            await pollActiveChatMessages();
            await loadAdminChatSessions();
        } else {
            alert('Failed to send Ticket Form to customer');
        }
    } catch (e) {
        console.error('Send ticket form error', e);
    }
}

function setAdminQuickReply(text) {
    const inp = document.getElementById('adminReplyInput');
    if (inp) {
        inp.value = text;
        inp.focus();
    }
}

// Background poller for live chat in admin panel
if (!chatDeskPollTimer) {
    chatDeskPollTimer = setInterval(() => {
        if (adminToken) {
            loadAdminChatSessions();
        }
    }, 3500);
}
