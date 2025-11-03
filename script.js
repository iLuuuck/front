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
// ⚠️ ATENÇÃO: SUBSTITUA os valores de `firebaseConfig` abaixo pelas SUAS credenciais
//            REAIS do seu projeto no console do Firebase.
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M", // ⬅️ Troque aqui
    authDomain: "russo2.firebaseapp.com", // ⬅️ Troque aqui
    projectId: "russo2", // ⬅️ Troque aqui
    storageBucket: "russo2.firebasestorage.app",
    messagingSenderId: "590812147841",
    appId: "1:590812147841:web:da98880beb257e0de3dd80"
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
    const totalPaid = (debtor.payments || []).reduce((sum, p) => sum + p.amount, 0);
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
                // Garante que payments é um array, mesmo que não exista
                const data = doc.data();
                if (!data.payments) {
                    data.payments = [];
                }
                debtors.push({ id: doc.id, ...data });
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
const fillAmountButton = document.getElementById('fillAmountButton');
let currentDebtor = null; // Armazena o devedor atual no modal

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
        // Ordena do mais recente para o mais antigo
        debtor.payments.sort((a, b) => (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) - (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)));
        
        // Renderiza apenas os 6 pagamentos mais recentes
        debtor.payments.slice(0, 6).forEach(payment => {
            const paymentItem = document.createElement('div');
            paymentItem.className = 'payment-item';
            paymentItem.innerHTML = `
                <p><strong>Data:</strong> ${formatDate(payment.timestamp)}</p>
                <p><strong>Valor:</strong> ${formatCurrency(payment.amount)}</p>
            `;
            paymentsGrid.appendChild(paymentItem);
        });
    } else {
        paymentsGrid.innerHTML = '<p class="loading-message">Nenhum pagamento registrado ainda.</p>';
    }
}


function openDetailModal(debtor) {
    currentDebtor = debtor; // Salva o devedor atual
    const remaining = calculateRemaining(debtor);
    const totalPaid = debtor.totalDebt - remaining;

    document.getElementById('detailName').textContent = debtor.name;
    document.getElementById('detailTotalDebt').textContent = formatCurrency(debtor.totalDebt);
    document.getElementById('detailTotalPaid').textContent = formatCurrency(totalPaid);
    document.getElementById('detailRemainingDebt').textContent = formatCurrency(remaining);
    document.getElementById('detailInitialDate').textContent = formatDate(debtor.initialDate);
    document.getElementById('detailFrequency').textContent = debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal';
    
    // Reseta os inputs do pagamento
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentDate').valueAsDate = new Date(); // Seta a data atual

    renderPayments(debtor);
    detailModal.classList.add('open');
}

// Botão para preencher o valor restante
if (fillAmountButton) {
    fillAmountButton.addEventListener('click', () => {
        if (currentDebtor) {
            const remaining = calculateRemaining(currentDebtor);
            document.getElementById('paymentAmount').value = remaining.toFixed(2);
        }
    });
}

if (addPaymentButton) {
    addPaymentButton.addEventListener('click', async () => {
        const paymentAmountInput = document.getElementById('paymentAmount');
        const paymentDateInput = document.getElementById('paymentDate');
        
        const amount = parseFloat(paymentAmountInput.value);
        const dateString = paymentDateInput.value;

        if (!currentDebtor || isNaN(amount) || amount <= 0 || !dateString) {
            showError('Preencha um valor e uma data válidos.', 'detailModalMessage');
            return;
        }

        const remaining = calculateRemaining(currentDebtor);
        if (amount > remaining) {
             showError(`O valor excede a dívida restante de ${formatCurrency(remaining)}.`, 'detailModalMessage');
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
            await db.collection('users').doc(currentUserId).collection('debtors').doc(currentDebtor.id).update({
                payments: firebase.firestore.FieldValue.arrayUnion(newPayment)
            });

            paymentAmountInput.value = '';
            paymentDateInput.valueAsDate = new Date();
            
            // Fecha o modal e confia no listener para atualizar a lista
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
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const loginSection = document.querySelector('.login-section');
    const registerSection = document.querySelector('.register-section');

    const handleAuthError = (error) => {
        let message = "Ocorreu um erro. Tente novamente.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
            message = "E-mail ou senha inválidos.";
        } else if (error.code === 'auth/email-already-in-use') {
            message = "Este e-mail já está em uso.";
        } else if (error.code === 'auth/weak-password') {
            message = "A senha deve ter pelo menos 6 caracteres.";
        }
        return message;
    };

    // Função para alternar as views de login/registro
    const toggleAuthView = (show) => {
        if (show === 'register') {
            loginSection.classList.remove('active');
            registerSection.classList.add('active');
            document.getElementById('loginMessage').style.display = 'none';
        } else {
            registerSection.classList.remove('active');
            loginSection.classList.add('active');
            document.getElementById('registerMessage').style.display = 'none';
        }
    }


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
            toggleAuthView('register');
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            toggleAuthView('login');
        });
    }

    // Redireciona se já estiver logado
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'dashboard.html';
        } else {
            // Garante que o login é a tela inicial (evita flash de registro)
            toggleAuthView('login'); 
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
    const debtorForm = document.getElementById('debtorForm');
    const addEditDebtorModal = document.getElementById('addEditDebtorModal');
    const closeAddEditModal = document.getElementById('closeAddEditModal');
    const addDebtorButton = document.getElementById('addDebtorButton');


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


    // O listener de autenticação
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserId = user.uid; // Armazena o ID do usuário logado
            setupFirestoreListener(); // Inicia o listener do Firestore
        } else {
            currentUserId = null; // Nenhum usuário logado
            window.location.href = 'index.html'; // Redireciona para o login
        }
    });


    // --- Lógica de Adicionar/Salvar Devedor ---

    if (addDebtorButton) {
        addDebtorButton.addEventListener('click', () => {
            addEditDebtorModal.classList.add('open');
            document.getElementById('addEditModalTitle').textContent = 'Adicionar Novo Devedor';
            // Preenche o formulário com a data de hoje por padrão
            document.getElementById('debtorInitialDate').valueAsDate = new Date(); 
            debtorForm.reset();
            document.getElementById('debtorId').value = '';
        });
    }

    if (closeAddEditModal) {
        closeAddEditModal.addEventListener('click', () => {
            addEditDebtorModal.classList.remove('open');
        });
    }

    if (debtorForm) {
        debtorForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('debtorName').value;
            const totalDebt = parseFloat(document.getElementById('debtorTotalDebt').value);
            const initialDateString = document.getElementById('debtorInitialDate').value;
            const frequency = document.getElementById('debtorFrequency').value;
            const id = document.getElementById('debtorId').value;

            if (isNaN(totalDebt) || totalDebt <= 0 || !name || !initialDateString) {
                showError('Preencha todos os campos corretamente.', 'errorMessage');
                return;
            }

            try {
                const initialDate = new Date(initialDateString);
                // Corrige o timezone
                initialDate.setDate(initialDate.getDate() + 1); 

                const newDebtorData = {
                    name: name,
                    totalDebt: totalDebt,
                    initialDate: firebase.firestore.Timestamp.fromDate(initialDate),
                    frequency: frequency,
                    payments: [], // Sempre inicia com payments vazio
                };
                
                // Salva no Firestore
                await db.collection('users').doc(currentUserId).collection('debtors').add(newDebtorData);

                addEditDebtorModal.classList.remove('open');
                showError('Devedor adicionado com sucesso!', 'errorMessage');

            } catch (error) {
                console.error('Erro ao salvar devedor:', error);
                showError('Erro ao salvar devedor. Tente novamente.', 'errorMessage');
            }
        });
    }
}
