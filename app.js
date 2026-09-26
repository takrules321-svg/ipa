(() => {
  // ================= 1. FIREBASE CONFIGURATION =================
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  let db = null;
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch (e) {
    console.warn("Firebase running offline / local mode.", e);
  }

  // ================= GLOBAL STATE =================
  let state = {
    currentUser: null,
    societyName: "Siddhivinayak Society",
    heroSubtitle: "Maintenance, complaints, events and meetings — tracked live.",
    totalFlats: 120,
    societyFunds: 480000,
    monthlyDues: 3500,
    paymentDueDate: "10th of every month",
    paymentNotes: "Pay via UPI or Net Banking to avoid late fine.",
    customBills: [
      { id: "b1", title: "Monthly Maintenance Fee", amount: 3500, isVariable: false },
      { id: "b2", title: "Ganpati Utsav Contribution", amount: 1000, isVariable: true },
      { id: "b3", title: "Clubhouse Security Deposit", amount: 2000, isVariable: false }
    ],
    notices: [
      { id: "n1", title: "Annual General Meeting (AGM) Notice", content: "The AGM will take place on Oct 5th at 10:00 AM in the Main Hall.", date: "2026-09-20", mediaUrl: "", mediaType: "" }
    ],
    residents: [
      { id: "r1", name: "Taksheel", flat: "A-402", phone: "9876543210", role: "Resident", password: "sv2026", mediaUrl: "" },
      { id: "r3", name: "Admin User", flat: "A-101", phone: "9876543212", role: "Admin", password: "admin2026", mediaUrl: "" }
    ],
    complaints: [
      { id: "c1", title: "Lift B1 Maintenance", flat: "B-101", status: "Open", date: "2026-09-24", category: "Elevator", mediaUrl: "", mediaType: "" }
    ],
    events: [
      { id: "e1", title: "Ganesh Utsav Celebration", date: "2026-09-14", budget: "₹1,50,000", venue: "Main Clubhouse", status: "Upcoming", mediaUrl: "", mediaType: "" }
    ],
    meetings: [
      { id: "m1", title: "AGM Meeting", date: "2026-10-05", time: "10:00 AM", location: "Community Hall", organizer: "Secretary" }
    ],
    noticeCollapsed: false
  };

  const formatRupees = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  function showToast(msg) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.style.cssText = "background: #2c1810; color: #fff; padding: 0.8rem 1.2rem; border-radius: 8px; margin-top: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2);";
    toast.textContent = msg;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // File Converter
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve({ url: "", type: "" });
      const reader = new FileReader();
      reader.onload = () => {
        const isVideo = file.type.startsWith("video");
        resolve({ url: reader.result, type: isVideo ? "video" : "image" });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderMediaHTML(url, type) {
    if (!url) return '';
    if (type === 'video') {
      return `<video src="${url}" controls style="width: 100%; max-height: 220px; border-radius: 6px; margin: 0.5rem 0; background: #000;"></video>`;
    }
    return `<img src="${url}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 6px; margin: 0.5rem 0;" alt="Attachment" />`;
  }

  // Database Sync
  async function saveStateToFirestore() {
    if (!db) return;
    try {
      await db.collection("society").doc("appState").set(state);
      showToast("Updated and saved to Cloud Database!");
    } catch (err) {
      console.error("Firestore Save Error: ", err);
    }
  }

  async function loadStateFromFirestore() {
    if (!db) return;
    try {
      const doc = await db.collection("society").doc("appState").get();
      if (doc.exists) {
        const remoteData = doc.data();
        const currentUser = state.currentUser;
        state = { ...remoteData, currentUser };
        updateGlobalTextDisplays();
      }
    } catch (err) {
      console.error("Firestore Load Error: ", err);
    }
  }

  function downloadNoticeForAndroid(title, content, date) {
    const fileData = `========================================\n${state.societyName.toUpperCase()}\nOFFICIAL NOTICE\n========================================\n\nDate: ${date}\nTitle: ${title}\n\n${content}\n\n========================================\nIssued by Managing Committee`;
    const blob = new Blob([fileData], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notice.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Notice downloaded to device storage!");
  }

  // Initialization
  async function init() {
    setupEventListeners();
    await loadStateFromFirestore();
    updateGlobalTextDisplays();
  }

  function setupEventListeners() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleLogin();
      });
    }

    document.getElementById("login-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogin();
    });

    document.getElementById("logout-btn")?.addEventListener("click", handleLogout);

    document.querySelectorAll("#main-nav .tab-btn").forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    document.querySelectorAll(".close-modal").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modalId = e.target.getAttribute("data-close");
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = "none";
      });
    });
  }

  function updateGlobalTextDisplays() {
    document.querySelectorAll(".site-name-text").forEach(el => el.textContent = state.societyName);
  }

  // Auth Handler
  function handleLogin() {
    const identifierInput = document.getElementById("login-identifier");
    const passwordInput = document.getElementById("login-password");
    const errorEl = document.getElementById("login-error");

    if (!identifierInput || !passwordInput) return;

    const identifier = identifierInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();

    if (identifier === "admin" && password === "admin2026") {
      state.currentUser = { name: "Admin User", role: "Admin", flat: "A-101" };
    } else {
      const foundResident = state.residents.find(r => 
        r.flat.toLowerCase() === identifier || r.name.toLowerCase() === identifier
      );

      if (foundResident && (foundResident.password ? foundResident.password === password : password === "sv2026")) {
        state.currentUser = {
          name: foundResident.name,
          role: foundResident.role,
          flat: foundResident.flat
        };
      } else {
        if (errorEl) errorEl.style.display = "block";
        return;
      }
    }

    if (errorEl) errorEl.style.display = "none";
    document.getElementById("login-screen")?.classList.remove("active");
    document.getElementById("app-shell")?.classList.add("active");

    const nameEl = document.getElementById("current-user-name");
    const roleEl = document.getElementById("current-user-role");
    if (nameEl) nameEl.textContent = state.currentUser.name;
    if (roleEl) roleEl.textContent = state.currentUser.role;

    const adminTabBtn = document.querySelector('.tab-btn[data-tab="admin"]');
    if (adminTabBtn) {
      adminTabBtn.style.display = (state.currentUser.role === "Admin") ? "inline-block" : "none";
    }

    switchTab("dashboard");
  }

  function handleLogout() {
    state.currentUser = null;
    document.getElementById("app-shell")?.classList.remove("active");
    document.getElementById("login-screen")?.classList.add("active");
  }

  function switchTab(tabId) {
    document.querySelectorAll("#main-nav .tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabId));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `tab-${tabId}`));

    if (tabId === "dashboard") renderDashboard();
    if (tabId === "payments") renderPayments();
    if (tabId === "complaints") renderComplaints();
    if (tabId === "events") renderEvents();
    if (tabId === "meetings") renderMeetings();
    if (tabId === "admin") renderAdmin();
  }

  // Dashboard Tab
  function renderDashboard() {
    const panel = document.getElementById("tab-dashboard");
    if (!panel) return;
    const isAdmin = state.currentUser?.role === "Admin";
    const isCollapsed = state.noticeCollapsed;

    panel.innerHTML = `
      <div style="display: flex; gap: 1.5rem; align-items: flex-start; flex-direction: row;">
        <div style="width: ${isCollapsed ? '60px' : '340px'}; transition: width 0.3s ease; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem;">
            ${!isCollapsed ? '<h3 style="margin: 0; font-size: 1.1rem;">📢 Notice Board</h3>' : ''}
            <button id="btn-toggle-notice" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; cursor: pointer;">
              ${isCollapsed ? '➡️' : '⬅️ Collapse'}
            </button>
          </div>

          ${!isCollapsed ? `
            ${isAdmin ? `
              <div style="margin-bottom: 1rem; background: #fff8f0; padding: 0.8rem; border-radius: 6px; border: 1px solid var(--primary-saffron);">
                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">+ Publish Notice</h4>
                <form id="form-add-notice" style="display: grid; gap: 0.5rem;">
                  <input type="text" id="notice-title" placeholder="Notice Title" required style="width:100%; font-size:0.85rem; padding: 0.4rem;">
                  <textarea id="notice-content" placeholder="Details..." required rows="2" style="width:100%; font-size:0.85rem; padding: 0.4rem;"></textarea>
                  <label style="font-size: 0.75rem; font-weight: bold;">Attach Photo / Video:</label>
                  <input type="file" id="notice-file" accept="image/*,video/*" style="font-size:0.75rem;">
                  <button type="submit" style="font-size:0.8rem; padding:0.4rem; margin-top:0.3rem;">Publish</button>
                </form>
              </div>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 0.8rem; max-height: 550px; overflow-y: auto;">
              ${state.notices.length === 0 ? '<p style="font-size:0.85rem; color: var(--text-muted);">No notices posted.</p>' : ''}
              ${state.notices.map(n => `
                <div class="card" style="padding: 0.8rem; border-left: 3px solid var(--primary-saffron); background: #fafafa;">
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${n.date}</div>
                  <h4 style="margin: 0.2rem 0; font-size: 0.95rem;">${n.title}</h4>
                  <p style="font-size: 0.85rem; color: #444; margin-bottom: 0.4rem;">${n.content}</p>
                  
                  ${renderMediaHTML(n.mediaUrl, n.mediaType)}

                  <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top:0.4rem;">
                    <button class="btn-download-notice" data-title="${n.title}" data-content="${n.content}" data-date="${n.date}" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; background: #2e7d32; color: #fff;">📥 Download (Android)</button>
                    ${isAdmin ? `<button class="btn-delete-notice" data-id="${n.id}" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; background: #d32f2f; color: #fff;">Delete</button>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<div style="text-align: center; font-size: 1.2rem;">📢</div>'}
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; gap: 1.5rem;">
          <div class="card" style="background: linear-gradient(135deg, rgba(230,81,0,0.08) 0%, rgba(245,124,0,0.02) 100%); border-left: 5px solid var(--primary-saffron); padding: 1.5rem;">
            <h1 style="font-size: 2rem; color: var(--primary-saffron); margin-bottom: 0.4rem;">${state.societyName}</h1>
            <p style="color: var(--text-muted); font-size: 1rem;">${state.heroSubtitle}</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div class="card">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Total Apartments</div>
              <div style="font-size: 1.6rem; font-weight: 700;">${state.totalFlats} Units</div>
            </div>
            <div class="card" style="background: rgba(46, 125, 50, 0.05);">
              <div style="font-size: 0.85rem; color: #2e7d32;">Reserve Fund</div>
              <div style="font-size: 1.6rem; font-weight: 700; color: #1b5e20;">${formatRupees(state.societyFunds)}</div>
            </div>
            <div class="card">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Monthly Maintenance</div>
              <div style="font-size: 1.6rem; font-weight: 700;">${formatRupees(state.monthlyDues)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-toggle-notice")?.addEventListener("click", () => {
      state.noticeCollapsed = !state.noticeCollapsed;
      renderDashboard();
    });

    document.getElementById("form-add-notice")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("notice-file");
      const media = await readFileAsBase64(fileInput?.files[0]);

      state.notices.unshift({
        id: "n" + Date.now(),
        title: document.getElementById("notice-title").value,
        content: document.getElementById("notice-content").value,
        date: new Date().toISOString().split("T")[0],
        mediaUrl: media.url,
        mediaType: media.type
      });
      saveStateToFirestore();
      renderDashboard();
    });

    document.querySelectorAll(".btn-download-notice").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const { title, content, date } = e.target.dataset;
        downloadNoticeForAndroid(title, content, date);
      });
    });

    document.querySelectorAll(".btn-delete-notice").forEach(btn => {
      btn.addEventListener("click", (e) => {
        state.notices = state.notices.filter(n => n.id !== e.target.dataset.id);
        saveStateToFirestore();
        renderDashboard();
      });
    });
  }

  // Payments Tab
  function renderPayments() {
    const panel = document.getElementById("tab-payments");
    if (!panel) return;
    const isAdmin = state.currentUser?.role === "Admin";

    panel.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        ${isAdmin ? `
          <div class="card" style="background: #fff8f0; border: 1px dashed var(--primary-saffron);">
            <h3>⚙️ Admin Payment Settings & Create New Billing Category</h3>
            <form id="form-update-payment-config" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem; margin-top: 1rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 600;">Monthly Maintenance Fee (₹)</label>
                <input type="number" id="cfg-monthly-dues" value="${state.monthlyDues}" style="width: 100%; padding: 0.4rem;">
              </div>
              <div>
                <label style="font-size: 0.8rem; font-weight: 600;">Billing Cycle / Due Date</label>
                <input type="text" id="cfg-due-date" value="${state.paymentDueDate}" style="width: 100%; padding: 0.4rem;">
              </div>
              <div style="grid-column: 1 / -1;">
                <label style="font-size: 0.8rem; font-weight: 600;">Payment Guidelines / Notes</label>
                <input type="text" id="cfg-notes" value="${state.paymentNotes}" style="width: 100%; padding: 0.4rem;">
              </div>
              <button type="submit" style="grid-column: 1 / -1; width: fit-content;">Save Config</button>
            </form>

            <hr style="margin: 1.2rem 0; border: none; border-top: 1px solid var(--border-color);">

            <h4>➕ Add New Payment/Contribution Category</h4>
            <form id="form-add-bill-category" style="display: flex; gap: 0.8rem; align-items: flex-end; flex-wrap: wrap; margin-top: 0.5rem;">
              <div style="flex: 2; min-width: 180px;">
                <label style="font-size: 0.8rem; font-weight: 600;">Category Title</label>
                <input type="text" id="new-bill-title" placeholder="e.g. Ganpati Utsav Contribution" required style="padding: 0.4rem;">
              </div>
              <div style="flex: 1; min-width: 120px;">
                <label style="font-size: 0.8rem; font-weight: 600;">Default Amt (₹)</label>
                <input type="number" id="new-bill-amount" placeholder="1000" required style="padding: 0.4rem;">
              </div>
              <div style="display: flex; align-items: center; gap: 0.4rem; padding-bottom: 0.4rem;">
                <input type="checkbox" id="new-bill-variable" style="width: auto;">
                <label for="new-bill-variable" style="font-size: 0.8rem; font-weight: 600;">Allow Custom Variable Amount</label>
              </div>
              <button type="submit" style="padding: 0.5rem 1rem;">Add Bill Category</button>
            </form>
          </div>
        ` : ''}

        <div class="card" style="background: linear-gradient(135deg, #ffffff 0%, #fff8f0 100%); border: 1px solid var(--primary-gold);">
          <span style="font-size: 0.85rem; text-transform: uppercase; color: var(--primary-saffron); font-weight: 600;">Active Billing Cycle</span>
          <h2 style="margin-top: 0.2rem;">Main Maintenance: ${formatRupees(state.monthlyDues)}</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Due Date: <strong>${state.paymentDueDate}</strong></p>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.4rem;">ℹ️ ${state.paymentNotes}</p>
        </div>

        <div class="card">
          <h3>Payable Bills & Custom Contributions</h3>
          <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-top: 1rem;">
            ${state.customBills.map(b => `
              <div class="card" style="display: flex; justify-content: space-between; align-items: center; background: #fafafa; flex-wrap: wrap; gap: 0.8rem;">
                <div>
                  <strong>${b.title}</strong>${b.isVariable ? '<span style="font-size:0.75rem; background:#fff3e0; color:#e65100; padding:0.1rem 0.4rem; border-radius:4px; margin-left:0.5rem; border:1px solid #ffe0b2;">Variable Amount Allowed</span>' : ''}
                  <div style="color: var(--primary-saffron); font-weight: bold; margin-top: 0.2rem;">
                    Default: ${formatRupees(b.amount)}
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  ${b.isVariable ? `
                    <div style="display:flex; align-items:center; gap: 0.3rem;">
                      <span style="font-weight:bold; font-size:0.9rem;">₹</span>
                      <input type="number" id="input-amt-${b.id}" value="${b.amount}" placeholder="Enter amount" style="width: 100px; padding: 0.4rem; font-size:0.9rem;">
                    </div>
                  ` : ''}

                  <button class="btn-pay-item" data-id="${b.id}" data-title="${b.title}" data-isvariable="${b.isVariable ? 'true' : 'false'}" data-amount="${b.amount}" style="padding: 0.5rem 1rem;">Pay Now</button>
                  ${isAdmin ? `<button class="btn-delete-bill" data-id="${b.id}" style="background:#d32f2f; color:#fff; padding:0.5rem;">🗑️</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    if (isAdmin) {
      document.getElementById("form-update-payment-config")?.addEventListener("submit", (e) => {
        e.preventDefault();
        state.monthlyDues = parseFloat(document.getElementById("cfg-monthly-dues").value) || 0;
        state.paymentDueDate = document.getElementById("cfg-due-date").value;
        state.paymentNotes = document.getElementById("cfg-notes").value;
        saveStateToFirestore();
        renderPayments();
      });

      document.getElementById("form-add-bill-category")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = document.getElementById("new-bill-title").value;
        const amount = parseFloat(document.getElementById("new-bill-amount").value) || 0;
        const isVariable = document.getElementById("new-bill-variable").checked;

        state.customBills.push({
          id: "b" + Date.now(),
          title,
          amount,
          isVariable
        });

        saveStateToFirestore();
        renderPayments();
      });

      document.querySelectorAll(".btn-delete-bill").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const id = e.target.getAttribute("data-id");
          state.customBills = state.customBills.filter(b => b.id !== id);
          saveStateToFirestore();
          renderPayments();
        });
      });
    }

    document.querySelectorAll(".btn-pay-item").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-id");
        const title = e.target.getAttribute("data-title");
        const isVariable = e.target.getAttribute("data-isvariable") === "true";
        let finalAmount = parseFloat(e.target.getAttribute("data-amount")) || 0;

        if (isVariable) {
          const inputEl = document.getElementById(`input-amt-${id}`);
          if (inputEl && inputEl.value) {
            finalAmount = parseFloat(inputEl.value) || 0;
          }
        }

        if (finalAmount <= 0) {
          alert("Please enter a valid amount greater than ₹0.");
          return;
        }

        const modal = document.getElementById("payment-modal");
        const body = document.getElementById("payment-modal-body");
        if (modal && body) {
          body.innerHTML = `
            <p>Paying for: <strong>${title}</strong></p>
            <p style="font-size: 1.4rem; color: var(--primary-saffron); font-weight: bold; margin-top: 0.5rem;">Amount: ${formatRupees(finalAmount)}</p>
          `;
          modal.style.display = "block";
          
          document.getElementById("confirm-payment-btn").onclick = () => {
            state.societyFunds += finalAmount;
            modal.style.display = "none";
            showToast(`Payment of ${formatRupees(finalAmount)} successful for ${title}!`);
            saveStateToFirestore();
            renderPayments();
          };
        }
      });
    });
  }

  // Complaints Tab
  function renderComplaints() {
    const panel = document.getElementById("tab-complaints");
    if (!panel) return;
    const isAdmin = state.currentUser?.role === "Admin";

    panel.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <h2>Complaints & Service Tickets</h2>
          <button id="btn-raise-complaint">➕ Raise New Complaint</button>
        </div>

        <div id="new-complaint-form-container" class="card" style="display: none; background: #fff8f0;">
          <h3>Log a New Ticket</h3>
          <form id="form-create-complaint" style="display: grid; gap: 0.8rem; margin-top: 0.8rem;">
            <input type="text" id="complaint-title" placeholder="Brief issue title" required style="padding: 0.5rem;">
            <select id="complaint-category" style="padding: 0.5rem;">
              <option value="Plumbing">Plumbing</option>
              <option value="Elevator">Elevator</option>
              <option value="Electrical">Electrical</option>
              <option value="Security">Security</option>
            </select>
            <label style="font-size:0.85rem; font-weight:bold;">Attach Photo or Video Proof:</label>
            <input type="file" id="complaint-file" accept="image/*,video/*" style="font-size:0.85rem;">
            <button type="submit" style="width: fit-content;">Submit Ticket</button>
          </form>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${state.complaints.map(c => `
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.75rem; background: #eee; padding: 0.2rem 0.4rem; border-radius: 4px;">${c.category}</span>
                  <span style="font-size: 0.75rem; color: ${c.status === 'Resolved' ? 'green' : 'orange'}; font-weight: bold;">${c.status}</span>
                </div>
                <h3>${c.title}</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted);">Flat: ${c.flat}</p>${renderMediaHTML(c.mediaUrl, c.mediaType)}
              </div>
              <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                ${c.status !== 'Resolved' ? `<button class="btn-resolve-complaint secondary" data-id="${c.id}" style="font-size:0.8rem; flex:1;">Mark Resolved</button>` : ''}
                ${isAdmin ? `<button class="btn-delete-complaint" data-id="${c.id}" style="background:#d32f2f; color:#fff; font-size:0.8rem;">Delete</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById("btn-raise-complaint")?.addEventListener("click", () => {
      const form = document.getElementById("new-complaint-form-container");
      form.style.display = form.style.display === "none" ? "block" : "none";
    });

    document.getElementById("form-create-complaint")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("complaint-file");
      const media = await readFileAsBase64(fileInput?.files[0]);

      state.complaints.unshift({
        id: "c" + Date.now(),
        title: document.getElementById("complaint-title").value,
        category: document.getElementById("complaint-category").value,
        flat: state.currentUser ? state.currentUser.flat : "A-402",
        status: "Open",
        date: new Date().toISOString().split("T")[0],
        mediaUrl: media.url,
        mediaType: media.type
      });
      saveStateToFirestore();
      renderComplaints();
    });

    document.querySelectorAll(".btn-resolve-complaint").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const item = state.complaints.find(c => c.id === e.target.dataset.id);
        if (item) item.status = "Resolved";
        saveStateToFirestore();
        renderComplaints();
      });
    });

    document.querySelectorAll(".btn-delete-complaint").forEach(btn => {
      btn.addEventListener("click", (e) => {
        state.complaints = state.complaints.filter(c => c.id !== e.target.dataset.id);
        saveStateToFirestore();
        renderComplaints();
      });
    });
  }

  // Events Tab
  function renderEvents() {
    const panel = document.getElementById("tab-events");
    if (!panel) return;
    const isAdmin = state.currentUser?.role === "Admin";

    panel.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2>Society Events</h2>
          ${isAdmin ? `<button id="btn-add-event-toggle">➕ Add Event</button>` : ''}
        </div>

        ${isAdmin ? `
          <div id="add-event-form-container" class="card" style="display: none; background: #fff8f0;">
            <h3>Create Event</h3>
            <form id="form-create-event" style="display: grid; gap: 0.8rem; margin-top: 0.8rem;">
              <input type="text" id="event-title" placeholder="Event Name" required style="padding:0.4rem;">
              <input type="text" id="event-date" placeholder="Date (e.g. 2026-11-15)" required style="padding:0.4rem;">
              <input type="text" id="event-venue" placeholder="Venue" required style="padding:0.4rem;">
              <input type="text" id="event-budget" placeholder="Budget" required style="padding:0.4rem;">
              <label style="font-size:0.85rem; font-weight:bold;">Event Photo / Promo Video:</label>
              <input type="file" id="event-file" accept="image/*,video/*" style="font-size:0.85rem;">
              <button type="submit" style="width: fit-content;">Save Event</button>
            </form>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.2rem;">
          ${state.events.map(e => `
            <div class="card" style="border-top: 4px solid var(--primary-gold);">
              <h3>${e.title}</h3>
              <p style="font-size: 0.85rem; color: var(--text-muted);">Date: ${e.date} | Venue: ${e.venue}</p>${renderMediaHTML(e.mediaUrl, e.mediaType)}

              <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button style="flex:1;" onclick="alert('RSVP confirmed!')">🎉 RSVP</button>
                ${isAdmin ? `<button class="btn-delete-event" data-id="${e.id}" style="background:#d32f2f; color:#fff;">Delete</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (isAdmin) {
      document.getElementById("btn-add-event-toggle")?.addEventListener("click", () => {
        const c = document.getElementById("add-event-form-container");
        c.style.display = c.style.display === "none" ? "block" : "none";
      });

      document.getElementById("form-create-event")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fileInput = document.getElementById("event-file");
        const media = await readFileAsBase64(fileInput?.files[0]);

        state.events.push({
          id: "e" + Date.now(),
          title: document.getElementById("event-title").value,
          date: document.getElementById("event-date").value,
          venue: document.getElementById("event-venue").value,
          budget: document.getElementById("event-budget").value,
          status: "Upcoming",
          mediaUrl: media.url,
          mediaType: media.type
        });
        saveStateToFirestore();
        renderEvents();
      });

      document.querySelectorAll(".btn-delete-event").forEach(btn => {
        btn.addEventListener("click", (e) => {
          state.events = state.events.filter(ev => ev.id !== e.target.dataset.id);
          saveStateToFirestore();
          renderEvents();
        });
      });
    }
  }

  // Meetings Tab
  function renderMeetings() {
    const panel = document.getElementById("tab-meetings");
    if (!panel) return;
    const isAdmin = state.currentUser?.role === "Admin";

    panel.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2>Committee Meetings</h2>
          ${isAdmin ? `<button id="btn-add-meeting-toggle">➕ Schedule Meeting</button>` : ''}
        </div>

        ${isAdmin ? `
          <div id="add-meeting-form-container" class="card" style="display: none; background: #fff8f0;">
            <h3>Schedule Meeting</h3>
            <form id="form-create-meeting" style="display: grid; gap: 0.8rem; margin-top: 0.8rem;">
              <input type="text" id="meeting-title" placeholder="Title" required style="padding:0.4rem;">
              <input type="text" id="meeting-date" placeholder="Date" required style="padding:0.4rem;">
              <input type="text" id="meeting-time" placeholder="Time" required style="padding:0.4rem;">
              <input type="text" id="meeting-location" placeholder="Location" required style="padding:0.4rem;">
              <button type="submit" style="width: fit-content;">Save Meeting</button>
            </form>
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${state.meetings.map(m => `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3>${m.title}</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${m.date} at ${m.time} \vert{}${m.location}</p>
              </div>
              ${isAdmin ? `<button class="btn-delete-meeting" data-id="${m.id}" style="background:#d32f2f; color:#fff;">Delete</button>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (isAdmin) {
      document.getElementById("btn-add-meeting-toggle")?.addEventListener("click", () => {
        const c = document.getElementById("add-meeting-form-container");
        c.style.display = c.style.display === "none" ? "block" : "none";
      });

      document.getElementById("form-create-meeting")?.addEventListener("submit", (e) => {
        e.preventDefault();
        state.meetings.push({
          id: "m" + Date.now(),
          title: document.getElementById("meeting-title").value,
          date: document.getElementById("meeting-date").value,
          time: document.getElementById("meeting-time").value,
          location: document.getElementById("meeting-location").value,
          organizer: "Secretary"
        });
        saveStateToFirestore();
        renderMeetings();
      });

      document.querySelectorAll(".btn-delete-meeting").forEach(btn => {
        btn.addEventListener("click", (e) => {
          state.meetings = state.meetings.filter(m => m.id !== e.target.dataset.id);
          saveStateToFirestore();
          renderMeetings();
        });
      });
    }
  }

  // Master Admin Tab
  function renderAdmin() {
    const adminPanel = document.getElementById("tab-admin");
    if (!adminPanel) return;

    adminPanel.innerHTML = `
      <div style="max-width: 950px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        
        <div class="card" style="background: linear-gradient(135deg, rgba(230,81,0,0.1) 0%, rgba(245,124,0,0.02) 100%); border-left: 5px solid var(--primary-saffron);">
          <h2>⚙️ Master Admin Control Center</h2>
        </div>

        <!-- Site Branding -->
        <div class="card">
          <h3>🏷️ Site Branding Settings</h3>
          <form id="edit-branding-form" style="display: grid; gap: 0.8rem; margin-top: 0.8rem;">
            <div>
              <label style="font-size: 0.8rem; font-weight: bold;">Society Name:</label>
              <input type="text" id="input-society-name" value="${state.societyName}" style="width: 100%; padding: 0.4rem;" required>
            </div>
            <div>
              <label style="font-size: 0.8rem; font-weight: bold;">Hero Subtitle / Tagline:</label>
              <textarea id="input-hero-subtitle" rows="2" style="width: 100%; padding: 0.4rem;" required>${state.heroSubtitle}</textarea>
            </div>
            <button type="submit" style="width: fit-content; padding: 0.5rem 1rem;">Save Branding</button>
          </form>
        </div>

        <!-- Manage Residents & Set Passwords -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>👥 Resident Directory & Login Passwords</h3>
            <button id="btn-toggle-add-resident" style="padding: 0.4rem 0.8rem;">➕ Add Resident</button>
          </div>

          <div id="add-resident-form-container" style="display: none; background: #fff8f0; padding: 1rem; border-radius: 6px; border: 1px solid var(--primary-saffron); margin-bottom: 1rem;">
            <h4 style="margin-top: 0;">Add New Resident & Assign Credentials</h4>
            <form id="form-add-resident" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem;">
              <input type="text" id="res-name" placeholder="Full Name" required style="padding: 0.4rem;">
              <input type="text" id="res-flat" placeholder="Flat No (e.g. B-204)" required style="padding: 0.4rem;">
              <input type="text" id="res-phone" placeholder="Phone Number" required style="padding: 0.4rem;">
              <input type="password" id="res-password" placeholder="Set Login Password" required style="padding: 0.4rem;">
              <select id="res-role" style="padding: 0.4rem;">
                <option value="Resident">Resident</option>
                <option value="Admin">Admin</option>
              </select>
              <div style="grid-column: 1 / -1;">
                <label style="font-size: 0.8rem; font-weight: bold;">Resident Photo / ID Proof:</label>
                <input type="file" id="res-file" accept="image/*,video/*" style="font-size: 0.8rem; display: block; margin-top: 0.3rem;">
              </div>
              <button type="submit" style="grid-column: 1 / -1; width: fit-content; padding: 0.5rem 1.2rem;">Save Resident</button>
            </form>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <thead>
                <tr style="background: #f5f5f5; text-align: left;">
                  <th style="padding: 0.6rem;">Photo</th>
                  <th style="padding: 0.6rem;">Name</th>
                  <th style="padding: 0.6rem;">Flat</th>
                  <th style="padding: 0.6rem;">Phone</th>
                  <th style="padding: 0.6rem;">Password</th>
                  <th style="padding: 0.6rem;">Role</th>
                  <th style="padding: 0.6rem; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${state.residents.map(r => `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 0.6rem;">
                      ${r.mediaUrl ? `<img src="${r.mediaUrl}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">` : '👤'}
                    </td>
                    <td style="padding: 0.6rem; font-weight: 600;">${r.name}</td>
                    <td style="padding: 0.6rem;">${r.flat}</td>
                    <td style="padding: 0.6rem;">${r.phone}</td>
                    <td style="padding: 0.6rem; font-family: monospace;">${r.password || 'sv2026'}</td>
                    <td style="padding: 0.6rem;"><span style="background: ${r.role === 'Admin' ? '#e3f2fd' : '#f5f5f5'}; color: ${r.role === 'Admin' ? '#1976d2' : '#333'}; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${r.role}</span></td>
                    <td style="padding: 0.6rem; text-align: right;">
                      <button class="btn-delete-resident" data-id="${r.id}" style="background: #d32f2f; color:#fff; font-size: 0.75rem; padding: 0.3rem 0.6rem;">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    document.getElementById("edit-branding-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      state.societyName = document.getElementById("input-society-name").value;
      state.heroSubtitle = document.getElementById("input-hero-subtitle").value;
      updateGlobalTextDisplays();
      saveStateToFirestore();
      renderAdmin();
    });

    document.getElementById("btn-toggle-add-resident")?.addEventListener("click", () => {
      const container = document.getElementById("add-resident-form-container");
      if (container) container.style.display = container.style.display === "none" ? "block" : "none";
    });

    document.getElementById("form-add-resident")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("res-file");
      const media = await readFileAsBase64(fileInput?.files[0]);

      state.residents.push({
        id: "r" + Date.now(),
        name: document.getElementById("res-name").value,
        flat: document.getElementById("res-flat").value,
        phone: document.getElementById("res-phone").value,
        password: document.getElementById("res-password").value,
        role: document.getElementById("res-role").value,
        mediaUrl: media.url,
        mediaType: media.type
      });

      saveStateToFirestore();
      renderAdmin();
    });

    document.querySelectorAll(".btn-delete-resident").forEach(btn => {
      btn.addEventListener("click", (e) => {
        state.residents = state.residents.filter(r => r.id !== e.target.dataset.id);
        saveStateToFirestore();
        renderAdmin();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();