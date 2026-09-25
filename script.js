const landingView = document.getElementById("landingView");
const dashboardView = document.getElementById("dashboardView");
const openForm = document.getElementById("openForm");
const codeInput = document.getElementById("storeboxCode");
const createStoreBoxBtn = document.getElementById("createStoreBox");
const activeCodeLabel = document.getElementById("activeCodeLabel");
const toastContainer = document.getElementById("toastContainer");
const globalSearch = document.getElementById("globalSearch");
const fileInput = document.getElementById("fileInput");
const selectedFileMeta = document.getElementById("selectedFileMeta");
const uploadFileBtn = document.getElementById("uploadFileBtn");
const filesList = document.getElementById("filesList");
const fileSort = document.getElementById("fileSort");
const fileFolderMove = document.getElementById("fileFolderMove");
const noteTitle = document.getElementById("noteTitle");
const noteBody = document.getElementById("noteBody");
const saveNoteBtn = document.getElementById("saveNoteBtn");
const notesList = document.getElementById("notesList");
const noteFolderMove = document.getElementById("noteFolderMove");
const newNoteBtn = document.getElementById("newNoteBtn");
const newFolderName = document.getElementById("newFolderName");
const createFolderBtn = document.getElementById("createFolderBtn");
const foldersList = document.getElementById("foldersList");
const trashList = document.getElementById("trashList");
const clearTrashBtn = document.getElementById("clearTrashBtn");
const storageSummary = document.getElementById("storageSummary");
const storageProgress = document.getElementById("storageProgress");
const storageInfoText = document.getElementById("storageInfoText");
const newCodeInput = document.getElementById("newCode");
const changeCodeBtn = document.getElementById("changeCodeBtn");
const autoDeleteToggle = document.getElementById("autoDeleteToggle");
const themeToggle = document.getElementById("themeToggle");
const deleteStoreBoxBtn = document.getElementById("deleteStoreBoxBtn");
const toggleSidebarBtn = document.getElementById("toggleSidebar");
const sidebar = document.getElementById("sidebar");

const STOREBOX_PREFIX = "storebox_data_";
const APP_PREFS_KEY = "storebox_prefs";
const TOTAL_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;

let activeCode = "";
let activePanel = "filesPanel";
let editNoteId = null;

function createInitialStore() {
  return {
    files: [],
    notes: [],
    folders: [{ id: "root", name: "Root" }],
    trash: [],
    settings: {
      autoDelete: false,
      theme: "dark",
    },
  };
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

function storeKey(code) {
  return `${STOREBOX_PREFIX}${code}`;
}

function getStoreData() {
  const raw = localStorage.getItem(storeKey(activeCode));
  if (!raw) {
    const init = createInitialStore();
    setStoreData(init);
    return init;
  }
  return JSON.parse(raw);
}

function setStoreData(data) {
  localStorage.setItem(storeKey(activeCode), JSON.stringify(data));
}

function listStoreboxCodes() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(STOREBOX_PREFIX))
    .map((key) => key.replace(STOREBOX_PREFIX, ""));
}

function bytesToSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileTypeIcon(type) {
  if (type.includes("pdf")) return "📄";
  if (type.includes("image")) return "🖼️";
  if (type.includes("zip") || type.includes("compressed")) return "🗜️";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("text")) return "📃";
  if (type.includes("video")) return "🎬";
  return "📦";
}

function sanitizeCode(value) {
  return value.trim().replace(/\s+/g, "-");
}

async function hashCode(code) {
  const encoded = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return hashBuffer;
}

async function encryptText(plainText, code) {
  // Demo-only encryption: uses the StoreBox code to derive a local browser key.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await hashCode(code);
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText)
  );
  return {
    iv: Array.from(iv),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
}

async function decryptText(cipherObject, code) {
  const keyMaterial = await hashCode(code);
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const binary = atob(cipherObject.data);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(cipherObject.iv) },
    key,
    bytes
  );
  return new TextDecoder().decode(decrypted);
}

function setTheme(theme) {
  document.body.classList.toggle("light-mode", theme === "light");
  themeToggle.checked = theme !== "light";
}

function applyAppPrefs() {
  const raw = localStorage.getItem(APP_PREFS_KEY);
  if (!raw) return;
  const prefs = JSON.parse(raw);
  if (prefs.theme) {
    document.body.classList.toggle("light-mode", prefs.theme === "light");
  }
}

function saveAppPrefs(theme) {
  localStorage.setItem(APP_PREFS_KEY, JSON.stringify({ theme }));
}

function switchPanel(panelId) {
  activePanel = panelId;
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active-panel", panel.id === panelId);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelId);
  });
}

function updateFolderSelectors(data) {
  const options = data.folders
    .map((folder) => `<option value="${folder.id}">${folder.name}</option>`)
    .join("");
  fileFolderMove.innerHTML = options;
  noteFolderMove.innerHTML = options;
}

function renderFiles(data) {
  const query = globalSearch.value.trim().toLowerCase();
  const sorter = fileSort.value;
  let filtered = data.files.filter((file) => !query || file.name.toLowerCase().includes(query));

  if (sorter === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sorter === "size") filtered.sort((a, b) => b.size - a.size);
  if (sorter === "newest") filtered.sort((a, b) => b.createdAt - a.createdAt);

  if (filtered.length === 0) {
    filesList.innerHTML = '<p class="muted">No files found.</p>';
    return;
  }

  filesList.innerHTML = filtered
    .map((file) => {
      const folderName = data.folders.find((f) => f.id === file.folderId)?.name || "Root";
      return `
      <article class="item-card">
        <div class="item-top">
          <strong><span class="file-icon">${fileTypeIcon(file.type)}</span>${file.name}</strong>
          <span class="muted">${bytesToSize(file.size)} • ${folderName}</span>
        </div>
        <div class="muted">Type: ${file.type || "unknown"}</div>
        <div class="item-actions">
          <div class="inline-tools">
            <button class="btn btn-secondary" data-action="download-file" data-id="${file.id}">Download</button>
            <button class="btn btn-secondary" data-action="rename-file" data-id="${file.id}">Rename</button>
            <button class="btn btn-secondary" data-action="move-file" data-id="${file.id}">Move</button>
            <button class="btn btn-danger" data-action="delete-file" data-id="${file.id}">Delete</button>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

async function renderNotes(data) {
  const query = globalSearch.value.trim().toLowerCase();
  const filtered = data.notes.filter((note) => !query || note.title.toLowerCase().includes(query));

  if (filtered.length === 0) {
    notesList.innerHTML = '<p class="muted">No notes found.</p>';
    return;
  }

  const noteRows = await Promise.all(
    filtered.map(async (note) => {
      let preview = "Encrypted preview unavailable";
      try {
        const decrypted = await decryptText(note.encrypted, activeCode);
        preview = `${decrypted.slice(0, 90)}${decrypted.length > 90 ? "..." : ""}`;
      } catch (error) {
        preview = "Unable to decrypt with this code";
      }
      return `
      <article class="item-card">
        <div class="item-top">
          <strong>${note.title}</strong>
          <span class="muted">${new Date(note.updatedAt).toLocaleString()} • ${
            data.folders.find((f) => f.id === note.folderId)?.name || "Root"
          }</span>
        </div>
        <p class="muted">${preview || "(empty note)"}</p>
        <div class="item-actions">
          <div class="inline-tools">
            <button class="btn btn-secondary" data-action="open-note" data-id="${note.id}">Open</button>
            <button class="btn btn-secondary" data-action="move-note" data-id="${note.id}">Move</button>
            <button class="btn btn-secondary" data-action="rename-note" data-id="${note.id}">Rename</button>
            <button class="btn btn-danger" data-action="delete-note" data-id="${note.id}">Delete</button>
          </div>
        </div>
      </article>`;
    })
  );

  notesList.innerHTML = noteRows.join("");
}

function renderFolders(data) {
  const realFolders = data.folders.filter((folder) => folder.id !== "root");
  if (realFolders.length === 0) {
    foldersList.innerHTML = '<p class="muted">No folders yet. Create your first folder.</p>';
    return;
  }

  foldersList.innerHTML = realFolders
    .map(
      (folder) => `
    <article class="item-card">
      <div class="item-top">
        <strong>📁 ${folder.name}</strong>
      </div>
      <div class="item-actions">
        <div class="inline-tools">
          <button class="btn btn-secondary" data-action="rename-folder" data-id="${folder.id}">Rename</button>
          <button class="btn btn-danger" data-action="delete-folder" data-id="${folder.id}">Delete</button>
        </div>
      </div>
    </article>`
    )
    .join("");
}

function renderTrash(data) {
  if (data.trash.length === 0) {
    trashList.innerHTML = '<p class="muted">Trash is empty.</p>';
    return;
  }

  trashList.innerHTML = data.trash
    .map(
      (item) => `
    <article class="item-card">
      <div class="item-top">
        <strong>${item.name || item.title}</strong>
        <span class="muted">${item.kind}</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary" data-action="restore-trash" data-id="${item.id}" data-kind="${item.kind}">Restore</button>
      </div>
    </article>`
    )
    .join("");
}

function updateStorage(data) {
  const bytes =
    data.files.reduce((sum, file) => sum + (file.size || 0), 0) +
    data.notes.reduce((sum, note) => sum + (note.encrypted?.data?.length || 0), 0);
  const percent = Math.min((bytes / TOTAL_STORAGE_BYTES) * 100, 100);
  storageSummary.textContent = `${bytesToSize(bytes)} / 10 GB`;
  storageInfoText.textContent = `This StoreBox currently uses ${bytesToSize(bytes)}.`;
  storageProgress.style.width = `${percent.toFixed(2)}%`;
}

async function renderAll() {
  // Centralized render keeps every panel and summary in sync after any action.
  const data = getStoreData();
  updateFolderSelectors(data);
  renderFiles(data);
  await renderNotes(data);
  renderFolders(data);
  renderTrash(data);
  updateStorage(data);
  autoDeleteToggle.checked = Boolean(data.settings.autoDelete);
  setTheme(data.settings.theme || "dark");
}

function openDashboard(code) {
  activeCode = code;
  activeCodeLabel.textContent = `Code: ${code}`;
  landingView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  switchPanel("filesPanel");
  renderAll();
}

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

async function handleFileUpload() {
  const selected = fileInput.files[0];
  if (!selected) {
    showToast("Choose a file first.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = getStoreData();
      data.files.push({
        id: createId(),
        name: selected.name,
        size: selected.size,
        type: selected.type || "application/octet-stream",
        content: reader.result,
        folderId: "root",
        createdAt: Date.now(),
      });
      setStoreData(data);
      fileInput.value = "";
      selectedFileMeta.textContent = "No file selected";
      await renderAll();
      showToast("File uploaded.");
    } catch (error) {
      showToast("Could not upload file. Local storage may be full.");
    }
  };
  reader.readAsDataURL(selected);
}

async function saveOrUpdateNote() {
  const title = noteTitle.value.trim();
  const text = noteBody.value.trim();
  if (!title || !text) {
    showToast("Add title and text for your note.");
    return;
  }

  const encrypted = await encryptText(text, activeCode);
  const data = getStoreData();

  if (editNoteId) {
    const target = data.notes.find((note) => note.id === editNoteId);
    if (target) {
      target.title = title;
      target.encrypted = encrypted;
      target.updatedAt = Date.now();
      showToast("Note updated.");
    }
  } else {
    data.notes.push({
      id: createId(),
      title,
      encrypted,
      folderId: "root",
      updatedAt: Date.now(),
    });
    showToast("Note encrypted and saved.");
  }

  setStoreData(data);
  editNoteId = null;
  noteTitle.value = "";
  noteBody.value = "";
  await renderAll();
}

function moveToTrash(data, kind, item) {
  data.trash.push({ ...item, kind });
}

async function handleListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id, kind } = button.dataset;
  const data = getStoreData();

  if (action === "download-file") {
    const file = data.files.find((entry) => entry.id === id);
    if (!file) return;
    const link = document.createElement("a");
    link.href = file.content;
    link.download = file.name;
    link.click();
    showToast("Download started.");
  }

  if (action === "rename-file") {
    const file = data.files.find((entry) => entry.id === id);
    if (!file) return;
    const nextName = prompt("Rename file", file.name);
    if (nextName && nextName.trim()) {
      file.name = nextName.trim();
      setStoreData(data);
      await renderAll();
      showToast("File renamed.");
    }
  }

  if (action === "move-file") {
    const file = data.files.find((entry) => entry.id === id);
    if (!file) return;
    file.folderId = fileFolderMove.value || "root";
    setStoreData(data);
    await renderAll();
    showToast("File moved.");
  }

  if (action === "delete-file") {
    const file = data.files.find((entry) => entry.id === id);
    data.files = data.files.filter((entry) => entry.id !== id);
    if (file) moveToTrash(data, "file", file);
    setStoreData(data);
    await renderAll();
    showToast("File moved to trash.");
  }

  if (action === "open-note") {
    const note = data.notes.find((entry) => entry.id === id);
    if (!note) return;
    noteTitle.value = note.title;
    try {
      noteBody.value = await decryptText(note.encrypted, activeCode);
      editNoteId = id;
      switchPanel("notesPanel");
      showToast("Note opened.");
    } catch (error) {
      showToast("Unable to decrypt this note.");
    }
  }

  if (action === "rename-note") {
    const note = data.notes.find((entry) => entry.id === id);
    if (!note) return;
    const nextTitle = prompt("Rename note", note.title);
    if (nextTitle && nextTitle.trim()) {
      note.title = nextTitle.trim();
      note.updatedAt = Date.now();
      setStoreData(data);
      await renderAll();
      showToast("Note renamed.");
    }
  }

  if (action === "move-note") {
    const note = data.notes.find((entry) => entry.id === id);
    if (!note) return;
    note.folderId = noteFolderMove.value || "root";
    note.updatedAt = Date.now();
    setStoreData(data);
    await renderAll();
    showToast("Note moved.");
  }

  if (action === "delete-note") {
    const note = data.notes.find((entry) => entry.id === id);
    data.notes = data.notes.filter((entry) => entry.id !== id);
    if (note) moveToTrash(data, "note", note);
    setStoreData(data);
    await renderAll();
    showToast("Note moved to trash.");
  }

  if (action === "rename-folder") {
    const folder = data.folders.find((entry) => entry.id === id);
    if (!folder) return;
    const nextName = prompt("Rename folder", folder.name);
    if (nextName && nextName.trim()) {
      folder.name = nextName.trim();
      setStoreData(data);
      await renderAll();
      showToast("Folder renamed.");
    }
  }

  if (action === "delete-folder") {
    const folderId = id;
    data.folders = data.folders.filter((entry) => entry.id !== folderId);
    data.files.forEach((file) => {
      if (file.folderId === folderId) file.folderId = "root";
    });
    setStoreData(data);
    await renderAll();
    showToast("Folder deleted. Files moved to Root.");
  }

  if (action === "restore-trash") {
    const item = data.trash.find((entry) => entry.id === id && entry.kind === kind);
    data.trash = data.trash.filter((entry) => !(entry.id === id && entry.kind === kind));
    if (item?.kind === "file") data.files.push(item);
    if (item?.kind === "note") data.notes.push(item);
    setStoreData(data);
    await renderAll();
    showToast("Item restored.");
  }
}

function initEvents() {
  openForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = sanitizeCode(codeInput.value);
    if (!code) {
      showToast("Please enter a valid StoreBox code.");
      return;
    }
    openDashboard(code);
  });

  createStoreBoxBtn.addEventListener("click", () => {
    const code = prompt("Choose a new StoreBox code");
    const safeCode = sanitizeCode(code || "");
    if (!safeCode) {
      showToast("StoreBox code is required.");
      return;
    }
    if (listStoreboxCodes().includes(safeCode)) {
      showToast("This code already exists. Open it instead.");
      return;
    }
    activeCode = safeCode;
    setStoreData(createInitialStore());
    showToast("StoreBox created.");
    openDashboard(safeCode);
  });

  fileInput.addEventListener("change", () => {
    const selected = fileInput.files[0];
    if (!selected) {
      selectedFileMeta.textContent = "No file selected";
      return;
    }
    selectedFileMeta.textContent = `${selected.name} • ${selected.type || "unknown type"} • ${bytesToSize(
      selected.size
    )}`;
  });

  uploadFileBtn.addEventListener("click", handleFileUpload);
  saveNoteBtn.addEventListener("click", saveOrUpdateNote);
  newNoteBtn.addEventListener("click", () => {
    editNoteId = null;
    noteTitle.value = "";
    noteBody.value = "";
    showToast("Ready for a new note.");
  });

  createFolderBtn.addEventListener("click", async () => {
    const folderName = newFolderName.value.trim();
    if (!folderName) {
      showToast("Folder name is required.");
      return;
    }
    const data = getStoreData();
    data.folders.push({ id: createId(), name: folderName });
    setStoreData(data);
    newFolderName.value = "";
    await renderAll();
    showToast("Folder created.");
  });

  clearTrashBtn.addEventListener("click", async () => {
    const data = getStoreData();
    data.trash = [];
    setStoreData(data);
    await renderAll();
    showToast("Trash cleared.");
  });

  changeCodeBtn.addEventListener("click", () => {
    const newCode = sanitizeCode(newCodeInput.value);
    if (!newCode) {
      showToast("Enter a valid new code.");
      return;
    }
    if (newCode === activeCode) {
      showToast("New code must be different.");
      return;
    }
    if (listStoreboxCodes().includes(newCode)) {
      showToast("That code already exists.");
      return;
    }

    const data = getStoreData();
    localStorage.setItem(storeKey(newCode), JSON.stringify(data));
    localStorage.removeItem(storeKey(activeCode));
    openDashboard(newCode);
    newCodeInput.value = "";
    showToast("StoreBox code updated.");
  });

  autoDeleteToggle.addEventListener("change", async () => {
    const data = getStoreData();
    data.settings.autoDelete = autoDeleteToggle.checked;
    setStoreData(data);
    await renderAll();
    showToast("Auto-delete setting updated.");
  });

  themeToggle.addEventListener("change", async () => {
    const data = getStoreData();
    data.settings.theme = themeToggle.checked ? "dark" : "light";
    setStoreData(data);
    saveAppPrefs(data.settings.theme);
    await renderAll();
    showToast("Theme updated.");
  });

  deleteStoreBoxBtn.addEventListener("click", () => {
    if (!confirm("Delete this StoreBox and all demo data?")) return;
    localStorage.removeItem(storeKey(activeCode));
    activeCode = "";
    dashboardView.classList.add("hidden");
    landingView.classList.remove("hidden");
    codeInput.value = "";
    showToast("StoreBox deleted.");
  });

  globalSearch.addEventListener("input", () => {
    renderAll();
  });

  fileSort.addEventListener("change", () => {
    renderAll();
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      switchPanel(button.dataset.panel);
      if (window.innerWidth <= 1024) sidebar.classList.remove("open");
    });
  });

  [filesList, notesList, foldersList, trashList].forEach((container) => {
    container.addEventListener("click", handleListAction);
  });

  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

function init() {
  applyAppPrefs();
  initEvents();
}

init();
