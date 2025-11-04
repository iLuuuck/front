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
    // Atualiza o conteúdo do botão do tema (ícone)
    if (themeToggleButton) {
        themeToggleButton.setAttribute('aria-label', theme === 'light' ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro');
    }
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
// ATUALIZE COM SUAS CHAVES REAIS ANTES DE USAR
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M",
    authDomain: "russo2.firebaseapp.com",
    projectId: "russo2",
    storageBucket: "russo2.firebasestorage.app",
    messagingSenderId: "5908121478",
    appId: "1:5908121478:web:1e7d8c47f7d1f5e8b6b23d"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Variáveis Globais de Estado
let currentUserId = null;
let debtors = [];
let currentDebtorId = null;
let currentFilter = 'all'; // 'all', 'daily', 'weekly', 'monthly'


// --- Lógica de Autenticação (Comum a index.html e dashboard.html) ---

// Redireciona para o dashboard se logado, ou para o login se deslogado
auth.onAuthStateChanged(user => {
    const isDashboard = window.location.pathname.endsWith('dashboard.html');
    const isLogin = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');

    if (user) {
        currentUserId = user.uid;
        if (isLogin) {
            window.location.href = 'dashboard.html';
        } else if (isDashboard) {
            loadDebtors();
        }
    } else {
        if (isDashboard) {
            window.location.href = 'index.html';
        }
    }
});

// --- Funções Auxiliares (Comuns) ---

function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

// CORREÇÃO: Função para formatar data, lidando com Timestamps ou Strings
function formatDate(timestampOrString) {
    let date;

    if (timestampOrString && timestampOrString.toDate) {
        // 1. É um Timestamp do Firebase
        date = timestampOrString.toDate();
    } else if (typeof timestampOrString === 'string') {
        // 2. É uma string (como '2025-10-27')
        // Adicionamos 'T00:00:00' para evitar problemas de fuso horário ao criar a Date de uma string 'YYYY-MM-DD'
        date = new Date(timestampOrString + 'T00:00:00'); 
    } else if (timestampOrString instanceof Date) {
        // 3. É um objeto Date
        date = timestampOrString;
    } else {
        // 4. Valor inválido
        return 'N/A';
    }

    // Verifica se a data é válida antes de tentar formatar
    if (isNaN(date.getTime())) {
        return 'Data Inválida';
    }

    return date.toLocaleDateString('pt-BR');
}

function showError(message) {
    const errorMessageDiv = document.getElementById('errorMessage');
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        setTimeout(() => {
            errorMessageDiv.style.display = 'none';
        }, 5000);
    }
}

// Função para calcular detalhes do empréstimo (igual à versão anterior)
function calculateLoanDetails(loanedAmount, installments, calculationType, amountPerInstallment, interestPercentage) {
    let totalToReceive, calculatedAmountPerInstallment, calculatedInterestPercentage;

    loanedAmount = parseFloat(loanedAmount) || 0;
    installments = parseInt(installments) || 1;

    if (calculationType === 'perInstallment') {
        calculatedAmountPerInstallment = parseFloat(amountPerInstallment) || 0;
        totalToReceive = calculatedAmountPerInstallment * installments;
        if (loanedAmount > 0) {
            calculatedInterestPercentage = ((totalToReceive - loanedAmount) / loanedAmount) * 100;
        } else {
            calculatedInterestPercentage = 0;
        }
    } else { // calculationType === 'percentage'
        calculatedInterestPercentage = parseFloat(interestPercentage) || 0;
        totalToReceive = loanedAmount * (1 + (calculatedInterestPercentage / 100));
        calculatedAmountPerInstallment = totalToReceive / installments;
    }

    return {
        totalToReceive: parseFloat(totalToReceive.toFixed(2)),
        amountPerInstallment: parseFloat(calculatedAmountPerInstallment.toFixed(2)),
        interestPercentage: parseFloat(calculatedInterestPercentage.toFixed(2))
    };
}


// --- Lógica Específica do Dashboard ---
if (window.location.pathname.endsWith('dashboard.html')) {
    // --- Variáveis e Elementos do Dashboard ---
    const logoutButton = document.getElementById('logoutButton');
    const addDebtorButton = document.getElementById('addDebtorButton');
    const debtorsList = document.getElementById('debtorsList');
    const errorMessageDiv = document.getElementById('errorMessage');

    // NOVOS ELEMENTOS DO PAINEL DE DASHBOARD
    const totalLoanedAmountElement = document.getElementById('totalLoanedAmount');
    const totalToReceiveAmountElement = document.getElementById('totalToReceiveAmount');
    const clientCountElement = document.getElementById('clientCount');

    // Modals e seus elementos
    const addEditDebtorModal = document.getElementById('addEditDebtorModal');
    const debtorDetailModal = document.getElementById('debtorDetailModal');
    const allInstallmentsModal = document.getElementById('allInstallmentsModal');
    const closeButtons = document.querySelectorAll('.modal .close-button');
    const addEditDebtorForm = document.getElementById('addEditDebtorForm');

    // Elementos do Form
    const debtorNameInput = document.getElementById('debtorName');
    const debtorDescriptionInput = document.getElementById('debtorDescription');
    const loanedAmountInput = document.getElementById('loanedAmount');
    const frequencySelect = document.getElementById('frequency');
    const calculationTypeSelect = document.getElementById('calculationType');
    const perInstallmentFields = document.getElementById('perInstallmentFields');
    const amountPerInstallmentInput = document.getElementById('amountPerInstallmentInput');
    const installmentsInput = document.getElementById('installments');
    const percentageFields = document.getElementById('percentageFields');
    const interestPercentageInput = document.getElementById('interestPercentageInput');
    const startDateInput = document.getElementById('startDate');
    const saveDebtorButton = document.getElementById('saveDebtorButton');
    
    // Elementos de Detalhes
    const paymentsGrid = document.getElementById('paymentsGrid');
    const paymentAmountInput = document.getElementById('paymentAmount');
    const paymentDateInput = document.getElementById('paymentDate');
    const addPaymentButton = document.getElementById('addPaymentButton');
    const fillAmountButton = document.getElementById('fillAmountButton');
    const toggleTotalToReceive = document.getElementById('toggleTotalToReceive');

    // Elementos de Filtro
    const filterAllButton = document.getElementById('filterAllButton');
    const filterDailyButton = document.getElementById('filterDailyButton');
    const filterWeeklyButton = document.getElementById('filterWeeklyButton');
    const filterMonthlyButton = document.getElementById('filterMonthlyButton');

    // Elementos Telegram
    const generateLinkCodeButton = document.getElementById('generateLinkCodeButton');
    const linkCodeDisplay = document.getElementById('linkCodeDisplay');


    // --- NOVO: Função para Atualizar Estatísticas do Dashboard ---
    function updateDashboardStats() {
        let totalLoaned = 0;
        let totalToReceive = 0;
        const clientCount = debtors.length; // Usa a lista global (unfiltered)

        // Itera sobre todos os devedores para somar os valores
        debtors.forEach(debtor => {
            // VALOR TOTAL EMPRESTADO
            totalLoaned += debtor.loanedAmount || 0;
            
            // VALOR TOTAL A RECEBER (Juros Inclusos)
            totalToReceive += debtor.totalToReceive || 0;
        });

        // Atualiza os elementos HTML com os valores formatados
        if (totalLoanedAmountElement) {
            totalLoanedAmountElement.textContent = formatCurrency(totalLoaned);
        }
        if (totalToReceiveAmountElement) {
            totalToReceiveAmountElement.textContent = formatCurrency(totalToReceive);
        }
        if (clientCountElement) {
            clientCountElement.textContent = clientCount;
        }
    }

    // --- Carregamento de Dados ---
    function loadDebtors() {
        if (!currentUserId) return;
        
        db.collection('users').doc(currentUserId).collection('debtors').orderBy('name').onSnapshot(snapshot => {
            debtors = [];
            snapshot.forEach(doc => {
                const debtor = doc.data();
                debtor.id = doc.id;
                // Garante que payments é um array para o cálculo
                if (!Array.isArray(debtor.payments)) {
                    debtor.payments = [];
                }
                debtors.push(debtor);
            });
            renderDebtors();
        }, error => {
            console.error("Erro ao carregar devedores:", error);
            showError("Erro ao carregar os dados dos devedores.");
        });
    }

    // --- Renderização de Devedores na Lista Principal ---
    function renderDebtors() {
        // CHAMA A FUNÇÃO DE ESTATÍSTICAS para garantir que os números do painel estão atualizados
        updateDashboardStats(); 

        debtorsList.innerHTML = '';
        
        const filteredDebtors = debtors.filter(debtor => {
            if (currentFilter === 'daily') return debtor.frequency === 'daily';
            if (currentFilter === 'weekly') return debtor.frequency === 'weekly';
            if (currentFilter === 'monthly') return debtor.frequency === 'monthly';
            return true;
        });

        if (filteredDebtors.length === 0) {
            debtorsList.innerHTML = '<p class="loading-message">Nenhum devedor encontrado com o filtro atual.</p>';
            return;
        }

        filteredDebtors.forEach(debtor => {
            const totalPaid = debtor.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const remainingAmount = debtor.totalToReceive - totalPaid;
            const progressPercentage = debtor.totalToReceive > 0 ? (totalPaid / debtor.totalToReceive) * 100 : 0;
            const statusText = remainingAmount <= 0 ? 'Pago' : `Faltam: ${formatCurrency(remainingAmount)}`;
            const isFinished = remainingAmount <= 0;

            const debtorItem = document.createElement('div');
            debtorItem.className = 'debtor-item';
            debtorItem.setAttribute('data-id', debtor.id);

            debtorItem.innerHTML = `
                <div class="debtor-info">
                    <h3>${debtor.name}</h3>
                    <p>${debtor.description || 'Sem descrição'}</p>
                    <p>Total a Receber: ${formatCurrency(debtor.totalToReceive)}</p>
                    <p class="${isFinished ? 'success-text' : 'error-text'}">${statusText}</p>
                </div>
                <div class="debtor-status-bar">
                    <div class="debtor-status-fill" style="width: ${Math.min(100, progressPercentage)}%;"></div>
                </div>
                <div class="debtor-actions">
                    <button class="button view-debtor-details button-secondary" data-id="${debtor.id}">Detalhes</button>
                    <button class="button edit-debtor button-secondary" data-id="${debtor.id}">Editar</button>
                    <button class="button button-delete delete-debtor" data-id="${debtor.id}">Excluir</button>
                </div>
            `;

            debtorsList.appendChild(debtorItem);
        });
        
        // Adiciona listeners para os novos elementos renderizados
        document.querySelectorAll('.view-debtor-details').forEach(button => {
            button.addEventListener('click', (e) => showDebtorDetails(e.target.dataset.id));
        });
        document.querySelectorAll('.edit-debtor').forEach(button => {
            button.addEventListener('click', (e) => openAddEditModal(e.target.dataset.id));
        });
        document.querySelectorAll('.delete-debtor').forEach(button => {
            button.addEventListener('click', (e) => deleteDebtor(e.target.dataset.id));
        });
    }

    // --- CRUD: Modal Adicionar/Editar ---
    function openAddEditModal(id = null) {
        addEditDebtorForm.reset();
        currentDebtorId = id;
        document.getElementById('addEditModalTitle').textContent = id ? 'Editar Devedor' : 'Adicionar Novo Devedor';
        
        // Exibe/Esconde campos de cálculo
        const toggleCalculationFields = () => {
            if (calculationTypeSelect.value === 'perInstallment') {
                perInstallmentFields.style.display = 'block';
                percentageFields.style.display = 'none';
                amountPerInstallmentInput.setAttribute('required', 'required');
                interestPercentageInput.removeAttribute('required');
            } else {
                perInstallmentFields.style.display = 'none';
                percentageFields.style.display = 'block';
                amountPerInstallmentInput.removeAttribute('required');
                interestPercentageInput.setAttribute('required', 'required');
            }
        };

        calculationTypeSelect.onchange = toggleCalculationFields;

        if (id) {
            const debtor = debtors.find(d => d.id === id);
            if (debtor) {
                debtorNameInput.value = debtor.name;
                debtorDescriptionInput.value = debtor.description;
                loanedAmountInput.value = debtor.loanedAmount;
                frequencySelect.value = debtor.frequency;
                installmentsInput.value = debtor.installments;
                startDateInput.value = debtor.startDate;
                calculationTypeSelect.value = debtor.calculationType || 'perInstallment';
                amountPerInstallmentInput.value = debtor.amountPerInstallment || '';
                interestPercentageInput.value = debtor.interestPercentage || '';
            }
        } else {
            // Valores padrão para novo devedor
            startDateInput.valueAsDate = new Date();
        }
        
        toggleCalculationFields(); // Chama a função na abertura do modal
        addEditDebtorModal.style.display = 'block';
    }

    addEditDebtorForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const loanedAmount = parseFloat(loanedAmountInput.value);
        const installments = parseInt(installmentsInput.value);
        const calculationType = calculationTypeSelect.value;
        const amountPerInstallment = parseFloat(amountPerInstallmentInput.value) || 0;
        const interestPercentage = parseFloat(interestPercentageInput.value) || 0;

        // Calcula os valores finais, independentemente do tipo de cálculo
        const loanDetails = calculateLoanDetails(loanedAmount, installments, calculationType, amountPerInstallment, interestPercentage);
        
        const debtorData = {
            name: debtorNameInput.value,
            description: debtorDescriptionInput.value,
            loanedAmount: loanedAmount,
            frequency: frequencySelect.value,
            installments: installments,
            startDate: startDateInput.value,
            calculationType: calculationType,
            amountPerInstallment: loanDetails.amountPerInstallment,
            interestPercentage: loanDetails.interestPercentage,
            totalToReceive: loanDetails.totalToReceive,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        };

        try {
            const debtorsRef = db.collection('users').doc(currentUserId).collection('debtors');
            if (currentDebtorId) {
                // Atualizar
                await debtorsRef.doc(currentDebtorId).update(debtorData);
                alert('Devedor atualizado com sucesso!');
            } else {
                // Adicionar
                debtorData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                debtorData.payments = [];
                await debtorsRef.add(debtorData);
                alert('Devedor adicionado com sucesso!');
            }
            addEditDebtorModal.style.display = 'none';
        } catch (error) {
            console.error("Erro ao salvar devedor:", error);
            showError(`Erro ao salvar devedor: ${error.message}`);
        }
    });

    function deleteDebtor(id) {
        if (!confirm('Tem certeza que deseja EXCLUIR este devedor e todos os seus pagamentos? Esta ação é irreversível.')) {
            return;
        }

        db.collection('users').doc(currentUserId).collection('debtors').doc(id).delete()
            .then(() => {
                alert('Devedor excluído com sucesso!');
                debtorDetailModal.style.display = 'none';
            })
            .catch(error => {
                console.error("Erro ao excluir devedor:", error);
                showError(`Erro ao excluir devedor: ${error.message}`);
            });
    }
    
    // --- Lógica de Detalhes e Pagamentos ---

    function renderPayments(debtor, showAllInstallments = false) {
        const totalPaid = debtor.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const remainingAmount = debtor.totalToReceive - totalPaid;
        const amountPerInstallment = debtor.amountPerInstallment;
        const installments = debtor.installments;

        // 1. Calcula as datas esperadas das parcelas
        const expectedInstallments = [];
        // NOTA: Usamos a string para garantir que a data inicial seja consistente
        let currentDate = new Date(debtor.startDate + 'T00:00:00'); 

        for (let i = 1; i <= installments; i++) {
            let expectedDate = new Date(currentDate);

            // Ajusta a data para a próxima parcela
            if (i > 1) {
                if (debtor.frequency === 'daily') {
                    expectedDate.setDate(expectedDate.getDate() + 1);
                } else if (debtor.frequency === 'weekly') {
                    expectedDate.setDate(expectedDate.getDate() + 7);
                } else if (debtor.frequency === 'monthly') {
                    expectedDate.setMonth(expectedDate.getMonth() + 1);
                }
                currentDate = expectedDate;
            }

            // Verifica se um pagamento já cobre esta parcela (simples: verifica a ordem e a quantidade)
            const payment = debtor.payments[i - 1]; // Assume que os pagamentos são registrados em ordem

            expectedInstallments.push({
                index: i,
                expectedDate: expectedDate, // Mantemos como objeto Date para fácil formatação
                amount: amountPerInstallment,
                paid: !!payment,
                paymentDate: payment ? formatDate(payment.date) : 'N/A',
                paymentAmount: payment ? payment.amount : 'N/A'
            });
        }
        
        // 2. Renderiza na Grid de Pagamentos
        paymentsGrid.innerHTML = '';
        const paymentsToRender = showAllInstallments ? expectedInstallments : expectedInstallments.filter(i => !i.paid);

        if (paymentsToRender.length === 0 && !showAllInstallments) {
            paymentsGrid.innerHTML = `<p class="loading-message">${remainingAmount <= 0 ? 'Todas as parcelas foram pagas!' : 'Nenhuma parcela pendente.'}</p>`;
        } else if (paymentsToRender.length === 0 && showAllInstallments) {
            paymentsGrid.innerHTML = `<p class="loading-message">Nenhuma parcela gerada.</p>`;
        } else {
            paymentsToRender.forEach(inst => {
                const item = document.createElement('div');
                item.className = 'payment-item';
                item.style.backgroundColor = inst.paid ? 'var(--success-color)' : 'var(--error-color)';
                item.style.opacity = inst.paid ? 0.7 : 1;
                
                item.innerHTML = `
                    <div>
                        <strong>Parc. ${inst.index}</strong>
                        <p>${formatCurrency(inst.amount)}</p>
                    </div>
                    <div>
                        <p>${inst.paid ? 'Pago em:' : 'Vencimento:'}</p>
                        <p>${inst.paid ? inst.paymentDate : formatDate(inst.expectedDate)}</p>
                    </div>
                `;
                paymentsGrid.appendChild(item);
            });
        }

        // Atualiza campos de pagamento
        paymentAmountInput.value = remainingAmount > 0 ? amountPerInstallment.toFixed(2) : '0.00';
        // CORREÇÃO: Define a data de pagamento como a data de hoje
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Mês começa do 0
        const dd = String(today.getDate()).padStart(2, '0');
        paymentDateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    function showDebtorDetails(id) {
        const debtor = debtors.find(d => d.id === id);
        if (!debtor) return;
        currentDebtorId = id;

        // Define os detalhes
        document.getElementById('detailDebtorName').textContent = debtor.name;
        document.getElementById('detailDebtorDescription').textContent = debtor.description || 'N/A';
        document.getElementById('detailLoanedAmount').textContent = formatCurrency(debtor.loanedAmount);
        
        // Lógica para esconder/mostrar Total a Receber
        const totalToReceiveSpan = document.getElementById('detailTotalToReceive');
        const updateTotalToReceiveDisplay = () => {
            if (toggleTotalToReceive.checked) {
                totalToReceiveSpan.textContent = '*** Oculto ***';
            } else {
                totalToReceiveSpan.textContent = formatCurrency(debtor.totalToReceive);
            }
        };

        // Carrega estado do toggle
        const isHidden = localStorage.getItem(`hideTotal_${currentDebtorId}`) === 'true';
        toggleTotalToReceive.checked = isHidden;
        updateTotalToReceiveDisplay();

        // Listener para o toggle
        toggleTotalToReceive.onchange = () => {
            localStorage.setItem(`hideTotal_${currentDebtorId}`, toggleTotalToReceive.checked);
            updateTotalToReceiveDisplay();
        };

        document.getElementById('detailInterestPercentage').textContent = `${debtor.interestPercentage}%`;
        document.getElementById('detailInstallments').textContent = debtor.installments;
        document.getElementById('detailAmountPerInstallment').textContent = formatCurrency(debtor.amountPerInstallment);
        document.getElementById('detailStartDate').textContent = formatDate(debtor.startDate);
        document.getElementById('detailFrequency').textContent = debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal';

        // Renderiza os pagamentos
        renderPayments(debtor);

        // Abre o modal de detalhes
        debtorDetailModal.style.display = 'block';
    }

    function addPayment() {
        if (!currentDebtorId) return;

        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (!debtor) return;

        const paymentAmount = parseFloat(paymentAmountInput.value);
        const paymentDate = paymentDateInput.value;

        if (isNaN(paymentAmount) || paymentAmount <= 0 || !paymentDate) {
            showError('Insira um valor e uma data de pagamento válidos.');
            return;
        }

        // Criamos o objeto Date primeiro para evitar problemas de fuso horário, depois convertemos para Timestamp
        const dateObject = new Date(paymentDate + 'T00:00:00');
        
        const newPayment = {
            amount: paymentAmount,
            date: firebase.firestore.Timestamp.fromDate(dateObject)
        };

        const updatedPayments = [...debtor.payments, newPayment].sort((a, b) => {
            // Ordena por data (timestamp)
            const dateA = a.date.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const dateB = b.date.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return dateA - dateB;
        });

        db.collection('users').doc(currentUserId).collection('debtors').doc(currentDebtorId).update({
            payments: updatedPayments,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            alert('Pagamento adicionado com sucesso!');
            // O snapshot listener do loadDebtors cuidará de re-renderizar
            // Fechamos o modal para garantir o refresh de dados
            debtorDetailModal.style.display = 'none';
        })
        .catch(error => {
            console.error("Erro ao adicionar pagamento:", error);
            showError(`Erro ao adicionar pagamento: ${error.message}`);
        });
    }

    // --- Lógica de Parcelas ---
    
    function renderAllInstallments(debtor) {
        const allInstallmentsGrid = document.getElementById('allInstallmentsGrid');
        allInstallmentsGrid.innerHTML = '';

        // 1. Calcula as datas esperadas das parcelas (reutilizando a lógica de renderPayments)
        const expectedInstallments = [];
        let currentDate = new Date(debtor.startDate + 'T00:00:00'); 
        const amountPerInstallment = debtor.amountPerInstallment;

        for (let i = 1; i <= debtor.installments; i++) {
            let expectedDate = new Date(currentDate);

            if (i > 1) {
                if (debtor.frequency === 'daily') {
                    expectedDate.setDate(expectedDate.getDate() + 1);
                } else if (debtor.frequency === 'weekly') {
                    expectedDate.setDate(expectedDate.getDate() + 7);
                } else if (debtor.frequency === 'monthly') {
                    expectedDate.setMonth(expectedDate.getMonth() + 1);
                }
                currentDate = expectedDate;
            }

            const payment = debtor.payments[i - 1];

            expectedInstallments.push({
                index: i,
                expectedDate: expectedDate,
                amount: amountPerInstallment,
                paid: !!payment,
                paymentDate: payment ? formatDate(payment.date) : 'N/A',
                paymentAmount: payment ? payment.amount : 'N/A',
                paymentIndex: i - 1 // Índice no array de pagamentos (se pago)
            });
        }

        // 2. Renderiza na Grid de Todas as Parcelas
        expectedInstallments.forEach((inst) => {
            const item = document.createElement('div');
            item.className = `installment-square ${inst.paid ? 'paid' : 'unpaid'}`;
            
            const expectedDateOnly = new Date(inst.expectedDate.toDateString());
            const todayDateOnly = new Date(new Date().toDateString());
            const isDueOrOverdue = !inst.paid && expectedDateOnly <= todayDateOnly;

            item.innerHTML = `
                <h4>Parcela ${inst.index}</h4>
                <p>Valor: ${formatCurrency(inst.amount)}</p>
                <p>${inst.paid ? 'Pago em:' : 'Vencimento:'}</p>
                <p><strong>${inst.paid ? inst.paymentDate : formatDate(inst.expectedDate)}</strong></p>
                ${!inst.paid ? `<p style="color: ${isDueOrOverdue ? 'var(--error-color)' : 'var(--text-color)'}; font-weight: bold;">${isDueOrOverdue ? 'VENCIDA/HOJE' : 'PENDENTE'}</p>` : `<p>Pago: ${formatCurrency(inst.paymentAmount)}</p>`}
                ${!inst.paid ? `<button class="installment-mark-paid" data-index="${inst.index}" data-amount="${inst.amount}">Marcar como Paga</button>` : ''}
            `;
            allInstallmentsGrid.appendChild(item);
        });

        // Adiciona Listener para o botão de Marcar como Paga
        document.querySelectorAll('.installment-mark-paid').forEach(button => {
            button.addEventListener('click', (e) => markInstallmentAsPaid(e.target.dataset.index, e.target.dataset.amount));
        });

        document.getElementById('allInstallmentsTitle').textContent = `Todas as Parcelas de ${debtor.name}`;
        allInstallmentsModal.style.display = 'block';
    }

    async function markInstallmentAsPaid(installmentIndex, amount) {
        if (!currentDebtorId) return;

        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (!debtor) return;

        const index = parseInt(installmentIndex);
        const amountValue = parseFloat(amount);
        
        // Usa a data de hoje formatada (YYYY-MM-DD) para consistência no Firebase
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayString = `${yyyy}-${mm}-${dd}`;
        
        // Verifica se a parcela já foi paga (evitar duplicação)
        if (debtor.payments.length >= index) {
            alert('Esta parcela já foi paga.');
            return;
        }

        // Adiciona o pagamento (o sistema de cálculo de parcelas depende da ordem)
        // Criamos o objeto Date primeiro para evitar problemas de fuso horário, depois convertemos para Timestamp
        const dateObject = new Date(todayString + 'T00:00:00');
        
        const newPayment = {
            amount: amountValue,
            date: firebase.firestore.Timestamp.fromDate(dateObject)
        };

        const updatedPayments = [...debtor.payments, newPayment].sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const dateB = b.date.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return dateA - dateB;
        });
        
        try {
            await db.collection('users').doc(currentUserId).collection('debtors').doc(currentDebtorId).update({
                payments: updatedPayments,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(`Parcela ${index} de ${debtor.name} marcada como paga!`);
            allInstallmentsModal.style.display = 'none';
            debtorDetailModal.style.display = 'none'; // Fecha o modal de detalhes para forçar o recarregamento
        } catch (error) {
            console.error("Erro ao marcar parcela como paga:", error);
            showError(`Erro ao marcar parcela como paga: ${error.message}`);
        }
    }

    // --- Event Listeners ---
    logoutButton.addEventListener('click', () => {
        auth.signOut();
    });

    addDebtorButton.addEventListener('click', () => openAddEditModal());

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            addEditDebtorModal.style.display = 'none';
            debtorDetailModal.style.display = 'none';
            allInstallmentsModal.style.display = 'none';
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === addEditDebtorModal) {
            addEditDebtorModal.style.display = 'none';
        }
        if (event.target === debtorDetailModal) {
            debtorDetailModal.style.display = 'none';
        }
        if (event.target === allInstallmentsModal) {
            allInstallmentsModal.style.display = 'none';
        }
    });

    // Listener para o botão de Adicionar Pagamento
    addPaymentButton.addEventListener('click', addPayment);

    // Listener para o botão de Preencher Valor
    fillAmountButton.addEventListener('click', () => {
        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (debtor) {
            paymentAmountInput.value = debtor.amountPerInstallment.toFixed(2);
        }
    });

    // Listener para o botão de Exibir Todas as Parcelas
    document.getElementById('showAllInstallmentsButton').addEventListener('click', () => {
        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (debtor) {
            renderAllInstallments(debtor);
        }
    });

    // Listener para fechar o modal de todas as parcelas
    document.getElementById('closeAllInstallmentsModal').addEventListener('click', () => {
        allInstallmentsModal.style.display = 'none';
    });


    // --- Listeners de Filtro ---
    const filterButtons = [
        { id: filterAllButton, filter: 'all' },
        { id: filterDailyButton, filter: 'daily' },
        { id: filterWeeklyButton, filter: 'weekly' },
        { id: filterMonthlyButton, filter: 'monthly' }
    ];

    function setActiveFilterButton(activeFilter) {
        filterButtons.forEach(btn => {
            btn.id.className = btn.filter === activeFilter ? 'button' : 'button button-secondary';
        });
    }
    
    filterButtons.forEach(btn => {
        btn.id.addEventListener('click', () => {
            currentFilter = btn.filter;
            setActiveFilterButton(currentFilter);
            renderDebtors();
        });
    });

    // Define o filtro padrão na inicialização
    setActiveFilterButton(currentFilter);

    // --- Lógica de Vínculo Telegram ---
    if (generateLinkCodeButton) {
        generateLinkCodeButton.addEventListener('click', async () => {
            if (!currentUserId) return;

            try {
                // 1. Gera um código aleatório simples (ex: 6 dígitos)
                const code = Math.floor(100000 + Math.random() * 900000).toString();

                // 2. Salva o código no Firestore para que o bot possa encontrá-lo
                await db.collection('link_codes').add({
                    code: code,
                    userId: currentUserId,
                    email: auth.currentUser.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 5) // Expira em 5 minutos
                });

                // 3. Exibe o código na tela
                linkCodeDisplay.textContent = code;
                generateLinkCodeButton.textContent = 'Gerado! (5 min)';
                generateLinkCodeButton.disabled = true;

                alert(`Código gerado: ${code}\nUse o comando /vincular ${code} no Telegram. Expira em 5 minutos.`);
                
                // Reabilita o botão após 5 minutos
                setTimeout(() => {
                    generateLinkCodeButton.textContent = 'Gerar Código Telegram';
                    generateLinkCodeButton.disabled = false;
                    linkCodeDisplay.textContent = '';
                }, 1000 * 60 * 5); // 5 minutos

            } catch (error) {
                console.error("Erro ao gerar código de vínculo:", error);
                alert('Erro ao gerar código. Tente novamente.');
            }
        });
    }

} // FIM do if (window.location.pathname.endsWith('dashboard.html')) { ... }
// ... (outra lógica para index.html se existir) ...
