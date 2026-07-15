import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------
// Firebase init
// ---------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------
// DOM refs
// ---------------------------------------------------------
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");

const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authError = document.getElementById("auth-error");
const authSubmit = document.getElementById("auth-submit");
const authTabs = document.querySelectorAll(".auth-tab");
const resetPasswordBtn = document.getElementById("reset-password");

const userEmailEl = document.getElementById("user-email");
const signOutBtn = document.getElementById("sign-out");

const entryListEl = document.getElementById("entry-list");
const emptyStateEl = document.getElementById("empty-state");
const newEntryBtn = document.getElementById("new-entry");
const searchInput = document.getElementById("search-entries");

const editorEmpty = document.getElementById("editor-empty");
const editor = document.getElementById("editor");
const entryTitleInput = document.getElementById("entry-title");
const entryDateEl = document.getElementById("entry-date");
const entryBodyInput = document.getElementById("entry-body");
const saveStatusEl = document.getElementById("save-status");
const deleteEntryBtn = document.getElementById("delete-entry");

const toastEl = document.getElementById("toast");

// ---------------------------------------------------------
// State
// ---------------------------------------------------------
let authMode = "signin"; // "signin" | "signup"
let currentUser = null;
let unsubscribeEntries = null;
let entries = []; // cached, live
let activeEntryId = null;
let saveTimer = null;

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function showToast(message, timeout = 3200) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toastEl.hidden = true), timeout);
}

function friendlyAuthError(err) {
  const code = err && err.code ? err.code : "";
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists for that email.",
    "auth/weak-password": "Password should be at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Try again in a moment.",
    "auth/missing-password": "Enter a password.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function snippetOf(body) {
  return (body || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// ---------------------------------------------------------
// Auth UI
// ---------------------------------------------------------
authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.mode;
    authTabs.forEach((t) => t.classList.toggle("active", t === tab));
    authSubmit.textContent = authMode === "signin" ? "Sign in" : "Create account";
    passwordInput.autocomplete = authMode === "signin" ? "current-password" : "new-password";
    authError.hidden = true;
  });
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.hidden = true;
  authSubmit.disabled = true;
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    if (authMode === "signin") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = friendlyAuthError(err);
    authError.hidden = false;
  } finally {
    authSubmit.disabled = false;
  }
});

resetPasswordBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    authError.textContent = "Enter your email above first, then tap this again.";
    authError.hidden = false;
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent.");
  } catch (err) {
    authError.textContent = friendlyAuthError(err);
    authError.hidden = false;
  }
});

signOutBtn.addEventListener("click", () => signOut(auth));

// ---------------------------------------------------------
// Auth state
// ---------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    authScreen.hidden = true;
    appScreen.hidden = false;
    userEmailEl.textContent = user.email;
    subscribeToEntries(user.uid);
  } else {
    appScreen.hidden = true;
    authScreen.hidden = false;
    if (unsubscribeEntries) unsubscribeEntries();
    entries = [];
    activeEntryId = null;
    renderEntryList();
    showEditorEmpty();
    authForm.reset();
  }
});

// ---------------------------------------------------------
// Firestore: entries live under users/{uid}/entries/{id}
// This path scoping, combined with the security rules in
// firestore.rules, is what keeps each user's entries private.
// ---------------------------------------------------------
function entriesCollection(uid) {
  return collection(db, "users", uid, "entries");
}

function subscribeToEntries(uid) {
  if (unsubscribeEntries) unsubscribeEntries();
  const q = query(entriesCollection(uid), orderBy("updatedAt", "desc"));
  unsubscribeEntries = onSnapshot(
    q,
    (snap) => {
      entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderEntryList();

      // keep editor in sync if the active entry changed remotely
      if (activeEntryId) {
        const active = entries.find((e) => e.id === activeEntryId);
        if (!active) {
          showEditorEmpty();
        }
      }
    },
    (err) => {
      console.error(err);
      showToast("Couldn't load entries. Check your connection.");
    }
  );
}

async function createEntry() {
  if (!currentUser) return;
  try {
    const ref = await addDoc(entriesCollection(currentUser.uid), {
      title: "",
      body: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    activeEntryId = ref.id;
    // Optimistically open the editor; onSnapshot will fill it in shortly.
    openEditorFor({ id: ref.id, title: "", body: "", updatedAt: null });
    entryTitleInput.focus();
  } catch (err) {
    console.error(err);
    showToast("Couldn't create a new entry.");
  }
}

function scheduleSave() {
  saveStatusEl.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveActiveEntry, 500);
}

async function saveActiveEntry() {
  if (!currentUser || !activeEntryId) return;
  try {
    const ref = doc(db, "users", currentUser.uid, "entries", activeEntryId);
    await updateDoc(ref, {
      title: entryTitleInput.value,
      body: entryBodyInput.value,
      updatedAt: serverTimestamp(),
    });
    saveStatusEl.textContent = "Saved";
  } catch (err) {
    console.error(err);
    saveStatusEl.textContent = "Not saved";
    showToast("Couldn't save your changes.");
  }
}

async function deleteActiveEntry() {
  if (!currentUser || !activeEntryId) return;
  const ok = confirm("Delete this entry? This can't be undone.");
  if (!ok) return;
  try {
    const ref = doc(db, "users", currentUser.uid, "entries", activeEntryId);
    await deleteDoc(ref);
    activeEntryId = null;
    showEditorEmpty();
    showToast("Entry deleted.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete this entry.");
  }
}

// ---------------------------------------------------------
// Entry list rendering
// ---------------------------------------------------------
function renderEntryList() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = term
    ? entries.filter(
        (e) =>
          (e.title || "").toLowerCase().includes(term) ||
          (e.body || "").toLowerCase().includes(term)
      )
    : entries;

  entryListEl.innerHTML = "";
  emptyStateEl.hidden = entries.length !== 0;

  filtered.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "entry-item" + (entry.id === activeEntryId ? " active" : "");
    li.dataset.id = entry.id;

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = entry.title && entry.title.trim() ? entry.title : "Untitled entry";

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = formatDate(entry.updatedAt);

    const snippet = document.createElement("p");
    snippet.className = "snippet";
    snippet.textContent = snippetOf(entry.body);

    li.append(title, meta, snippet);
    li.addEventListener("click", () => openEditorFor(entry));
    entryListEl.appendChild(li);
  });
}

searchInput.addEventListener("input", renderEntryList);
newEntryBtn.addEventListener("click", createEntry);
deleteEntryBtn.addEventListener("click", deleteActiveEntry);
entryTitleInput.addEventListener("input", scheduleSave);
entryBodyInput.addEventListener("input", scheduleSave);

// ---------------------------------------------------------
// Editor
// ---------------------------------------------------------
function showEditorEmpty() {
  editor.hidden = true;
  editorEmpty.hidden = false;
  activeEntryId = null;
  renderEntryList();
}

function openEditorFor(entry) {
  activeEntryId = entry.id;
  editorEmpty.hidden = true;
  editor.hidden = false;
  entryTitleInput.value = entry.title || "";
  entryBodyInput.value = entry.body || "";
  entryDateEl.textContent = entry.updatedAt ? formatDate(entry.updatedAt) : "New entry";
  saveStatusEl.textContent = "Saved";
  renderEntryList();
}

window.addEventListener("beforeunload", () => {
  if (saveTimer) saveActiveEntry();
});
