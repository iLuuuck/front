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

// Carrega o tema salvo, se houver
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
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M",
    authDomain: "russo2.firebaseapp.com",
    projectId: "russo2",
    storageBucket: "russo2.firebasestorage.app",
    messagingSenderId: "590812147841",
    appId: "1:590812147841:web:da98880beb257e0de3dd80"
};

// Verifica se o Firebase já foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // se já estiver inicializado, use a instância existente
}

const db = firebase.firestore();
const auth = firebase.auth();

// Variáveis Globais do Dashboard
let debtors = [];
let currentFilter = 'all';
let currentUserId = null;

// --- Funções de Autenticação (Login/Registro) ---

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const loginSection = document.querySelector('.login-section');
const registerSection = document.querySelector('.register-section');
const logoutButton = document.getElementById('logoutButton');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.loginEmail.value;
        const password = loginForm.loginPassword.value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert("Erro ao fazer login: " + error.message);
        }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = registerForm.registerEmail.value;
        const password = registerForm.registerPassword.value;

        try {
            await auth.createUserWithEmailAndPassword(email, password);
            alert("Cadastro realizado com sucesso! Faça login.");
            // Após o registro, alterna para o formulário de login
            loginSection.classList.add('active');
            registerSection.classList.remove('active');
            registerForm.reset();
        } catch (error) {
            alert("Erro ao cadastrar: " + error.message);
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
        loginSection.classList.add('active');
        registerSection.classList.remove('active');
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    });
}

// Redirecionamento para dashboard se já estiver logado (para index.html)
if (document.title.includes('Login')) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });
}


// --- Funções de Data e Cálculo ---

function getNextDueDate(startDate, frequency, lastPaymentDate = null) {
    let date = lastPaymentDate ? new Date(lastPaymentDate) : new Date(startDate);
    date.setDate(date.getDate() + 1); // Começa um dia após o início/último pagamento para cálculo

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDue;

    while (true) {
        nextDue = new Date(date);
        
        if (frequency === 'daily') {
            // A próxima data de vencimento já está em `nextDue`
        } else if (frequency === 'weekly') {
            // Se for semanal, pula para a próxima semana
            let dayOfWeek = nextDue.getDay(); // 0=Domingo, 1=Segunda, ...
            let daysToAdd = (7 - dayOfWeek) % 7; // Pula para o próximo domingo
            if (daysToAdd === 0) daysToAdd = 7; // Se for domingo, considera a próxima semana
            nextDue.setDate(nextDue.getDate() + daysToAdd);
        } else if (frequency === 'monthly') {
            // Se for mensal, pula para o próximo mês
            let dayOfMonth = nextDue.getDate();
            let month = nextDue.getMonth();
            let year = nextDue.getFullYear();

            // Seta para o mesmo dia do próximo mês
            nextDue.setMonth(month + 1);
            // Corrige se o próximo mês tiver menos dias
            if (nextDue.getDate() !== dayOfMonth) {
                nextDue.setDate(0); // Volta para o último dia do mês anterior (corrigido)
            }
        }

        nextDue.setHours(0, 0, 0, 0);

        if (nextDue > today || frequency === 'all') {
            return nextDue;
        }

        // Se a data ainda for no passado, itera novamente
        date = nextDue;
        if (frequency === 'daily') {
            date.setDate(date.getDate() + 1);
        } else if (frequency === 'weekly') {
            date.setDate(date.getDate() + 7);
        } else if (frequency === 'monthly') {
            date.setMonth(date.getMonth() + 1);
        }

        // Adiciona um limite de segurança para evitar loops infinitos em caso de erro
        if (date.getFullYear() > today.getFullYear() + 10) {
            console.error("Loop de cálculo de data excessivo.");
            return null; 
        }
    }
}


function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date) {
    if (!date) return 'N/A';
    // Formato 'dd/mm/aaaa'
    return new Date(date).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function calculateDebtorTotals(debtor) {
    const totalPaid = debtor.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalDue = parseFloat(debtor.initialAmount);
    const remaining = totalDue - totalPaid;
    
    // Atualiza o objeto devedor no array
    debtor.totalPaid = totalPaid;
    debtor.remaining = remaining;
    debtor.totalDue = totalDue;

    return { totalDue, totalPaid, remaining };
}

// --- Funções do Dashboard ---

const debtorsGrid = document.getElementById('debtorsGrid');
const addDebtorButton = document.getElementById('addDebtorButton');
const addDebtorModal = document.getElementById('addDebtorModal');
const addDebtorForm = document.getElementById('addDebtorForm');

const debtorDetailsModal = document.getElementById('debtorDetailsModal');
const paymentsGrid = document.getElementById('paymentsGrid');
const addPaymentButton = document.getElementById('addPaymentButton');
const deleteDebtorButton = document.getElementById('deleteDebtorButton');
const fillAmountButton = document.getElementById('fillAmountButton');
const editLoanButton = document.getElementById('editLoanButton');

const editLoanModal = document.getElementById('editLoanModal');
const editLoanForm = document.getElementById('editLoanForm');

const allInstallmentsModal = document.getElementById('allInstallmentsModal');
const showAllInstallmentsButton = document.getElementById('showAllInstallmentsButton');
const allInstallmentsGrid = document.getElementById('allInstallmentsGrid');
const toggleTotalToReceive = document.getElementById('toggleTotalToReceive');


let currentDebtorId = null;

// Funções de Modal
document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', (e) => {
        // Encontra o modal pai para fechar
        let modal = e.target.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

window.onclick = function(event) {
    // Fecha o modal se clicar fora
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

if (addDebtorButton) {
    addDebtorButton.addEventListener('click', () => {
        addDebtorModal.style.display = 'block';
    });
}

// Funções de Filtro
const filterAllButton = document.getElementById('filterAllButton');
const filterDailyButton = document.getElementById('filterDailyButton');
const filterWeeklyButton = document.getElementById('filterWeeklyButton');
const filterMonthlyButton = document.getElementById('filterMonthlyButton');

function updateFilterButtons(activeId) {
    [filterAllButton, filterDailyButton, filterWeeklyButton, filterMonthlyButton].forEach(button => {
        if (button) {
            button.classList.remove('active');
            if (button.id === activeId) {
                button.classList.add('active');
            }
        }
    });
}

if(filterAllButton) {
    filterAllButton.addEventListener('click', () => {
        currentFilter = 'all';
        updateFilterButtons('filterAllButton');
        setupFirestoreListener();
    });
}
if(filterDailyButton) {
    filterDailyButton.addEventListener('click', () => {
        currentFilter = 'daily';
        updateFilterButtons('filterDailyButton');
        setupFirestoreListener();
    });
}
if(filterWeeklyButton) {
    filterWeeklyButton.addEventListener('click', () => {
        currentFilter = 'weekly';
        updateFilterButtons('filterWeeklyButton');
        setupFirestoreListener();
    });
}
if(filterMonthlyButton) {
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
        console.log("Nenhum usuário logado.");
    }
});


// Listener do Firestore que re-renderiza a lista quando há mudanças
function setupFirestoreListener() {
    if (!currentUserId) {
        console.log("UID não disponível. Não foi possível configurar o listener.");
        return;
    }

    // Ordena por nome e filtra pelo usuário logado
    db.collection("users").doc(currentUserId).collection("debtors")
        .orderBy("name", "asc")
        .onSnapshot((snapshot) => {
            debtors = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filtra e renderiza
            renderDebtors();
        }, (error) => {
            console.error("Erro ao carregar devedores: ", error);
        });
}


function renderDebtors() {
    if (!debtorsGrid) return; // Garante que estamos na página do dashboard

    debtorsGrid.innerHTML = '';
    
    // Calcula totais e filtra
    const filteredDebtors = debtors.map(d => {
        calculateDebtorTotals(d);
        return d;
    }).filter(d => {
        if (currentFilter === 'all') return true;
        return d.frequency === currentFilter;
    });

    if (filteredDebtors.length === 0) {
        debtorsGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-color);">Nenhum devedor encontrado com o filtro atual.</p>`;
        return;
    }

    filteredDebtors.forEach(debtor => {
        const card = document.createElement('div');
        card.className = 'debtor-card';
        card.setAttribute('data-id', debtor.id);

        const statusClass = debtor.remaining > 0 ? 'status-pending' : 'status-paid';
        const statusColor = debtor.remaining > 0 ? '#ff9800' : '#4caf50';
        
        // Define a borda de destaque com base no status (Green/Orange)
        card.style.borderLeftColor = statusColor;

        card.innerHTML = `
            <div>
                <h4>${debtor.name}</h4>
                <div class="debtor-card-info">
                    <p>Valor Inicial: ${formatCurrency(debtor.totalDue)}</p>
                    <p>Restante: <span style="font-weight: bold; color: ${statusColor};">${formatCurrency(debtor.remaining)}</span></p>
                    <p>Frequência: ${debtor.frequency.charAt(0).toUpperCase() + debtor.frequency.slice(1)}</p>
                </div>
            </div>
            <div class="debtor-card-actions">
                <button class="button button-secondary detail-button">Detalhes</button>
            </div>
        `;

        card.querySelector('.detail-button').addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que o click se propague para o card inteiro
            showDebtorDetails(debtor.id);
        });
        
        // Adiciona um listener no card, caso o botão de detalhes seja removido
        card.addEventListener('click', () => showDebtorDetails(debtor.id));


        debtorsGrid.appendChild(card);
    });
}

// --- CRUD de Devedores ---

if (addDebtorForm) {
    addDebtorForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = addDebtorForm.debtorName.value;
        const initialAmount = parseFloat(addDebtorForm.initialAmount.value);
        const startDate = addDebtorForm.startDate.value;
        const frequency = addDebtorForm.frequency.value;
        const installments = parseInt(addDebtorForm.installments.value) || null; // Null se vazio

        if (!currentUserId) {
            alert("Erro: Usuário não logado.");
            return;
        }

        try {
            await db.collection("users").doc(currentUserId).collection("debtors").add({
                name,
                initialAmount,
                startDate,
                frequency,
                installments,
                payments: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            addDebtorModal.style.display = 'none';
            addDebtorForm.reset();
        } catch (error) {
            console.error("Erro ao adicionar devedor: ", error);
            alert("Erro ao adicionar devedor.");
        }
    });
}


// --- Detalhes e Pagamentos ---

function showDebtorDetails(id) {
    const debtor = debtors.find(d => d.id === id);
    if (!debtor) return;

    currentDebtorId = id; // Define o devedor atual
    calculateDebtorTotals(debtor); // Garante que os totais estão atualizados

    document.getElementById('detailName').textContent = debtor.name;
    document.getElementById('detailTotalDue').textContent = formatCurrency(debtor.totalDue);
    document.getElementById('detailTotalPaid').textContent = formatCurrency(debtor.totalPaid);
    document.getElementById('detailRemaining').textContent = formatCurrency(debtor.remaining);
    document.getElementById('detailStartDate').textContent = formatDate(debtor.startDate);
    document.getElementById('detailFrequency').textContent = debtor.frequency.charAt(0).toUpperCase() + debtor.frequency.slice(1);

    renderPayments(debtor);
    
    // Atualiza o estado inicial do checkbox e chama a função de toggle
    toggleTotalToReceive.checked = localStorage.getItem('hideTotalToReceive') === 'true';
    toggleTotalToReceiveDisplay(); 

    debtorDetailsModal.style.display = 'block';
}

function renderPayments(debtor) {
    paymentsGrid.innerHTML = '';
    
    // Ordena os pagamentos do mais recente para o mais antigo
    const sortedPayments = [...debtor.payments].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Exibe apenas os 5 pagamentos mais recentes
    const recentPayments = sortedPayments.slice(0, 5);
    
    if (recentPayments.length === 0) {
        paymentsGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center;">Nenhum pagamento registrado.</p>`;
        return;
    }

    recentPayments.forEach(payment => {
        const square = document.createElement('div');
        square.className = 'installment-square';
        square.style.borderLeftColor = '#4caf50'; // Cor para pagamentos
        square.innerHTML = `
            <p><strong>R$ ${parseFloat(payment.amount).toFixed(2)}</strong></p>
            <p>${formatDate(payment.date)}</p>
            <button class="delete-payment-button button button-secondary" data-payment-id="${payment.id}" style="font-size: 0.75rem; padding: 5px 8px; margin-top: 5px; background-color: var(--error-color); color: white;">Excluir</button>
        `;
        paymentsGrid.appendChild(square);
    });

    // Adiciona listener para exclusão de pagamento
    paymentsGrid.querySelectorAll('.delete-payment-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const paymentId = e.target.dataset.paymentId;
            if (confirm("Tem certeza que deseja excluir este pagamento?")) {
                await deletePayment(currentDebtorId, paymentId);
            }
        });
    });
}

function toggleTotalToReceiveDisplay() {
    const isChecked = toggleTotalToReceive.checked;
    const remainingSpan = document.getElementById('detailRemaining');

    if (remainingSpan) {
        remainingSpan.style.filter = isChecked ? 'blur(5px)' : 'none';
    }
    localStorage.setItem('hideTotalToReceive', isChecked);
}

if (toggleTotalToReceive) {
    toggleTotalToReceive.addEventListener('change', toggleTotalToReceiveDisplay);
}


if (addPaymentButton) {
    addPaymentButton.addEventListener('click', async () => {
        const amountInput = document.getElementById('paymentAmount');
        const dateInput = document.getElementById('paymentDate');
        
        const amount = parseFloat(amountInput.value);
        const date = dateInput.value;

        if (!currentDebtorId || isNaN(amount) || amount <= 0 || !date) {
            alert("Preencha o valor e a data do pagamento.");
            return;
        }

        try {
            const debtorRef = db.collection("users").doc(currentUserId).collection("debtors").doc(currentDebtorId);
            
            await debtorRef.update({
                payments: firebase.firestore.FieldValue.arrayUnion({
                    id: uuidv4(), // Gera um ID único para o pagamento
                    amount: amount,
                    date: date
                })
            });

            // Limpa os campos após o sucesso
            amountInput.value = '';
            dateInput.value = '';

            // Não precisa chamar showDebtorDetails, o listener do Firestore faz isso automaticamente
        } catch (error) {
            console.error("Erro ao adicionar pagamento: ", error);
            alert("Erro ao adicionar pagamento.");
        }
    });
}

if (fillAmountButton) {
    fillAmountButton.addEventListener('click', () => {
        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (debtor) {
            const amountInput = document.getElementById('paymentAmount');
            // Preenche com o restante, limitando a duas casas decimais
            amountInput.value = debtor.remaining.toFixed(2);
        }
    });
}

async function deletePayment(debtorId, paymentId) {
    const debtor = debtors.find(d => d.id === debtorId);
    if (!debtor) return;

    try {
        const newPayments = debtor.payments.filter(p => p.id !== paymentId);
        
        const debtorRef = db.collection("users").doc(currentUserId).collection("debtors").doc(debtorId);

        await debtorRef.update({
            payments: newPayments
        });
        
        // Não precisa recarregar, o listener faz isso
    } catch (error) {
        console.error("Erro ao deletar pagamento: ", error);
        alert("Erro ao deletar pagamento.");
    }
}

if (deleteDebtorButton) {
    deleteDebtorButton.addEventListener('click', async () => {
        if (confirm("Tem certeza que deseja excluir este devedor e todos os seus dados? Esta ação é irreversível.")) {
            try {
                await db.collection("users").doc(currentUserId).collection("debtors").doc(currentDebtorId).delete();
                debtorDetailsModal.style.display = 'none';
                currentDebtorId = null;
            } catch (error) {
                console.error("Erro ao excluir devedor:", error);
                alert("Erro ao excluir devedor.");
            }
        }
    });
}

// --- Edição de Empréstimo ---

if (editLoanButton) {
    editLoanButton.addEventListener('click', () => {
        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (!debtor) return;

        // Preenche o formulário de edição
        document.getElementById('editDebtorName').value = debtor.name;
        document.getElementById('editInitialAmount').value = debtor.initialAmount;
        document.getElementById('editStartDate').value = debtor.startDate;
        document.getElementById('editFrequency').value = debtor.frequency;
        document.getElementById('editInstallments').value = debtor.installments || '';
        
        editLoanModal.style.display = 'block';
    });
}

if (editLoanForm) {
    editLoanForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = editLoanForm.editDebtorName.value;
        const initialAmount = parseFloat(editLoanForm.editInitialAmount.value);
        const startDate = editLoanForm.editStartDate.value;
        const frequency = editLoanForm.editFrequency.value;
        const installments = parseInt(editLoanForm.editInstallments.value) || null;

        if (!currentDebtorId || !currentUserId) {
            alert("Erro: ID do devedor ou usuário ausente.");
            return;
        }

        try {
            await db.collection("users").doc(currentUserId).collection("debtors").doc(currentDebtorId).update({
                name,
                initialAmount,
                startDate,
                frequency,
                installments
            });

            editLoanModal.style.display = 'none';
            // Fechar o modal de detalhes e reabri-lo com os novos dados (o listener faz o trabalho)
            debtorDetailsModal.style.display = 'none';
        } catch (error) {
            console.error("Erro ao salvar alterações do empréstimo:", error);
            alert("Erro ao salvar alterações.");
        }
    });
}

// --- Todas as Parcelas ---

function generateInstallments(debtor) {
    const installments = [];
    const { initialAmount, startDate, frequency, payments, totalDue } = debtor;
    
    // Se o valor total devido for 0, não gera parcelas
    if (totalDue <= 0) return [];
    
    // Calcula o valor total pago
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Se tiver parcelas definidas, usa o número de parcelas para determinar o valor por parcela
    let installmentValue = totalDue;
    let numInstallments = debtor.installments;

    if (numInstallments && numInstallments > 0) {
        installmentValue = totalDue / numInstallments;
    } else {
        // Se não houver número de parcelas, o sistema não pode prever todas as futuras.
        // Neste caso, gera uma lista até o valor ser coberto ou um limite razoável.
        // Para simplificar, vou gerar parcelas baseadas em um valor fixo (e.g., R$50) até o total
        // ou 100 parcelas, o que for menor. Isso é uma suposição baseada em como
        // um sistema sem parcela fixa se comportaria.
        installmentValue = 50; 
        numInstallments = Math.ceil(totalDue / installmentValue);
        // Garante que a última parcela cubra o restante exato
    }
    
    let remainingAmount = totalDue;
    let currentPaymentIndex = 0;
    
    // Começa a data no dia do início do empréstimo
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    // Itera para gerar as parcelas
    for (let i = 0; i < numInstallments; i++) {
        let expectedAmount = installmentValue;
        if (i === numInstallments - 1) {
            // Garante que a última parcela feche o valor exato
            expectedAmount = remainingAmount;
        }
        
        let paymentMade = 0;
        let paymentDates = [];
        
        // Atribui pagamentos existentes a esta parcela
        while (remainingAmount > 0 && currentPaymentIndex < payments.length) {
            const payment = payments[currentPaymentIndex];
            const paymentAmount = parseFloat(payment.amount);
            
            // O pagamento cobre a parcela?
            const amountToCover = Math.min(paymentAmount, expectedAmount - paymentMade);

            if (amountToCover > 0) {
                paymentMade += amountToCover;
                paymentDates.push(formatDate(payment.date));
                
                // Se o pagamento cobriu a parcela e ainda sobrou, o restante vai para a próxima
                if (paymentAmount > amountToCover) {
                    // Crie um novo pagamento virtual com o restante
                    const nextPayment = { 
                        id: payment.id, // Mantém o mesmo ID para rastreamento
                        amount: paymentAmount - amountToCover, 
                        date: payment.date 
                    };
                    payments.splice(currentPaymentIndex + 1, 0, nextPayment); // Insere após o atual
                    payments[currentPaymentIndex].amount = amountToCover; // Atualiza o valor do pagamento atual
                }
                
            }
            
            // Move para o próximo pagamento, pois o atual já foi processado (ou parcialmente processado)
            currentPaymentIndex++;

            if (paymentMade >= expectedAmount) {
                // Parcela coberta, move para a próxima iteração do loop FOR
                break; 
            }
        }
        
        remainingAmount -= paymentMade;

        installments.push({
            id: i + 1,
            expectedDate: formatDate(currentDate.toISOString().split('T')[0]),
            expectedAmount: expectedAmount.toFixed(2),
            paidAmount: paymentMade.toFixed(2),
            isPaid: paymentMade >= expectedAmount,
            paymentDates: paymentDates
        });
        
        // Avança a data para a próxima parcela
        let nextDate = new Date(currentDate);
        if (frequency === 'daily') {
            nextDate.setDate(nextDate.getDate() + 1);
        } else if (frequency === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
        } else if (frequency === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
        }
        currentDate = nextDate;
    }
    
    return installments;
}


if (showAllInstallmentsButton) {
    showAllInstallmentsButton.addEventListener('click', () => {
        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (!debtor) return;

        allInstallmentsGrid.innerHTML = '';
        document.getElementById('allInstallmentsTitle').textContent = `Todas as Parcelas de ${debtor.name}`;

        const installments = generateInstallments(debtor);
        
        if (installments.length === 0) {
            allInstallmentsGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center;">Não foi possível gerar as parcelas ou o valor devido é zero.</p>`;
            allInstallmentsModal.style.display = 'block';
            return;
        }

        installments.forEach(inst => {
            const square = document.createElement('div');
            square.className = 'installment-square';
            
            const statusColor = inst.isPaid ? '#4caf50' : '#ff9800';
            square.style.borderLeftColor = statusColor;
            
            let paymentDetails = inst.paymentDates.length > 0 
                ? inst.paymentDates.join(', ')
                : 'Ainda não pago';

            square.innerHTML = `
                <p><strong>Parcela ${inst.id}</strong></p>
                <p>Previsto: ${formatCurrency(parseFloat(inst.expectedAmount))}</p>
                <p>Pago: ${formatCurrency(parseFloat(inst.paidAmount))}</p>
                <p>Vencimento: ${inst.expectedDate}</p>
                <p style="font-size: 0.8rem; margin-top: 10px;">Pag. em: ${paymentDetails}</p>
            `;
            allInstallmentsGrid.appendChild(square);
        });

        allInstallmentsModal.style.display = 'block';
    });
}
