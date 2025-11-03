// --- Lógica de Alternância de Tema ---
const themeToggleButton = document.getElementById('themeToggleButton');
const body = document.body;

function applyTheme(theme) {
    if (theme === 'light') {
        body.classList.add('light-theme');
    } else {
        body.classList.remove('light-theme');
    }
    localStorage.setItem('themePreference', theme);
}

// Carrega o tema salvo, se houver, ou aplica o padrão 'dark'
const savedTheme = localStorage.getItem('themePreference');
if (savedTheme) {
    applyTheme(savedTheme);
} else {
    applyTheme('dark'); // Tema padrão se nenhum for salvo
}

// Listener para o botão de alternar tema (se existir na página)
if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
        if (body.classList.contains('light-theme')) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
    });
}

// --- Configuração e Inicialização do Firebase ---
// ATENÇÃO: Substitua os valores abaixo pelas suas credenciais reais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAEZVCbz39BiqTj5f129PcrVHxfS6OnzLc",
    authDomain: "gerenciadoremprestimos.firebaseapp.com",
    projectId: "gerenciadoremprestimos",
    storageBucket: "gerenciadoremprestimos.firebasestorage.app",
    messagingSenderId: "365273574213",
    appId: "1:365273574213:web:043b8a1c6a2c0c7a87e53f"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUserId = null;
let debtors = [];
let currentFilter = 'all';

// --- Funções Auxiliares ---

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    // Verifica se é um objeto Timestamp do Firebase
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') return 'R$ 0,00';
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calculateRemaining(debtor) {
    const totalPaid = debtor.payments.reduce((sum, p) => sum + p.amount, 0);
    return debtor.totalDebt - totalPaid;
}

function showError(message, elementId = 'errorMessage') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// NOVO: Função para atualizar o estado ativo dos botões de filtro
function updateFilterButtons(activeButtonId) {
    const filterButtons = document.querySelectorAll('.filter-actions .button');
    filterButtons.forEach(button => {
        button.classList.remove('active');
    });
    const activeButton = document.getElementById(activeButtonId);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}


// --- Lógica de Renderização do Dashboard ---

function renderDebtors() {
    const debtorsList = document.getElementById('debtorsList');
    if (!debtorsList) return;

    debtorsList.innerHTML = '';
    
    // Filtra os devedores com base no filtro atual
    const filteredDebtors = debtors.filter(debtor => {
        const remaining = calculateRemaining(debtor);
        if (currentFilter === 'all') {
            return true;
        } else if (currentFilter === 'daily') {
            return debtor.frequency === 'daily' && remaining > 0;
        } else if (currentFilter === 'weekly') {
            return debtor.frequency === 'weekly' && remaining > 0;
        } else if (currentFilter === 'monthly') {
            return debtor.frequency === 'monthly' && remaining > 0;
        }
        return false;
    });

    if (filteredDebtors.length === 0) {
        debtorsList.innerHTML = `<p class="loading-message">Nenhum devedor encontrado para o filtro atual.</p>`;
        return;
    }

    filteredDebtors.forEach(debtor => {
        const remaining = calculateRemaining(debtor);
        const totalPaid = debtor.totalDebt - remaining;

        const debtorItem = document.createElement('div');
        debtorItem.className = 'debtor-item';
        debtorItem.dataset.id = debtor.id;
        debtorItem.innerHTML = `
            <h3>${debtor.name}</h3>
            <p><strong>Dívida:</strong> ${formatCurrency(debtor.totalDebt)}</p>
            <p><strong>Pago:</strong> ${formatCurrency(totalPaid)}</p>
            <p><strong>Restante:</strong> <span style="color: ${remaining > 0 ? 'var(--error-color)' : 'var(--success-color)'}; font-weight: 700;">${formatCurrency(remaining)}</span></p>
            <p><strong>Frequência:</strong> ${debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal'}</p>
        `;
        debtorItem.addEventListener('click', () => openDetailModal(debtor));
        debtorsList.appendChild(debtorItem);
    });
}

// --- Funções de CRUD (Firebase Firestore) ---

function setupFirestoreListener() {
    if (!currentUserId) return;

    // Define o listener em tempo real (onSnapshot)
    db.collection('users').doc(currentUserId).collection('debtors')
        .onSnapshot(snapshot => {
            debtors = [];
            snapshot.forEach(doc => {
                debtors.push({ id: doc.id, ...doc.data() });
            });
            renderDebtors();
        }, error => {
            console.error('Erro ao buscar devedores:', error);
            showError('Erro ao carregar dados. Tente recarregar a página.');
        });
}


// --- Lógica do Modal de Detalhes ---

const detailModal = document.getElementById('debtorDetailModal');
const closeDetailButton = document.getElementById('closeDetailModal');
const addPaymentButton = document.getElementById('addPaymentButton');
let currentDebtorId = null;

if (closeDetailButton) {
    closeDetailButton.addEventListener('click', () => detailModal.classList.remove('open'));
}
if (detailModal) {
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            detailModal.classList.remove('open');
        }
    });
}

function renderPayments(debtor) {
    const paymentsGrid = document.getElementById('paymentsGrid');
    if (!paymentsGrid) return;
    
    paymentsGrid.innerHTML = '';
    
    if (debtor.payments && debtor.payments.length > 0) {
        debtor.payments.sort((a, b) => (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) - (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)));
        
        debtor.payments.forEach(payment => {
            const paymentItem = document.createElement('div');
            paymentItem.className = 'payment-item';
            paymentItem.innerHTML = `
                <p><strong>Data:</strong> ${formatDate(payment.timestamp)}</p>
                <p><strong>Valor:</strong> ${formatCurrency(payment.amount)}</p>
            `;
            paymentsGrid.appendChild(paymentItem);
        });
    } else {
        paymentsGrid.innerHTML = '<p>Nenhum pagamento registrado ainda.</p>';
    }
}


function openDetailModal(debtor) {
    currentDebtorId = debtor.id;
    const remaining = calculateRemaining(debtor);
    const totalPaid = debtor.totalDebt - remaining;

    document.getElementById('detailName').textContent = debtor.name;
    document.getElementById('detailTotalDebt').textContent = formatCurrency(debtor.totalDebt);
    document.getElementById('detailTotalPaid').textContent = formatCurrency(totalPaid);
    document.getElementById('detailRemainingDebt').textContent = formatCurrency(remaining);
    document.getElementById('detailInitialDate').textContent = formatDate(debtor.initialDate);
    document.getElementById('detailFrequency').textContent = debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal';
    
    renderPayments(debtor);
    detailModal.classList.add('open');
}

if (addPaymentButton) {
    addPaymentButton.addEventListener('click', async () => {
        const paymentAmountInput = document.getElementById('paymentAmount');
        const paymentDateInput = document.getElementById('paymentDate');
        
        const amount = parseFloat(paymentAmountInput.value);
        const dateString = paymentDateInput.value;

        if (!currentDebtorId || isNaN(amount) || amount <= 0 || !dateString) {
            showError('Preencha um valor e uma data válidos.', 'detailModalMessage');
            return;
        }
        
        try {
            const date = new Date(dateString);
            // Corrige o timezone para garantir que a data seja a correta (dia seguinte)
            date.setDate(date.getDate() + 1); 

            const newPayment = {
                amount: amount,
                timestamp: firebase.firestore.Timestamp.fromDate(date)
            };

            // Adiciona o novo pagamento ao array existente no Firestore
            await db.collection('users').doc(currentUserId).collection('debtors').doc(currentDebtorId).update({
                payments: firebase.firestore.FieldValue.arrayUnion(newPayment)
            });

            paymentAmountInput.value = '';
            paymentDateInput.value = '';
            // A atualização do modal é feita automaticamente pelo listener do Firestore
            detailModal.classList.remove('open');
            showError('Pagamento adicionado com sucesso!', 'errorMessage');

        } catch (error) {
            console.error('Erro ao adicionar pagamento:', error);
            showError('Erro ao adicionar pagamento. Tente novamente.', 'errorMessage');
        }
    });
}


// --- Lógica de Login e Registro (index.html) ---

if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    // ... (Lógica de Login/Registro original) ...
    // (Mantida a lógica de autenticação com Firebase do seu arquivo)
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const loginSection = document.querySelector('.login-section');
    const registerSection = document.querySelector('.register-section');

    const handleAuthError = (error) => {
        let message = "Ocorreu um erro. Tente novamente.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            message = "E-mail ou senha inválidos.";
        } else if (error.code === 'auth/email-already-in-use') {
            message = "Este e-mail já está em uso.";
        } else if (error.code === 'auth/weak-password') {
            message = "A senha deve ter pelo menos 6 caracteres.";
        }
        return message;
    };

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const loginMessage = document.getElementById('loginMessage');
            loginMessage.style.display = 'none';

            try {
                await auth.signInWithEmailAndPassword(email, password);
                window.location.href = 'dashboard.html';
            } catch (error) {
                loginMessage.textContent = handleAuthError(error);
                loginMessage.style.display = 'block';
                console.error('Erro de login:', error);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const registerMessage = document.getElementById('registerMessage');
            registerMessage.style.display = 'none';

            try {
                await auth.createUserWithEmailAndPassword(email, password);
                // Cria o documento do usuário no Firestore
                await db.collection('users').doc(auth.currentUser.uid).set({
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                window.location.href = 'dashboard.html';
            } catch (error) {
                registerMessage.textContent = handleAuthError(error);
                registerMessage.style.display = 'block';
                console.error('Erro de registro:', error);
            }
        });
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.classList.remove('active');
            registerSection.classList.add('active');
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerSection.classList.remove('active');
            loginSection.classList.add('active');
        });
    }

    // Redireciona se já estiver logado
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });
}


// --- Lógica do Dashboard (dashboard.html) ---

if (window.location.pathname.endsWith('dashboard.html')) {
    const logoutButton = document.getElementById('logoutButton');
    const filterAllButton = document.getElementById('filterAllButton');
    const filterDailyButton = document.getElementById('filterDailyButton');
    const filterWeeklyButton = document.getElementById('filterWeeklyButton');
    const filterMonthlyButton = document.getElementById('filterMonthlyButton');

    // --- Logout ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
                showError('Erro ao fazer logout. Tente novamente.');
            }
        });
    }

    // --- Lógica dos Filtros ---
    if (filterAllButton) {
        filterAllButton.addEventListener('click', () => {
            currentFilter = 'all';
            updateFilterButtons('filterAllButton');
            setupFirestoreListener();
        });
    }
    if (filterDailyButton) {
        filterDailyButton.addEventListener('click', () => {
            currentFilter = 'daily';
            updateFilterButtons('filterDailyButton');
            setupFirestoreListener();
        });
    }
    if (filterWeeklyButton) {
        filterWeeklyButton.addEventListener('click', () => {
            currentFilter = 'weekly';
            updateFilterButtons('filterWeeklyButton');
            setupFirestoreListener();
        });
    }
    if (filterMonthlyButton) {
        filterMonthlyButton.addEventListener('click', () => {
            currentFilter = 'monthly';
            updateFilterButtons('filterMonthlyButton');
            setupFirestoreListener();
        });
    }


    // O listener de autenticação agora apenas armazena o UID e chama a função de setup
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserId = user.uid; // Armazena o ID do usuário logado
            console.log("Usuário logado:", user.email, "UID:", user.uid);
            setupFirestoreListener(); // Inicia o listener do Firestore
        } else {
            currentUserId = null; // Nenhum usuário logado
            debtors = []; // Limpa a lista de devedores
            renderDebtors(); // Renderiza a lista vazia
            window.location.href = 'index.html'; // Redireciona para o login
        }
    });

    // --- Lógica de Adicionar/Editar Devedor (Exemplo básico) ---
    // Você precisará implementar a lógica de abertura/fechamento do modal de adicionar/editar e o formulário.
    const addDebtorButton = document.getElementById('addDebtorButton');
    const addEditDebtorModal = document.getElementById('addEditDebtorModal');
    const closeAddEditModal = document.getElementById('closeAddEditModal');

    if (addDebtorButton) {
        addDebtorButton.addEventListener('click', () => {
            addEditDebtorModal.classList.add('open');
            document.getElementById('addEditModalTitle').textContent = 'Adicionar Novo Devedor';
            document.getElementById('debtorForm').reset();
        });
    }

    if (closeAddEditModal) {
        closeAddEditModal.addEventListener('click', () => {
            addEditDebtorModal.classList.remove('open');
        });
    }
    
    // ... Implementar a lógica de submissão do formulário debtorForm aqui ...
}
