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
    messagingSenderId: "590812147823",
    appId: "1:590812147823:web:65e10086c8a77d853e41de"
};

// Inicialização do Firebase App
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- 0. VARIÁVEIS GLOBAIS DE ESTADO E REFERÊNCIA ---
let currentUserId = null;
let debtors = []; // Array que armazena os devedores do usuário
let currentDebtorId = null; // ID do devedor sendo visualizado/editado
let currentFilter = 'all'; // all, paidOff, overdue, dueSoon
let currentViewMode = localStorage.getItem('viewMode') || 'card'; // 'card' ou 'list'

// VARIÁVEIS DE ELEMENTOS HTML
let addEditDebtorModal, debtorDetailModal, deleteConfirmModal;
let addEditDebtorForm, addEditModalTitle, debtorNameInput, debtorPhoneInput, debtorDescriptionInput, loanedAmountInput,
    installmentsInput, startDateInput, interestPercentageInput, saveDebtorButton, loanPaidOffCheckbox, frequencyInput,
    amountPerInstallmentInput, calculationTypeSelect, perInstallmentFields, percentageFields;

let detailDebtorName, detailLoanedAmount, detailTotalToReceive, detailInterestPercentage, toggleTotalToReceive,
    detailInstallments, detailStartDate, detailFrequency, paymentsGrid, paymentAmountInput, paymentDateInput,
    paymentError, addPaymentButton, fillAmountButton, showAllInstallmentsButton, detailDebtorDescription, detailAmountPerInstallment;

let debtorsList, totalToReceiveValue, totalPaidValue, activeDebtorsCount;
let addDebtorButton;

// --- 1. FUNÇÕES AUXILIARES DE DATA E FORMATO ---

/**
 * Formata um valor numérico para o formato de moeda Real (BRL).
 * @param {number} value - O valor a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Formata uma string de data (ISO 8601) para o formato local (dd/mm/aaaa).
 * @param {string} dateString - A data no formato 'yyyy-mm-dd'.
 * @returns {string} A data formatada.
 */
function formatDate(dateString) {
    if (!dateString) return 'N/D';
    try {
        const date = new Date(dateString + 'T00:00:00'); // Adiciona T00:00:00 para evitar desvios de fuso
        return date.toLocaleDateString('pt-BR');
    } catch (e) {
        return dateString;
    }
}

/**
 * Converte um valor de frequência para uma string de exibição.
 * @param {string} frequency - O valor interno da frequência ('daily', 'weekly', 'monthly').
 * @returns {string} O valor da frequência formatado.
 */
function formatFrequency(frequency) {
    switch (frequency) {
        case 'daily': return 'Diário';
        case 'weekly': return 'Semanal';
        case 'monthly': return 'Mensal';
        default: return 'N/D';
    }
}

// --- 2. FUNÇÕES DE CÁLCULO E LÓGICA DE NEGÓCIO ---

/**
 * Calcula o total de juros, valor por parcela e total a receber.
 * @param {number} loanedAmount - O valor emprestado.
 * @param {string} calculationType - 'perInstallment' ou 'percentage'.
 * @param {number} interestPercentage - A taxa de juros (se calculationType for 'percentage').
 * @param {number} installments - O número de parcelas.
 * @param {number} amountPerInstallment - O valor por parcela (se calculationType for 'perInstallment').
 * @returns {{amountPerInstallment: number, totalToReceive: number, totalInterest: number}} Os detalhes do empréstimo.
 */
function calculateLoanDetails(loanedAmount, calculationType, interestPercentage, installments, amountPerInstallment) {
    let totalToReceive, calculatedAmountPerInstallment, totalInterest;

    if (calculationType === 'perInstallment') {
        // Cálculo baseado no valor por parcela
        calculatedAmountPerInstallment = parseFloat(amountPerInstallment);
        totalToReceive = calculatedAmountPerInstallment * installments;
        totalInterest = totalToReceive - loanedAmount;
        
    } else if (calculationType === 'percentage') {
        // Cálculo baseado na porcentagem
        const totalAmountPercentage = 1 + (parseFloat(interestPercentage) / 100);
        totalToReceive = loanedAmount * totalAmountPercentage;
        calculatedAmountPerInstallment = totalToReceive / installments;
        totalInterest = totalToReceive - loanedAmount;
    } else {
        // Caso padrão (sem juros ou cálculo inválido)
        calculatedAmountPerInstallment = loanedAmount / installments;
        totalToReceive = loanedAmount;
        totalInterest = 0;
    }

    return {
        amountPerInstallment: calculatedAmountPerInstallment,
        totalToReceive: totalToReceive,
        totalInterest: totalInterest
    };
}

/**
 * Calcula o próximo pagamento esperado e o status do devedor.
 * @param {Object} debtor - O objeto devedor.
 * @returns {{nextPaymentDate: string, status: string}}
 */
function getDebtorStatus(debtor) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments = debtor.payments || [];
    const paymentsCount = payments.length;
    
    // Calcula o valor total pago
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    debtor.totalPaid = totalPaid; // Atualiza o objeto do devedor com o total pago

    // Verifica se está quitado
    if (totalPaid >= debtor.totalToReceive) {
        return { nextPaymentDate: 'Quitado', status: 'Quitado' };
    }

    const { startDate, installments, frequency } = debtor;
    
    if (!startDate) return { nextPaymentDate: 'N/D', status: 'Ativo' };

    const startDateObj = new Date(startDate + 'T00:00:00');
    let nextDueDate = new Date(startDateObj);
    
    // Calcula a data da próxima parcela
    let paymentIncrement = 0;
    if (frequency === 'daily') {
        paymentIncrement = 1;
    } else if (frequency === 'weekly') {
        paymentIncrement = 7;
    } else if (frequency === 'monthly') {
        paymentIncrement = 1; // Incrementa o mês
    }

    // Calcula a data de vencimento da próxima parcela a ser paga
    for (let i = 0; i < installments; i++) {
        let currentDueDate = new Date(startDateObj);
        
        if (frequency === 'daily' || frequency === 'weekly') {
             currentDueDate.setDate(currentDueDate.getDate() + (i * paymentIncrement));
        } else if (frequency === 'monthly') {
             currentDueDate.setMonth(currentDueDate.getMonth() + i);
        }

        // Se o número de pagamentos for menor ou igual ao índice da parcela atual, esta é a próxima a vencer.
        if (paymentsCount <= i) {
            nextDueDate = currentDueDate;
            break;
        }

        // Se o loop terminar e ainda houver parcelas restantes, use a data da última parcela.
        if (i === installments - 1) {
            nextDueDate = currentDueDate;
        }
    }
    
    nextDueDate.setHours(0, 0, 0, 0);
    const nextPaymentDateString = nextDueDate.toISOString().split('T')[0];
    
    // Determina o status
    let status = 'Ativo';
    
    // 1. Está atrasado? (Venceu e não foi pago)
    if (nextDueDate < today && paymentsCount < installments) {
        status = 'Atrasado';
    } 
    // 2. Vencimento Próximo? (Vence em até 7 dias e não foi pago)
    else if (nextDueDate >= today && nextDueDate <= new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000)) && paymentsCount < installments) {
        status = 'Vencimento Próximo';
    } 

    return { 
        nextPaymentDate: formatDate(nextPaymentDateString), 
        status: status 
    };
}

// --- 3. FUNÇÕES DE RENDERIZAÇÃO E UI ---

/**
 * Cria o HTML para um único item de devedor na lista/grid.
 * @param {Object} debtor - O objeto devedor.
 * @param {string} viewMode - 'card' ou 'list'.
 * @returns {string} HTML do item devedor.
 */
function renderDebtorItem(debtor, viewMode) {
    const { nextPaymentDate, status } = getDebtorStatus(debtor);
    const isList = viewMode === 'list';
    
    // Define a classe CSS com base no status para estilização
    let statusClass = status.replace(/\s/g, '').toLowerCase();

    // Calcula o progresso (porcentagem paga)
    const totalPaid = debtor.totalPaid || 0;
    const progress = Math.min(100, (totalPaid / debtor.totalToReceive) * 100 || 0);

    return `
        <div class="debtor-item ${viewMode}" data-id="${debtor.id}">
            <div class="debtor-info">
                <h3 class="debtor-name">${debtor.debtorName}</h3>
                <p class="debtor-description">${debtor.debtorDescription || 'N/D'}</p>
                <div class="debtor-status-bar" title="Progresso: ${Math.round(progress)}%">
                    <div class="debtor-status-progress" style="width: ${progress}%;"></div>
                </div>
            </div>
            
            ${isList ? `
                <div class="debtor-data">
                    <p><strong>Valor Emprestado:</strong> ${formatCurrency(debtor.loanedAmount)}</p>
                    <p><strong>Total a Pagar:</strong> ${formatCurrency(debtor.totalToReceive)}</p>
                    <p><strong>Pago:</strong> ${formatCurrency(totalPaid)}</p>
                </div>
            ` : ''}

            <div class="debtor-status">
                <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${status}</span></p>
                <p><strong>Próximo Venc.:</strong> ${nextPaymentDate}</p>
            </div>
            
            <div class="debtor-actions">
                <button class="button button-secondary button-small view-details-btn" data-id="${debtor.id}">Ver Detalhes</button>
                <button class="button button-tertiary button-small edit-debtor-btn" data-id="${debtor.id}">Editar</button>
                <button class="button button-danger button-small delete-debtor-btn" data-id="${debtor.id}">Excluir</button>
            </div>
        </div>
    `;
}

/**
 * Renderiza a lista completa de devedores na UI.
 */
function renderDebtors() {
    if (!debtorsList) return;

    // Aplica o filtro atual
    let filteredDebtors = debtors;
    if (currentFilter !== 'all') {
        filteredDebtors = debtors.filter(debtor => {
            const { status } = getDebtorStatus(debtor);
            switch (currentFilter) {
                case 'paidOff':
                    return status === 'Quitado';
                case 'overdue':
                    return status === 'Atrasado';
                case 'dueSoon':
                    return status === 'Vencimento Próximo';
                default:
                    return true;
            }
        });
    }

    // Ordena por status e data
    filteredDebtors.sort((a, b) => {
        const statusA = getDebtorStatus(a).status;
        const statusB = getDebtorStatus(b).status;
        
        // Ordem de prioridade: Atrasado > Vencimento Próximo > Ativo > Quitado
        const order = { 'Atrasado': 1, 'Vencimento Próximo': 2, 'Ativo': 3, 'Quitado': 4, 'N/D': 5 };
        
        if (order[statusA] !== order[statusB]) {
            return order[statusA] - order[statusB];
        }
        
        // Em caso de mesmo status, ordena por data de início (mais antigo primeiro)
        return new Date(a.startDate) - new Date(b.startDate);
    });
    
    debtorsList.innerHTML = filteredDebtors.map(debtor => renderDebtorItem(debtor, currentViewMode)).join('');
    
    // Atualiza as estatísticas
    updateStatistics();
    
    // Adiciona Listeners aos botões gerados dinamicamente
    addDebtorItemListeners();
}

/**
 * Adiciona listeners aos botões de detalhes, editar e excluir em cada item de devedor.
 */
function addDebtorItemListeners() {
    // Listeners para Ver Detalhes
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation();
            openDebtorDetailsModal(button.dataset.id);
        };
    });

    // Listeners para Editar Devedor
    document.querySelectorAll('.edit-debtor-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation();
            openAddEditDebtorModal(button.dataset.id);
        };
    });

    // Listeners para Excluir Devedor
    document.querySelectorAll('.delete-debtor-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Tem certeza que deseja excluir o devedor: ${debtors.find(d => d.id === button.dataset.id)?.debtorName}?`)) {
                deleteDebtor(button.dataset.id);
            }
        };
    });
    
    // Listeners para abrir detalhes ao clicar no item (apenas no modo Card)
    document.querySelectorAll('.debtor-item.card').forEach(item => {
        item.onclick = (e) => {
            // Evita que o clique no botão de ação dispare o clique no item
            if (e.target.closest('.debtor-actions')) return; 
            openDebtorDetailsModal(item.dataset.id);
        };
    });
}

/**
 * Atualiza o painel de estatísticas com os totais calculados.
 */
function updateStatistics() {
    if (!totalToReceiveValue || !totalPaidValue || !activeDebtorsCount) return;

    const totalToReceive = debtors.reduce((sum, d) => sum + (d.totalToReceive || 0), 0);
    const totalPaid = debtors.reduce((sum, d) => sum + (d.totalPaid || 0), 0);
    const activeCount = debtors.filter(d => getDebtorStatus(d).status !== 'Quitado').length;
    
    totalToReceiveValue.textContent = formatCurrency(totalToReceive);
    totalPaidValue.textContent = formatCurrency(totalPaid);
    activeDebtorsCount.textContent = activeCount.toString();
}

/**
 * Aplica o modo de visualização ('card' ou 'list') ao container de devedores.
 * @param {string} mode - 'card' ou 'list'.
 */
function applyViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('viewMode', mode);
    if (debtorsList) {
        debtorsList.classList.remove('card-view', 'list-view');
        debtorsList.classList.add(mode + '-view');
        renderDebtors(); // Re-renderiza para aplicar a nova visualização
    }
}

/**
 * Atualiza a classe 'filter-active' nos botões de filtro.
 * @param {string} buttonId - O ID do botão que deve ser marcado como ativo.
 */
function updateFilterButtons(buttonId) {
    document.querySelectorAll('.filter-actions .button').forEach(btn => {
        btn.classList.remove('filter-active');
    });
    const activeBtn = document.getElementById(buttonId);
    if (activeBtn) {
        activeBtn.classList.add('filter-active');
        currentFilter = buttonId.replace('filter', '').replace('Button', '').toLowerCase();
        // Apenas 'all', 'paidOff', 'overdue', 'dueSoon' são válidos no filtro
        if (currentFilter === 'vencimentopróximo') currentFilter = 'dueSoon'; 
        if (currentFilter === '') currentFilter = 'all'; 
        renderDebtors();
    }
}


// --- 4. FUNÇÕES DE MODAIS E FORMULÁRIOS ---

/**
 * Abre o modal de adicionar/editar devedor, preenchendo-o se um ID for fornecido.
 * @param {string|null} [id=null] - O ID do devedor a ser editado, ou null para adicionar.
 */
function openAddEditDebtorModal(id = null) {
    if (!addEditDebtorModal) return;

    currentDebtorId = id;
    addEditDebtorForm.reset();
    
    if (id) {
        addEditModalTitle.textContent = 'Editar Devedor';
        const debtor = debtors.find(d => d.id === id);
        if (debtor) {
            debtorNameInput.value = debtor.debtorName || '';
            debtorDescriptionInput.value = debtor.debtorDescription || '';
            debtorPhoneInput.value = debtor.debtorPhone || '';
            loanedAmountInput.value = debtor.loanedAmount || 0;
            installmentsInput.value = debtor.installments || 1;
            startDateInput.value = debtor.startDate || '';
            frequencyInput.value = debtor.frequency || 'monthly';
            loanPaidOffCheckbox.checked = debtor.loanPaidOff || false;

            // Define os campos de cálculo e exibe o grupo correto
            if (debtor.calculationType === 'percentage') {
                calculationTypeSelect.value = 'percentage';
                interestPercentageInput.value = debtor.interestPercentage || 0;
                amountPerInstallmentInput.value = ''; // Limpa o outro campo
            } else {
                // Padrão ou 'perInstallment'
                calculationTypeSelect.value = 'perInstallment';
                amountPerInstallmentInput.value = debtor.amountPerInstallment || 0;
                interestPercentageInput.value = ''; // Limpa o outro campo
            }
            toggleCalculationFields(); // Garante que a exibição dos campos está correta
        }
    } else {
        addEditModalTitle.textContent = 'Adicionar Novo Devedor';
        calculationTypeSelect.value = 'perInstallment'; // Padrão
        toggleCalculationFields();
    }

    addEditDebtorModal.style.display = 'block';
}

/**
 * Alterna a visibilidade dos campos de cálculo de juros (Valor por Parcela vs. Porcentagem).
 */
function toggleCalculationFields() {
    if (calculationTypeSelect.value === 'percentage') {
        perInstallmentFields.style.display = 'none';
        amountPerInstallmentInput.removeAttribute('required');
        
        percentageFields.style.display = 'block';
        interestPercentageInput.setAttribute('required', 'required');
    } else {
        perInstallmentFields.style.display = 'block';
        amountPerInstallmentInput.setAttribute('required', 'required');
        
        percentageFields.style.display = 'none';
        interestPercentageInput.removeAttribute('required');
    }
}


/**
 * Abre o modal de detalhes do devedor.
 * @param {string} id - O ID do devedor a ser visualizado.
 */
function openDebtorDetailsModal(id) {
    if (!debtorDetailModal) return;

    const debtor = debtors.find(d => d.id === id);
    if (!debtor) {
        console.error('Devedor não encontrado:', id);
        return;
    }

    currentDebtorId = id;
    
    // Atualiza os detalhes
    detailDebtorName.textContent = debtor.debtorName || 'N/D';
    document.getElementById('debtorDetailPhone').textContent = debtor.debtorPhone || 'N/D';
    detailDebtorDescription.textContent = debtor.debtorDescription || 'N/D';
    detailLoanedAmount.textContent = formatCurrency(debtor.loanedAmount);
    detailInterestPercentage.textContent = (debtor.interestPercentage || 0) + '%';
    detailInstallments.textContent = debtor.installments || 'N/D';
    detailAmountPerInstallment.textContent = formatCurrency(debtor.amountPerInstallment);
    detailStartDate.textContent = formatDate(debtor.startDate);
    detailFrequency.textContent = formatFrequency(debtor.frequency);
    detailTotalToReceive.textContent = formatCurrency(debtor.totalToReceive);
    
    // Atualiza o status e próxima data
    const { nextPaymentDate, status } = getDebtorStatus(debtor);
    document.getElementById('debtorDetailNextPayment').textContent = nextPaymentDate;
    document.getElementById('debtorDetailStatus').textContent = status;
    document.getElementById('debtorDetailStatus').className = `status-badge ${status.replace(/\s/g, '').toLowerCase()}`;


    // Configura o toggle de Total a Pagar para esconder/mostrar
    const toggleChecked = localStorage.getItem(`hideTotal-${currentUserId}`) === 'true';
    toggleTotalToReceive.checked = toggleChecked;
    // Dispara a função para aplicar o estado visual
    toggleTotalVisibility();
    
    // Renderiza a lista de pagamentos
    renderPaymentsGrid(debtor);

    // Limpa os campos de pagamento
    paymentAmountInput.value = '';
    paymentDateInput.value = new Date().toISOString().split('T')[0];
    paymentError.style.display = 'none';

    debtorDetailModal.style.display = 'block';
}

/**
 * Renderiza o grid de pagamentos com base no histórico do devedor.
 * @param {Object} debtor - O objeto devedor.
 * @param {boolean} [showAll=false] - Se deve exibir todas as parcelas (pagas e pendentes).
 */
function renderPaymentsGrid(debtor, showAll = false) {
    if (!paymentsGrid) return;
    
    const payments = debtor.payments || [];
    const paymentsCount = payments.length;
    const items = [];
    
    // Calcula o valor total pago para determinar o índice da próxima parcela
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const amountPerInstallment = debtor.amountPerInstallment || 0;
    
    // Se o valor pago for maior que o total a receber, não há parcelas a exibir
    if (totalPaid >= debtor.totalToReceive) {
         showAll = true; // Força a exibição de todos os pagamentos se estiver quitado
    }

    // Calcula todas as datas de vencimento para exibição
    const dueDates = [];
    const startDateObj = new Date(debtor.startDate + 'T00:00:00');
    let paymentIncrement = 0;
    if (debtor.frequency === 'daily') paymentIncrement = 1;
    if (debtor.frequency === 'weekly') paymentIncrement = 7;
    if (debtor.frequency === 'monthly') paymentIncrement = 1;

    for (let i = 0; i < debtor.installments; i++) {
        let dueDate = new Date(startDateObj);
        
        if (debtor.frequency === 'daily' || debtor.frequency === 'weekly') {
             dueDate.setDate(dueDate.getDate() + (i * paymentIncrement));
        } else if (debtor.frequency === 'monthly') {
             dueDate.setMonth(dueDate.getMonth() + i);
        }
        
        dueDates.push(dueDate.toISOString().split('T')[0]);
    }
    
    paymentsGrid.innerHTML = '';
    
    for (let i = 0; i < debtor.installments; i++) {
        const payment = payments[i];
        const isPaid = !!payment; // Verifica se já existe um pagamento registrado
        const dueDate = dueDates[i];
        
        let paymentStatusClass = '';
        let paymentStatusText = `Venc.: ${formatDate(dueDate)}`;
        let paymentAmount = formatCurrency(amountPerInstallment);

        if (isPaid) {
            paymentStatusClass = 'paid';
            paymentStatusText = `Pago: ${formatDate(payment.paymentDate)}`;
            paymentAmount = formatCurrency(payment.amount);
        } else {
            const today = new Date().toISOString().split('T')[0];
            if (dueDate < today) {
                 paymentStatusClass = 'overdue';
                 paymentStatusText = `Atrasado: ${formatDate(dueDate)}`;
            } else {
                 paymentStatusClass = 'pending';
            }
        }
        
        // Se não for para exibir todas as parcelas, exibe apenas as pagas + a próxima pendente
        if (!showAll && i > paymentsCount && !isPaid) {
            continue; // Pula as parcelas pendentes futuras
        }
        
        items.push(`
            <div class="payment-item ${paymentStatusClass}" data-index="${i}">
                <p><strong>Parcela ${i + 1}</strong></p>
                <p class="payment-amount">${paymentAmount}</p>
                <p class="payment-date">${paymentStatusText}</p>
                ${isPaid ? `<button class="button-small button-danger delete-payment-btn" data-index="${i}" data-debtor-id="${debtor.id}">X</button>` : ''}
            </div>
        `);
    }

    paymentsGrid.innerHTML = items.join('');
    
    // Adiciona listeners para excluir pagamento
    document.querySelectorAll('.delete-payment-btn').forEach(button => {
        button.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Tem certeza que deseja excluir o pagamento da parcela ${parseInt(button.dataset.index) + 1}?`)) {
                deletePayment(button.dataset.debtorId, parseInt(button.dataset.index));
            }
        };
    });
}

/**
 * Alterna a visibilidade do valor total a pagar no modal de detalhes.
 */
function toggleTotalVisibility() {
    if (!detailTotalToReceive || !toggleTotalToReceive) return;
    
    const hide = toggleTotalToReceive.checked;
    
    if (hide) {
        detailTotalToReceive.classList.add('blurred-text');
    } else {
        detailTotalToReceive.classList.remove('blurred-text');
    }
    
    localStorage.setItem(`hideTotal-${currentUserId}`, hide);
}

// --- 5. FUNÇÕES DE BANCO DE DADOS (Firestore) ---

/**
 * Inicia o listener em tempo real para os devedores do usuário logado.
 */
function setupFirestoreListener() {
    if (!currentUserId) return;

    db.collection('debtors').doc(currentUserId).collection('userDebtors')
        .orderBy('startDate', 'asc') // Ordena por data de início para consistência
        .onSnapshot(snapshot => {
            debtors = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Recalcula o status e total pago para cada devedor
            debtors.forEach(debtor => {
                getDebtorStatus(debtor); // Atualiza totalPaid
            });
            
            renderDebtors();
            console.log("Devedores atualizados em tempo real.");
        }, error => {
            console.error("Erro ao receber dados em tempo real: ", error);
        });
}

/**
 * Salva ou atualiza um devedor no Firestore.
 * @param {Object} debtorData - Os dados do devedor.
 */
async function saveDebtor(debtorData) {
    if (!currentUserId) return;

    try {
        const debtorRef = db.collection('debtors').doc(currentUserId).collection('userDebtors');
        
        // Se for edição, atualiza
        if (currentDebtorId) {
            // Preserva o histórico de pagamentos ao editar
            const existingDebtor = debtors.find(d => d.id === currentDebtorId);
            if (existingDebtor) {
                debtorData.payments = existingDebtor.payments || [];
            }
            
            await debtorRef.doc(currentDebtorId).update(debtorData);
            console.log('Devedor atualizado com ID: ', currentDebtorId);
        } 
        // Se for adição, adiciona um novo
        else {
            debtorData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await debtorRef.add(debtorData);
            console.log('Novo devedor adicionado.');
        }

        addEditDebtorModal.style.display = 'none';
        currentDebtorId = null;
    } catch (error) {
        console.error('Erro ao salvar devedor: ', error);
        alert('Erro ao salvar os dados. Tente novamente.');
    }
}

/**
 * Exclui um devedor do Firestore.
 * @param {string} id - O ID do devedor a ser excluído.
 */
async function deleteDebtor(id) {
    if (!currentUserId) return;

    try {
        await db.collection('debtors').doc(currentUserId).collection('userDebtors').doc(id).delete();
        console.log('Devedor excluído com ID: ', id);
        // Fecha o modal de detalhes se estiver aberto
        if (debtorDetailModal) debtorDetailModal.style.display = 'none';
    } catch (error) {
        console.error('Erro ao excluir devedor: ', error);
        alert('Erro ao excluir o devedor. Tente novamente.');
    }
}

/**
 * Registra um pagamento para o devedor atual.
 */
async function recordPayment() {
    if (!currentUserId || !currentDebtorId) return;

    const amount = parseFloat(paymentAmountInput.value);
    const date = paymentDateInput.value;

    if (isNaN(amount) || amount <= 0 || !date) {
        paymentError.textContent = 'Preencha o valor e a data do pagamento corretamente.';
        paymentError.style.display = 'block';
        return;
    }
    
    paymentError.style.display = 'none';

    try {
        const debtorRef = db.collection('debtors').doc(currentUserId).collection('userDebtors').doc(currentDebtorId);
        const debtor = debtors.find(d => d.id === currentDebtorId);
        
        if (!debtor) throw new Error("Devedor não encontrado.");
        
        // Verifica se o pagamento ultrapassa o valor total restante
        const totalPaidBefore = debtor.payments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = debtor.totalToReceive - totalPaidBefore;
        
        if (amount > remaining) {
             if (!confirm(`O valor de ${formatCurrency(amount)} é maior que o saldo restante de ${formatCurrency(remaining)}. Deseja continuar e quitar o restante?`)) {
                return;
             }
        }
        
        const newPayment = {
            amount: amount,
            paymentDate: date,
            registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Adiciona o novo pagamento ao array
        const updatedPayments = [...(debtor.payments || []), newPayment];
        
        // Ordena os pagamentos por data de pagamento (opcional, mas bom para consistência)
        updatedPayments.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));

        await debtorRef.update({
            payments: updatedPayments,
            // O campo loanPaidOff será atualizado implicitamente pelo listener do Firestore
            // ao recalcular o status no getDebtorStatus.
        });

        // Limpa os campos após o sucesso
        paymentAmountInput.value = '';
        paymentDateInput.value = new Date().toISOString().split('T')[0];
        
        // Re-abre o modal de detalhes para atualizar a visualização
        openDebtorDetailsModal(currentDebtorId);
        
    } catch (error) {
        console.error('Erro ao registrar pagamento: ', error);
        paymentError.textContent = 'Erro ao registrar pagamento. Tente novamente.';
        paymentError.style.display = 'block';
    }
}

/**
 * Exclui um pagamento específico do histórico de pagamentos de um devedor.
 * @param {string} debtorId - O ID do devedor.
 * @param {number} paymentIndex - O índice (baseado em zero) do pagamento a ser excluído.
 */
async function deletePayment(debtorId, paymentIndex) {
    if (!currentUserId || !debtorId) return;

    try {
        const debtorRef = db.collection('debtors').doc(currentUserId).collection('userDebtors').doc(debtorId);
        const debtor = debtors.find(d => d.id === debtorId);

        if (!debtor) throw new Error("Devedor não encontrado.");

        const updatedPayments = (debtor.payments || []).filter((_, index) => index !== paymentIndex);
        
        // Reordena o array de pagamentos por data (para manter a consistência)
        updatedPayments.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));

        await debtorRef.update({
            payments: updatedPayments,
        });
        
        // Re-abre o modal de detalhes para atualizar a visualização
        openDebtorDetailsModal(debtorId);
        
    } catch (error) {
        console.error('Erro ao excluir pagamento: ', error);
        alert('Erro ao excluir pagamento. Tente novamente.');
    }
}


// --- 6. FUNÇÕES DE AUTENTICAÇÃO ---

/**
 * Função para registrar um novo usuário.
 * @param {string} email - Email do usuário.
 * @param {string} password - Senha do usuário.
 */
async function registerUser(email, password) {
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        alert('Cadastro realizado com sucesso! Você será redirecionado para o dashboard.');
        // O listener do auth.onAuthStateChanged cuidará do redirecionamento
    } catch (error) {
        console.error("Erro no cadastro:", error);
        document.getElementById('registerError').textContent = `Erro: ${error.message}`;
    }
}

/**
 * Função para logar um usuário.
 * @param {string} email - Email do usuário.
 * @param {string} password - Senha do usuário.
 */
async function loginUser(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // O listener do auth.onAuthStateChanged cuidará do redirecionamento
    } catch (error) {
        console.error("Erro no login:", error);
        document.getElementById('loginError').textContent = `Erro: ${error.message}`;
    }
}

/**
 * Função para deslogar o usuário.
 */
function logoutUser() {
    auth.signOut().then(() => {
        // Redirecionamento é tratado pelo listener
    }).catch((error) => {
        console.error("Erro ao sair:", error);
    });
}


// --- 7. EVENT LISTENERS E INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Lógica de Auth para index.html ---
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
        
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const showRegisterButton = document.getElementById('showRegisterButton');
        const showLoginButton = document.getElementById('showLoginButton');
        const loginSection = document.querySelector('.login-section');
        const registerSection = document.querySelector('.register-section');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                loginUser(email, password);
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                const confirmPassword = document.getElementById('registerConfirmPassword').value;
                
                if (password !== confirmPassword) {
                    document.getElementById('registerError').textContent = 'As senhas não coincidem.';
                    return;
                }
                document.getElementById('registerError').textContent = '';
                registerUser(email, password);
            });
        }
        
        if (showRegisterButton && loginSection && registerSection) {
             showRegisterButton.addEventListener('click', () => {
                 loginSection.classList.remove('active');
                 registerSection.classList.add('active');
             });
        }

        if (showLoginButton && loginSection && registerSection) {
             showLoginButton.addEventListener('click', () => {
                 registerSection.classList.remove('active');
                 loginSection.classList.add('active');
             });
        }
        
    } 
    
    // --- Lógica de Dashboard para dashboard.html ---
    if (window.location.pathname.endsWith('dashboard.html')) {
        
        // --- 1. INICIALIZAÇÃO DE TODOS OS ELEMENTOS USANDO AS VARIÁVEIS GLOBAIS (let) ---
        
        // Modals
        addEditDebtorModal = document.getElementById('addEditDebtorModal');
        debtorDetailModal = document.getElementById('debtorDetailsModal');
        
        // Dashboard
        debtorsList = document.getElementById('debtorsList');
        addDebtorButton = document.getElementById('addDebtorButton');
        totalToReceiveValue = document.getElementById('totalToReceiveValue');
        totalPaidValue = document.getElementById('totalPaidValue');
        activeDebtorsCount = document.getElementById('activeDebtorsCount');
        const logoutButton = document.getElementById('logoutButton');
        const menuButton = document.getElementById('menuButton');
        const menuDropdown = document.getElementById('menuDropdown');
        const toggleViewButton = document.getElementById('toggleViewButton');
        
        // Inicialização de Modals e Botões no Modal de Detalhes
        const closeButtons = document.querySelectorAll('.modal .close-button');
        // CORRIGIDO: O botão de registrar pagamento se chama 'recordPaymentButton'
        addPaymentButton = document.getElementById('recordPaymentButton'); 
        fillAmountButton = document.getElementById('fillAmountButton');
        showAllInstallmentsButton = document.getElementById('showAllInstallmentsButton'); 
        
        // Modal de Adicionar/Editar
        addEditDebtorForm = document.getElementById('addEditDebtorForm'); // ID CORRIGIDO
        addEditModalTitle = document.getElementById('addEditModalTitle'); // ID CORRIGIDO
        debtorNameInput = document.getElementById('debtorName');
        debtorDescriptionInput = document.getElementById('debtorDescription'); // ID CORRIGIDO
        debtorPhoneInput = document.getElementById('debtorPhone');
        loanedAmountInput = document.getElementById('loanedAmount'); 
        installmentsInput = document.getElementById('installments'); 
        startDateInput = document.getElementById('startDate'); // ID CORRIGIDO
        frequencyInput = document.getElementById('frequencyInput'); // ID CORRIGIDO
        loanPaidOffCheckbox = document.getElementById('loanPaidOff');
        saveDebtorButton = document.getElementById('saveDebtorButton'); 
        
        // Campos de Cálculo
        calculationTypeSelect = document.getElementById('calculationType'); // ID CORRIGIDO
        perInstallmentFields = document.getElementById('perInstallmentFields'); // ID CORRIGIDO
        percentageFields = document.getElementById('percentageFields'); // ID CORRIGIDO
        amountPerInstallmentInput = document.getElementById('amountPerInstallmentInput'); // ID CORRIGIDO
        interestPercentageInput = document.getElementById('interestPercentageInput'); // ID CORRIGIDO
        
        // Modal de Detalhes
        detailDebtorName = document.getElementById('detailDebtorName');
        detailDebtorDescription = document.getElementById('detailDebtorDescription'); // ID CORRIGIDO
        detailLoanedAmount = document.getElementById('detailLoanedAmount');
        detailTotalToReceive = document.getElementById('detailTotalToReceive');
        detailInterestPercentage = document.getElementById('detailInterestPercentage');
        toggleTotalToReceive = document.getElementById('toggleTotalToReceive');
        detailInstallments = document.getElementById('detailInstallments');
        detailAmountPerInstallment = document.getElementById('detailAmountPerInstallment'); // ID CORRIGIDO
        detailStartDate = document.getElementById('detailStartDate');
        detailFrequency = document.getElementById('detailFrequency'); 
        paymentsGrid = document.getElementById('paymentsGrid');
        paymentAmountInput = document.getElementById('paymentAmount');
        paymentDateInput = document.getElementById('paymentDate');
        paymentError = document.getElementById('paymentError');
        
        // Elemento Botão de Editar no Modal de Detalhes
        const editDebtorDetailsButton = document.getElementById('editDebtorDetailsButton'); // Variável local
        const deleteDebtorButton = document.getElementById('deleteDebtorButton'); // Variável local

        // --- 2. RESTANTE DOS LISTENERS E FUNÇÕES AUXILIARES DE RENDERIZAÇÃO ---
        
        // Listeners para fechar modais
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (addEditDebtorModal) addEditDebtorModal.style.display = 'none';
                if (debtorDetailModal) debtorDetailModal.style.display = 'none';
            });
        });

        // Listener para fechar modais ao clicar fora
        window.onclick = (event) => {
            if (event.target == addEditDebtorModal) {
                addEditDebtorModal.style.display = 'none';
            }
            if (event.target == debtorDetailModal) {
                debtorDetailModal.style.display = 'none';
            }
            if (menuDropdown) {
                 // Fecha o menu dropdown se estiver aberto e o clique não for no botão
                 if (!event.target.closest('.header-menu')) {
                     menuDropdown.style.display = 'none';
                 }
            }
        };
        
        // Listener Botão "Adicionar Novo Devedor" (AGORA FUNCIONA)
        if(addDebtorButton) {
             addDebtorButton.addEventListener('click', () => openAddEditDebtorModal());
        }
        
        // Listener Botão "Editar Devedor" no modal de detalhes (AGORA FUNCIONA)
        if(editDebtorDetailsButton) {
            editDebtorDetailsButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (debtorDetailModal) debtorDetailModal.style.display = 'none'; // Fecha o modal de detalhes
                if (currentDebtorId) openAddEditDebtorModal(currentDebtorId); // Abre o modal de edição
            });
        }
        
        // Listener Botão "Excluir Devedor" no modal de detalhes
        if(deleteDebtorButton) {
            deleteDebtorButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (currentDebtorId && confirm('Tem certeza que deseja EXCLUIR este devedor e todos os seus dados?')) {
                    deleteDebtor(currentDebtorId);
                }
            });
        }
        
        // Lógica para alternar campos de cálculo (Valor por Parcela vs. Porcentagem)
        if (calculationTypeSelect) {
            calculationTypeSelect.addEventListener('change', toggleCalculationFields);
            toggleCalculationFields(); // Chama na inicialização
        }

        // Listener de Submissão do Formulário de Adicionar/Editar (AGORA FUNCIONA)
        if (addEditDebtorForm) {
            addEditDebtorForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // 1. Coleta e validação básica
                const debtorName = debtorNameInput.value.trim();
                const loanedAmount = parseFloat(loanedAmountInput.value);
                const installments = parseInt(installmentsInput.value);
                const startDate = startDateInput.value;
                const frequency = frequencyInput.value;
                const calculationType = calculationTypeSelect.value;
                
                if (!debtorName || isNaN(loanedAmount) || loanedAmount <= 0 || isNaN(installments) || installments <= 0 || !startDate) {
                    alert('Por favor, preencha todos os campos obrigatórios corretamente.');
                    return;
                }
                
                let interestPercentage = 0;
                let amountPerInstallment = 0;
                
                if (calculationType === 'percentage') {
                    interestPercentage = parseFloat(interestPercentageInput.value) || 0;
                } else if (calculationType === 'perInstallment') {
                    amountPerInstallment = parseFloat(amountPerInstallmentInput.value) || 0;
                    if (amountPerInstallment <= 0) {
                         alert('O Valor por Parcela deve ser maior que zero.');
                         return;
                    }
                }
                
                // 2. Cálculo dos detalhes financeiros
                const loanDetails = calculateLoanDetails(
                    loanedAmount, 
                    calculationType, 
                    interestPercentage, 
                    installments, 
                    amountPerInstallment
                );
                
                // 3. Montagem do objeto
                const debtorData = {
                    debtorName,
                    debtorDescription: debtorDescriptionInput.value.trim(),
                    debtorPhone: debtorPhoneInput.value.trim(),
                    loanedAmount,
                    installments,
                    startDate,
                    frequency,
                    calculationType,
                    interestPercentage: interestPercentage, // Salva o campo, mesmo se for 0
                    amountPerInstallment: loanDetails.amountPerInstallment,
                    totalToReceive: loanDetails.totalToReceive,
                    totalInterest: loanDetails.totalInterest,
                };

                saveDebtor(debtorData);
            });
        }

        // Listener Botão "Registrar Pagamento" (AGORA FUNCIONA)
        if (addPaymentButton) {
            addPaymentButton.addEventListener('click', recordPayment);
        }
        
        // Listener Botão "Preencher Valor" (Preenche o input de pagamento com o valor da próxima parcela)
        if (fillAmountButton) {
            fillAmountButton.addEventListener('click', () => {
                if (!currentDebtorId) return;
                const debtor = debtors.find(d => d.id === currentDebtorId);
                if (debtor && debtor.amountPerInstallment) {
                    paymentAmountInput.value = debtor.amountPerInstallment.toFixed(2);
                }
            });
        }
        
        // Listener para o Toggle de Total a Pagar
        if (toggleTotalToReceive) {
            toggleTotalToReceive.addEventListener('change', toggleTotalVisibility);
        }
        
        // Listener Botão "Exibir Todas as Parcelas"
        if (showAllInstallmentsButton) {
             showAllInstallmentsButton.addEventListener('click', () => {
                 if (!currentDebtorId) return;
                 const debtor = debtors.find(d => d.id === currentDebtorId);
                 if (debtor) {
                    // Alterna o texto do botão e a visualização
                    const isShowingAll = showAllInstallmentsButton.textContent === 'Exibir Menos Parcelas';
                    renderPaymentsGrid(debtor, !isShowingAll);
                    showAllInstallmentsButton.textContent = isShowingAll ? 'Exibir Todas as Parcelas' : 'Exibir Menos Parcelas';
                 }
            });
        }
        
        // Listeners dos Botões de Filtro
        document.querySelectorAll('.filter-actions .button').forEach(button => {
            button.addEventListener('click', (e) => {
                updateFilterButtons(e.currentTarget.id);
            });
        });
        
        // Listener do Menu Dropdown
        if (menuButton && menuDropdown) {
            menuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // Alterna a exibição do menu
                menuDropdown.style.display = menuDropdown.style.display === 'block' ? 'none' : 'block';
            });
        }
        
        // Listener para Alternar a Visualização (Card/Lista)
        if (toggleViewButton) {
            toggleViewButton.addEventListener('click', () => {
                const newMode = currentViewMode === 'card' ? 'list' : 'card';
                applyViewMode(newMode);
            });
        }
        
        // Listener de Sair
        if (logoutButton) {
            logoutButton.addEventListener('click', logoutUser);
        }
        
        // --- Lógica Final do Auth State para Dashboard ---
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUserId = user.uid; 
                console.log("Usuário logado:", user.email, "UID:", user.uid);
                setupFirestoreListener(); 
                // Inicializa o filtro e modo de visualização
                updateFilterButtons('filterAllButton'); 
                applyViewMode(currentViewMode); 
            } else {
                currentUserId = null; 
                debtors = []; 
                renderDebtors(); 
                console.log("Nenhum usuário logado.");
            }
        });

    } // FIM do if (window.location.pathname.endsWith('dashboard.html')) { ... }
    
    // Listener de estado de autenticação: Redireciona quando o usuário loga/desloga 
    auth.onAuthStateChanged((user) => {
        if (user) {
            if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                window.location.href = 'dashboard.html';
            }
        } else {
            if (window.location.pathname.endsWith('dashboard.html')) {
                window.location.href = 'index.html'; 
            }
        }
    });

}); // FIM do DOMContentLoaded
