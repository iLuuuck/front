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
// ⚠️ ATENÇÃO: Seus valores REAIS foram inseridos aqui.
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M",
    authDomain: "russo2.firebaseapp.com",
    projectId: "russo2",
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
    // Garante que payments é um array antes de tentar reduzir
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
const editDebtorButton = document.getElementById('editDebtorButton');
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
    
    // Novos campos
    document.getElementById('detailCalculationType').textContent = debtor.calculationType === 'fixed' ? 'Valor Fixo por Parcela' : 'Porcentagem de Juros (Total)';
    document.getElementById('detailInterestRate').textContent = debtor.calculationType === 'fixed' ? formatCurrency(debtor.interestRate) : `${debtor.interestRate}%`;

    // Reseta os inputs do pagamento
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentDate').valueAsDate = new Date(); // Seta a data atual
    document.getElementById('detailModalMessage').style.display = 'none';

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
            date.setDate(date.getDate() + 1); 

            const newPayment = {
                amount: amount,
                timestamp: firebase.firestore.Timestamp.fromDate(date) 
            };

            await db.collection('users').doc(currentUserId).collection('debtors').doc(currentDebtor.id).update({
                payments: firebase.firestore.FieldValue.arrayUnion(newPayment)
            });

            paymentAmountInput.value = '';
            paymentDateInput.valueAsDate = new Date();
            
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

    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'dashboard.html';
        } else {
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                toggleAuthView('login');
            }
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

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserId = user.uid; // Armazena o ID do usuário logado
            setupFirestoreListener(); // Inicia o listener do Firestore
        } else {
            currentUserId = null; // Nenhum usuário logado
            window.location.href = 'index.html'; // Redireciona para o login
        }
    });


    // --- Lógica de Adicionar/Salvar/Editar Devedor ---

    // Ação do botão de Adicionar
    if (addDebtorButton) {
        addDebtorButton.addEventListener('click', () => {
            addEditDebtorModal.classList.add('open');
            document.getElementById('addEditModalTitle').textContent = 'Adicionar Novo Devedor';
            // Padrões
            document.getElementById('debtorInitialDate').valueAsDate = new Date(); 
            document.getElementById('debtorFrequency').value = 'monthly';
            document.getElementById('debtorCalculationType').value = 'fixed';
            document.getElementById('debtorInterestRate').value = 0.00;
            
            debtorForm.reset();
            document.getElementById('debtorId').value = ''; // ID VAZIO = ADICIONAR
        });
    }

    // Ação do botão de Editar (no modal de detalhes)
    if (editDebtorButton) {
        editDebtorButton.addEventListener('click', () => {
            if (!currentDebtor) return;
            
            // 1. Preenche o formulário para edição
            document.getElementById('debtorId').value = currentDebtor.id;
            document.getElementById('debtorName').value = currentDebtor.name;
            document.getElementById('debtorTotalDebt').value = currentDebtor.totalDebt;
            
            // Formata a data do Timestamp para o formato do input Date (YYYY-MM-DD)
            const initialDate = currentDebtor.initialDate.toDate();
            const yyyy = initialDate.getFullYear();
            const mm = String(initialDate.getMonth() + 1).padStart(2, '0');
            const dd = String(initialDate.getDate()).padStart(2, '0');
            document.getElementById('debtorInitialDate').value = `${yyyy}-${mm}-${dd}`;
            
            document.getElementById('debtorFrequency').value = currentDebtor.frequency;
            document.getElementById('debtorCalculationType').value = currentDebtor.calculationType;
            document.getElementById('debtorInterestRate').value = currentDebtor.interestRate;

            // 2. Abre o modal
            document.getElementById('addEditModalTitle').textContent = 'Editar Devedor';
            addEditDebtorModal.classList.add('open');
            detailModal.classList.remove('open'); // Fecha o modal de detalhes
        });
    }

    if (closeAddEditModal) {
        closeAddEditModal.addEventListener('click', () => {
            addEditDebtorModal.classList.remove('open');
        });
    }
    
    // Ação de Submissão (Adicionar OU Editar)
    if (debtorForm) {
        debtorForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('debtorName').value;
            const totalDebt = parseFloat(document.getElementById('debtorTotalDebt').value);
            const initialDateString = document.getElementById('debtorInitialDate').value;
            const frequency = document.getElementById('debtorFrequency').value;
            const calculationType = document.getElementById('debtorCalculationType').value;
            const interestRate = parseFloat(document.getElementById('debtorInterestRate').value);
            const id = document.getElementById('debtorId').value; // Checa se existe ID (Editar)

            if (isNaN(totalDebt) || totalDebt <= 0 || !name || !initialDateString || !frequency || isNaN(interestRate) || interestRate < 0) {
                showError('Preencha todos os campos corretamente.', 'errorMessage');
                return;
            }

            try {
                const initialDate = new Date(initialDateString);
                initialDate.setDate(initialDate.getDate() + 1); 

                const newDebtorData = {
                    name: name,
                    totalDebt: totalDebt,
                    initialDate: firebase.firestore.Timestamp.fromDate(initialDate),
                    frequency: frequency,
                    calculationType: calculationType,
                    interestRate: interestRate, 
                    // payments:[] não deve ser sobrescrito em uma edição, apenas na criação
                };
                
                if (id) {
                    // MODO EDIÇÃO
                    await db.collection('users').doc(currentUserId).collection('debtors').doc(id).update(newDebtorData);
                    showError('Devedor atualizado com sucesso!', 'errorMessage');
                } else {
                    // MODO ADICIONAR (Adiciona payments: [])
                    const dataWithPayments = { ...newDebtorData, payments: [] };
                    await db.collection('users').doc(currentUserId).collection('debtors').add(dataWithPayments);
                    showError('Devedor adicionado com sucesso!', 'errorMessage');
                }

                addEditDebtorModal.classList.remove('open');

            } catch (error) {
                console.error('Erro ao salvar devedor:', error);
                showError('Erro ao salvar devedor. Tente novamente.', 'errorMessage');
            }
        });
    }

    // --- Lógica de Cálculo de Parcelas e Juros ---
    
    const showAllInstallmentsButton = document.getElementById('showAllInstallmentsButton');
    const allInstallmentsModal = document.getElementById('allInstallmentsModal');
    const closeAllInstallmentsModal = document.getElementById('closeAllInstallmentsModal');

    if (closeAllInstallmentsModal) {
        closeAllInstallmentsModal.addEventListener('click', () => allInstallmentsModal.classList.remove('open'));
    }

    // Função Principal de Cálculo e Geração do Cronograma
    function calculateInstallments(debtor) {
        if (debtor.calculationType === 'percentage') {
            // CÁLCULO POR PORCENTAGEM (Simples: juros aplicados ao total)
            const totalInterest = debtor.totalDebt * (debtor.interestRate / 100);
            return {
                totalInterest: totalInterest,
                totalDebtWithInterest: debtor.totalDebt + totalInterest,
                type: 'percentage'
            };
        } else {
            // CÁLCULO FIXO POR PARCELA (Gera um cronograma)
            const installments = [];
            let remainingDebt = debtor.totalDebt;
            // Cria uma cópia da data inicial para não alterar a original
            let currentDate = debtor.initialDate.toDate(); 
            let fixedAmount = debtor.interestRate;
            let maxIterations = 500; // Limite de segurança

            while (remainingDebt > 0 && maxIterations > 0) {
                let installmentAmount = Math.min(fixedAmount, remainingDebt);
                
                installments.push({
                    date: new Date(currentDate), // Adiciona o pagamento agendado
                    amount: installmentAmount,
                    type: 'scheduled'
                });

                remainingDebt -= installmentAmount;

                // Move data para o próximo período
                if (debtor.frequency === 'daily') {
                    currentDate.setDate(currentDate.getDate() + 1);
                } else if (debtor.frequency === 'weekly') {
                    currentDate.setDate(currentDate.getDate() + 7);
                } else if (debtor.frequency === 'monthly') {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }

                maxIterations--;
            }
            return { list: installments, type: 'fixed' };
        }
    }

    // Renderiza o Cronograma (Cálculo Fixo)
    function renderFixedInstallments(installments, payments, container) {
        let paidAmountCumulative = (payments || []).reduce((sum, p) => sum + p.amount, 0) || 0;
        let cumulativeScheduledAmount = 0;
        
        container.innerHTML = `<p class="loading-message" style="grid-column: 1 / -1;">
            O cronograma é baseado no valor fixo de R$${currentDebtor.interestRate.toFixed(2)} por período.<br>
            Total Pago (${formatCurrency(paidAmountCumulative)}) é usado para marcar as parcelas.
        </p>`;


        if (installments.length === 0) {
            container.innerHTML += `<p class="loading-message" style="grid-column: 1 / -1; color: var(--success-color);">Dívida já quitada.</p>`;
            return;
        }

        installments.forEach((event) => {
            cumulativeScheduledAmount += event.amount;
            let installmentPaidStatus = 'A PAGAR';
            let color = 'var(--primary-color)';
            let isPaid = paidAmountCumulative >= cumulativeScheduledAmount;

            if (isPaid) {
                installmentPaidStatus = 'PAGO';
                color = 'var(--success-color)';
            } else if (event.date < new Date()) {
                installmentPaidStatus = 'ATRASADO';
                color = 'var(--error-color)';
            }


            const installmentItem = document.createElement('div');
            installmentItem.className = 'installment-square';
            installmentItem.style.borderLeftColor = color;
            installmentItem.innerHTML = `
                <p><strong>${formatCurrency(event.amount)}</strong></p>
                <p>${formatDate(event.date)}</p>
                <span class="installment-status" style="color: ${color};">${installmentPaidStatus}</span>
            `;
            container.appendChild(installmentItem);
        });
    }

    // Renderiza o Cálculo de Juros (Porcentagem)
    function renderPercentageCalculation(result, container) {
        container.innerHTML = `
            <div class="summary-card">
                <h3>Cálculo de Juros (Total)</h3>
                <p><strong>Dívida Principal:</strong> ${formatCurrency(currentDebtor.totalDebt)}</p>
                <p><strong>Taxa de Juros:</strong> ${currentDebtor.interestRate}%</p>
                <p><strong>Juros Calculados:</strong> <span style="color: var(--error-color);">${formatCurrency(result.totalInterest)}</span></p>
                <p><strong>Total com Juros:</strong> <span style="font-size: 1.2em; color: var(--primary-color); font-weight: bold;">${formatCurrency(result.totalDebtWithInterest)}</span></p>
                <p class="loading-message">Este cálculo exibe o total da dívida acrescida de juros de forma simples e total. Não exibe um cronograma de parcelas.</p>
            </div>
        `;
    }

    // Listener para o botão "Exibir Cronograma"
    if (showAllInstallmentsButton) {
        showAllInstallmentsButton.addEventListener('click', () => {
            if (!currentDebtor) return;

            const allInstallmentsGrid = document.getElementById('allInstallmentsGrid');
            allInstallmentsGrid.innerHTML = '<p class="loading-message">Calculando...</p>';

            const calculationResult = calculateInstallments(currentDebtor);
            allInstallmentsGrid.innerHTML = ''; // Limpa a mensagem de carregamento

            if (calculationResult.type === 'fixed') {
                renderFixedInstallments(calculationResult.list, currentDebtor.payments, allInstallmentsGrid);
            } else if (calculationResult.type === 'percentage') {
                renderPercentageCalculation(calculationResult, allInstallmentsGrid);
            }

            allInstallmentsModal.classList.add('open');
        });
    }
}
