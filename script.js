// === CONFIG FIREBASE ===
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_MESSAGING_ID",
  appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// === ELEMENTOS ===
const addDebtorButton = document.getElementById("addDebtorButton");
const logoutButton = document.getElementById("logoutButton");
const themeToggleButton = document.getElementById("themeToggleButton");
const debtorsList = document.getElementById("debtorsList");
const addEditDebtorModal = document.getElementById("addEditDebtorModal");
const addEditDebtorForm = document.getElementById("addEditDebtorForm");
const closeButtons = document.querySelectorAll(".close-button");
const errorMessage = document.getElementById("errorMessage");
const user = auth.currentUser;

let editingDebtorId = null;
let debtors = [];

// === TEMA ===
themeToggleButton?.addEventListener("click", () => {
  document.body.classList.toggle("light-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("light-theme") ? "light" : "dark"
  );
});

window.addEventListener("load", () => {
  const theme = localStorage.getItem("theme");
  if (theme === "light") document.body.classList.add("light-theme");
});

// === LOGIN VALIDATION ===
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    loadDebtors();
  }
});

// === SAIR ===
logoutButton?.addEventListener("click", () => {
  auth.signOut();
});

// === FUNÇÕES DE MODAL ===
addDebtorButton?.addEventListener("click", () => {
  editingDebtorId = null;
  addEditDebtorForm.reset();
  document.getElementById("addEditModalTitle").textContent =
    "Adicionar Novo Devedor";
  openModal(addEditDebtorModal);
});

closeButtons.forEach((btn) =>
  btn.addEventListener("click", () => closeModal(btn.closest(".modal")))
);

window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) closeModal(e.target);
});

function openModal(modal) {
  modal.style.display = "flex";
}

function closeModal(modal) {
  modal.style.display = "none";
}

// === FORMATAR MOEDA ===
function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// === ADICIONAR/EDITAR DEVEDOR ===
addEditDebtorForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("debtorName").value;
  const description = document.getElementById("debtorDescription").value;
  const loanedAmount = parseFloat(document.getElementById("loanedAmount").value);
  const installments = parseInt(document.getElementById("installments").value);
  const frequency = document.getElementById("frequency").value;
  const startDate = document.getElementById("startDate").value;

  const calculationType = document.getElementById("calculationType").value;
  const amountPerInstallment = parseFloat(
    document.getElementById("amountPerInstallmentInput").value || 0
  );
  const interestPercentage = parseFloat(
    document.getElementById("interestPercentageInput").value || 0
  );

  let totalToReceive = 0;

  if (calculationType === "perInstallment") {
    totalToReceive = amountPerInstallment * installments;
  } else {
    totalToReceive = loanedAmount + (loanedAmount * interestPercentage) / 100;
  }

  const debtorData = {
    name,
    description,
    loanedAmount,
    installments,
    frequency,
    startDate,
    calculationType,
    amountPerInstallment,
    interestPercentage,
    totalToReceive,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    userId: auth.currentUser.uid,
  };

  try {
    if (editingDebtorId) {
      await db.collection("debtors").doc(editingDebtorId).update(debtorData);
    } else {
      await db.collection("debtors").add(debtorData);
    }
    closeModal(addEditDebtorModal);
  } catch (error) {
    console.error("Erro ao salvar devedor:", error);
  }
});

// === CARREGAR DEVEDORES ===
function loadDebtors() {
  db.collection("debtors")
    .where("userId", "==", auth.currentUser.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      debtors = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderDebtors();
      updateStats(); // Atualiza totais junto
    });
}

// === RENDERIZAR DEVEDORES ===
function renderDebtors() {
  debtorsList.innerHTML = "";

  if (debtors.length === 0) {
    debtorsList.innerHTML = `<p class="loading-message">Nenhum devedor encontrado.</p>`;
    return;
  }

  debtors.forEach((debtor) => {
    const item = document.createElement("div");
    item.classList.add("debtor-item");
    item.innerHTML = `
      <div class="debtor-info">
        <h2>${debtor.name}</h2>
        <p><strong>Valor Emprestado:</strong> ${formatCurrency(
          debtor.loanedAmount
        )}</p>
        <p><strong>Total a Receber:</strong> ${formatCurrency(
          debtor.totalToReceive
        )}</p>
        <p><strong>Parcelas:</strong> ${debtor.installments}</p>
      </div>
      <div class="debtor-actions">
        <button class="small-button edit-debtor-btn" data-id="${debtor.id}">Editar</button>
        <button class="small-button delete-debtor-btn" data-id="${debtor.id}">Excluir</button>
      </div>
    `;

    // Botões
    item.querySelector(".edit-debtor-btn").addEventListener("click", () => {
      editingDebtorId = debtor.id;
      document.getElementById("debtorName").value = debtor.name;
      document.getElementById("debtorDescription").value = debtor.description;
      document.getElementById("loanedAmount").value = debtor.loanedAmount;
      document.getElementById("installments").value = debtor.installments;
      document.getElementById("frequency").value = debtor.frequency;
      document.getElementById("startDate").value = debtor.startDate;
      document.getElementById("calculationType").value = debtor.calculationType;
      document.getElementById("amountPerInstallmentInput").value =
        debtor.amountPerInstallment;
      document.getElementById("interestPercentageInput").value =
        debtor.interestPercentage;
      openModal(addEditDebtorModal);
    });

    item.querySelector(".delete-debtor-btn").addEventListener("click", async () => {
      if (confirm(`Deseja excluir o devedor ${debtor.name}?`)) {
        await db.collection("debtors").doc(debtor.id).delete();
      }
    });

    debtorsList.appendChild(item);
  });
}

// === FUNÇÃO updateStats ===
function updateStats() {
  const totalLoanedAmountEl = document.getElementById("totalLoanedAmount");
  const activeClientsEl = document.getElementById("activeClients");
  const totalToReceiveEl = document.getElementById("totalToReceive");
  const toggleHideTotal = document.getElementById("toggleHideTotal");

  if (!debtors || debtors.length === 0) {
    totalLoanedAmountEl.textContent = "R$ 0,00";
    activeClientsEl.textContent = "0";
    totalToReceiveEl.textContent = "R$ 0,00";
    return;
  }

  let totalLoaned = 0;
  let totalToReceive = 0;

  debtors.forEach((d) => {
    totalLoaned += d.loanedAmount || 0;
    totalToReceive += d.totalToReceive || 0;
  });

  totalLoanedAmountEl.textContent = formatCurrency(totalLoaned);
  activeClientsEl.textContent = debtors.length;
  totalToReceiveEl.textContent = formatCurrency(totalToReceive);

  toggleHideTotal.addEventListener("change", () => {
    if (toggleHideTotal.checked) {
      totalToReceiveEl.style.filter = "blur(6px)";
    } else {
      totalToReceiveEl.style.filter = "none";
    }
  });
}

// === MENU DE 3 PONTOS ===
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggleButton");
  const menuDropdown = document.getElementById("menuDropdown");

  if (menuToggle && menuDropdown) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!menuDropdown.contains(e.target) && !menuToggle.contains(e.target)) {
        menuDropdown.classList.remove("active");
      }
    });
  }
});
