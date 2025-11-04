// =================================================================================
// 1. CONFIGURAÇÃO INICIAL E FIREBASE
// =================================================================================

// Substitua estas configurações pelas suas do Firebase
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
const db = firebase.database();
let userId = null;
let currentDebtors = [];
let currentFilter = 'todos';
let currentView = 'list';
let currentStatusFilter = 'todos';

// =================================================================================
// 2. ELEMENTOS DO DOM (Referências para o HTML)
// =================================================================================

// Header e Menu
const menuButton = document.getElementById('menuButton');
const menuDropdown = document.getElementById('menuDropdown');
const themeToggleButton = document.getElementById('themeToggleButton');
const logoutButton = document.getElementById('logoutButton');

// Estatísticas
const totalEmprestadoEl = document.getElementById('totalEmprestado');
const totalAReceberEl = document.getElementById('totalAReceber');
const clientesAtivosEl = document.getElementById('clientesAtivos');
const showTotalToggle = document.getElementById('showTotalToggle');

// Filtros
const filterActions = document.getElementById('filterActions');
const statusFilterEl = document.getElementById('statusFilter');
const listViewButton = document.getElementById('listViewButton');
const cardViewButton = document.getElementById('cardViewButton');

// Lista de Devedores
const debtorsList = document.getElementById('debtorsList');
const loadingMessage = document.getElementById('loadingMessage');
const noDebtorsMessage = document.getElementById('noDebtorsMessage');

// Modais
const addDebtorModal = document.getElementById('addDebtorModal');
const closeAddDebtorModal = document.getElementById('closeAddDebtorModal');
const debtorForm = document.getElementById('debtorForm');
const modalTitle = document.getElementById('modalTitle');
const debtorIdInput = document.getElementById('debtorId');

const detailsModal = document.getElementById('detailsModal');
const closeDetailsModal = document.getElementById('closeDetailsModal');
const detailDebtorName = document.getElementById('detailDebtorName');
const deleteDebtorButton = document.getElementById('deleteDebtorButton');
const editDebtorDetailsButton = document.getElementById('editDebtorDetailsButton');

const addPaymentModal = document.getElementById('addPaymentModal');
const closeAddPaymentModal = document.getElementById('closeAddPaymentModal');
const paymentForm = document.getElementById('paymentForm');
const openAddPaymentModalBtn = document.getElementById('openAddPaymentModal');

// Inputs de Devedor
const nameInput = document.getElementById('name');
const contactInput = document.getElementById('contact');
const loanAmountInput = document.getElementById('loanAmount');
const notesInput = document.getElementById('notes');

// =================================================================================
// 3. FUNÇÕES DE AUTENTICAÇÃO E INICIALIZAÇÃO
// =================================================================================

auth.onAuthStateChanged(user => {
    if (user) {
        userId = user.uid;
        // Inicia a sincronização
        setupDataSynchronization();
    } else {
        // Redireciona para a página de login (supondo que exista)
        window.location.href = "index.html"; 
    }
});

logoutButton.addEventListener('click', () => {
    auth.signOut().catch(error => {
        console.error("Erro ao fazer logout:", error);
    });
});

// =================================================================================
// 4. LÓGICA DE DADOS (Firebase)
// =================================================================================

/**
 * Converte a lista de pagamentos do objeto para um array.
 * @param {object} paymentsObject - Objeto de pagamentos do Firebase.
 * @returns {Array} - Array de objetos de pagamento.
 */
function toPaymentsArray(paymentsObject) {
    if (!paymentsObject) return [];
    return Object.entries(paymentsObject).map(([id, payment]) => ({
        id: id,
        ...payment
    }));
}

/**
 * Sincroniza dados com o Firebase.
 */
function setupDataSynchronization() {
    db.ref(`users/${userId}/debtors`).on('value', (snapshot) => {
        const debtorsObject = snapshot.val() || {};
        // Converte o objeto de devedores em um array, adicionando o ID
        currentDebtors = Object.entries(debtorsObject).map(([id, debtor]) => {
            const paymentsArray = toPaymentsArray(debtor.payments);
            
            // Corrige e calcula os dados para cada devedor
            const calculatedData = calculateDebtorStatus(debtor.loanAmount || 0, paymentsArray);

            return {
                id: id,
                ...debtor,
                payments: paymentsArray,
                ...calculatedData // Adiciona totalPago, restante, status e progresso
            };
        }).sort((a, b) => {
            // Ordenação básica: atrasado > ativo > quitado
            const statusOrder = { 'atrasado': 1, 'ativo': 2, 'quitado': 3 };
            return statusOrder[a.status] - statusOrder[b.status];
        });

        // Atualiza a UI
        updateStats();
        applyFiltersAndRenderList();
        loadingMessage.style.display = 'none';
        noDebtorsMessage.style.display = currentDebtors.length === 0 ? 'block' : 'none';

    }, error => {
        console.error("Erro ao sincronizar dados:", error);
        loadingMessage.textContent = "Erro ao carregar os dados. Tente novamente.";
    });
}

// =================================================================================
// 5. CÁLCULO DE ESTATÍSTICAS E STATUS (CORRIGIDO)
// =================================================================================

/**
 * Calcula o total pago, restante, status e progresso de um devedor.
 */
function calculateDebtorStatus(loanAmount, payments) {
    const totalPaid = payments
        .filter(p => p.isPaid)
        .reduce((sum, p) => sum + parseFloat(p.value), 0);
    
    const remainingAmount = Math.max(0, parseFloat(loanAmount) - totalPaid);
    
    // Status baseado na próxima data de vencimento
    let status = 'quitado'; // Default se não houver mais pagamentos

    if (remainingAmount > 0) {
        status = 'ativo'; // Default se ainda deve
        
        // Verifica se há pagamentos em aberto
        const pendingPayments = payments.filter(p => !p.isPaid);
        if (pendingPayments.length > 0) {
            const now = new Date();
            const nextDueDate = pendingPayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0].dueDate;
            
            if (new Date(nextDueDate) < now) {
                status = 'atrasado';
            } else {
                // Checa se o vencimento é muito próximo (ex: 7 dias)
                const diffTime = new Date(nextDueDate).getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) {
                    status = 'vencimentopróximo';
                }
            }
        }
    }

    const progress = Math.min(100, (totalPaid / parseFloat(loanAmount)) * 100 || 0);

    return { totalPaid, remainingAmount, status, progress: progress.toFixed(2) };
}


/**
 * Atualiza o painel de estatísticas (Total Emprestado, Clientes Ativos, Total a Receber).
 */
function updateStats() {
    let totalEmprestado = 0;
    let totalAReceber = 0;
    let clientesAtivos = 0;

    currentDebtors.forEach(debtor => {
        const loanAmount = parseFloat(debtor.loanAmount) || 0;
        totalEmprestado += loanAmount;
        totalAReceber += debtor.remainingAmount;

        if (debtor.status !== 'quitado') {
            clientesAtivos++;
        }
    });

    totalEmprestadoEl.textContent = `R$ ${totalEmprestado.toFixed(2).replace('.', ',')}`;
    totalAReceberEl.textContent = `R$ ${totalAReceber.toFixed(2).replace('.', ',')}`;
    clientesAtivosEl.textContent = clientesAtivos;
}

// =================================================================================
// 6. FUNÇÕES DE RENDERIZAÇÃO E FILTRAGEM (CORRIGIDO)
// =================================================================================

/**
 * Aplica o filtro de tempo (Diário, Semanal, Mensal)
 */
function filterByTime(debtors, filter) {
    if (filter === 'todos') return debtors;

    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return debtors.filter(debtor => {
        // Encontra o próximo pagamento não quitado
        const nextPayment = debtor.payments
            .filter(p => !p.isPaid)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
        
        if (!nextPayment) return false;
        
        const dueDate = new Date(nextPayment.dueDate);

        switch (filter) {
            case 'diarios':
                // Pagamentos que vencem hoje
                return dueDate.toDateString() === new Date().toDateString();
            case 'semanais':
                // Pagamentos que vencem até o final da semana (domingo)
                return dueDate >= startOfWeek && dueDate <= new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
            case 'mensais':
                // Pagamentos que vencem no mês atual
                return dueDate.getMonth() === new Date().getMonth() && dueDate.getFullYear() === new Date().getFullYear();
            default:
                return true;
        }
    });
}

/**
 * Aplica os filtros de tempo e status e renderiza a lista.
 */
function applyFiltersAndRenderList() {
    let filteredDebtors = filterByTime(currentDebtors, currentFilter);

    // Filtro de Status
    if (currentStatusFilter !== 'todos') {
        filteredDebtors = filteredDebtors.filter(debtor => debtor.status === currentStatusFilter);
    }

    renderDebtorsList(filteredDebtors);
}

/**
 * Gera o HTML para um único item de devedor.
 */
function createDebtorItemHTML(debtor) {
    // Formatação de valores
    const totalEmprestado = `R$ ${parseFloat(debtor.loanAmount).toFixed(2).replace('.', ',')}`;
    const restante = `R$ ${debtor.remainingAmount.toFixed(2).replace('.', ',')}`;
    
    // Status Badge
    let statusClass = '';
    let statusText = '';
    if (debtor.status === 'quitado') {
        statusClass = 'status-quitado';
        statusText = 'QUITADO';
    } else if (debtor.status === 'atrasado') {
        statusClass = 'status-atrasado';
        statusText = 'ATRASADO';
    } else if (debtor.status === 'vencimentopróximo') {
        statusClass = 'status-vencimentopróximo';
        statusText = 'VENCE LOGO';
    } else {
         statusClass = 'status-ativo';
         statusText = 'ATIVO';
    }
    const statusBadge = `<span class="status-badge ${statusClass}">${statusText}</span>`;

    // Renderiza em modo lista ou card
    if (currentView === 'list') {
        return `
            <div class="debtor-item list" data-id="${debtor.id}">
                <div class="debtor-info">
                    <strong>${debtor.name}</strong>
                    ${statusBadge}
                </div>
                <div class="debtor-data">
                    <p>Empréstimo: ${totalEmprestado}</p>
                    <p>Restante: ${restante}</p>
                    <div class="debtor-status-bar" style="max-width: 150px;">
                        <div class="debtor-status-progress" style="width: ${debtor.progress}%;"></div>
                    </div>
                </div>
                <div class="debtor-actions">
                    <button class="button-small button-tertiary view-details-btn" data-id="${debtor.id}">Detalhes</button>
                    <button class="button-small edit-debtor-btn" data-id="${debtor.id}">Editar</button>
                    <button class="button-small button-danger delete-debtor-btn" data-id="${debtor.id}">Excluir</button>
                </div>
            </div>
        `;
    } else { // Card View
        return `
            <div class="debtor-item card" data-id="${debtor.id}">
                <div class="debtor-info">
                    <h3>${debtor.name}</h3>
                    ${statusBadge}
                    <p style="margin-top: 10px;">Empréstimo: <strong>${totalEmprestado}</strong></p>
                    <p>Restante: <strong>${restante}</strong></p>
                </div>
                <div class="debtor-status-bar" style="max-width: 100%;">
                    <div class="debtor-status-progress" style="width: ${debtor.progress}%;"></div>
                </div>
                <div class="debtor-actions">
                    <button class="button-small button-tertiary view-details-btn" data-id="${debtor.id}">Detalhes</button>
                    <button class="button-small edit-debtor-btn" data-id="${debtor.id}">Editar</button>
                    <button class="button-small button-danger delete-debtor-btn" data-id="${debtor.id}">Excluir</button>
                </div>
            </div>
        `;
    }
}

/**
 * Renderiza a lista de devedores na UI.
 */
function renderDebtorsList(debtors) {
    debtorsList.innerHTML = debtors.map(createDebtorItemHTML).join('');
    
    // Configura a classe da lista para a visualização correta
    debtorsList.className = `debtors-list ${currentView}-view`;

    // Re-adiciona os event listeners
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetailsModal(e.target.dataset.id);
        });
    });
    document.querySelectorAll('.edit-debtor-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            openAddDebtorModal(e.target.dataset.id);
        });
    });
    document.querySelectorAll('.delete-debtor-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteDebtor(e.target.dataset.id);
        });
    });
}

// =================================================================================
// 7. EVENT LISTENERS (Modais e Filtros)
// =================================================================================

// Abrir/Fechar Dropdown de Menu
menuButton.addEventListener('click', () => {
    const isVisible = menuDropdown.style.display === 'block';
    menuDropdown.style.display = isVisible ? 'none' : 'block';
});
// Fechar o dropdown se clicar fora
document.addEventListener('click', (event) => {
    if (!menuButton.contains(event.target) && !menuDropdown.contains(event.target)) {
        menuDropdown.style.display = 'none';
    }
});


// Mostrar/Esconder Total a Receber
showTotalToggle.addEventListener('change', () => {
    if (showTotalToggle.checked) {
        totalAReceberEl.classList.remove('blurred-text');
    } else {
        totalAReceberEl.classList.add('blurred-text');
    }
});


// Toggle de Tema (Claro/Escuro)
themeToggleButton.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});
// Aplicar tema salvo
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
}


// NOVO: Filtros de Tempo (Todos, Diários, Semanais, Mensais)
filterActions.querySelectorAll('.filter-button').forEach(button => {
    button.addEventListener('click', (e) => {
        // Remove a classe ativa de todos os botões de filtro de tempo
        filterActions.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('filter-active'));
        
        // Adiciona a classe ativa ao botão clicado
        e.target.classList.add('filter-active');
        
        // Atualiza o filtro e renderiza a lista
        currentFilter = e.target.dataset.filter;
        applyFiltersAndRenderList();
    });
});

// Filtro de Status
statusFilterEl.addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    applyFiltersAndRenderList();
});

// Toggle de Visualização
listViewButton.addEventListener('click', () => {
    currentView = 'list';
    listViewButton.classList.add('filter-active');
    cardViewButton.classList.remove('filter-active');
    applyFiltersAndRenderList();
});
cardViewButton.addEventListener('click', () => {
    currentView = 'card';
    cardViewButton.classList.add('filter-active');
    listViewButton.classList.remove('filter-active');
    applyFiltersAndRenderList();
});


// Abrir Modal de Adicionar/Editar Devedor
document.getElementById('openAddDebtorModal').addEventListener('click', () => openAddDebtorModal());
closeAddDebtorModal.addEventListener('click', () => addDebtorModal.style.display = 'none');
document.getElementById('cancelDebtorButton').addEventListener('click', (e) => {
    e.preventDefault();
    addDebtorModal.style.display = 'none';
});


// Abrir/Fechar Modal de Detalhes
closeDetailsModal.addEventListener('click', () => detailsModal.style.display = 'none');


// Abrir/Fechar Modal de Adicionar/Editar Pagamento
closeAddPaymentModal.addEventListener('click', () => addPaymentModal.style.display = 'none');
document.getElementById('cancelPaymentButton').addEventListener('click', (e) => {
    e.preventDefault();
    addPaymentModal.style.display = 'none';
});

// Fechar modais clicando fora
window.addEventListener('click', (event) => {
    if (event.target === addDebtorModal) {
        addDebtorModal.style.display = 'none';
    }
    if (event.target === detailsModal) {
        detailsModal.style.display = 'none';
    }
    if (event.target === addPaymentModal) {
        addPaymentModal.style.display = 'none';
    }
});


// =================================================================================
// 8. CRUD DE DEVEDORES E PAGAMENTOS
// =================================================================================

// Salvar/Editar Devedor
debtorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = debtorIdInput.value;
    const isEditing = !!id;

    const debtorData = {
        name: nameInput.value,
        contact: contactInput.value,
        loanAmount: parseFloat(loanAmountInput.value).toFixed(2),
        notes: notesInput.value,
        createdAt: isEditing ? currentDebtors.find(d => d.id === id).createdAt : new Date().toISOString()
    };

    const ref = db.ref(`users/${userId}/debtors/${id || db.ref().push().key}`);
    ref.update(debtorData)
        .then(() => {
            addDebtorModal.style.display = 'none';
            alert(`Devedor ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
        })
        .catch(error => {
            alert("Erro ao salvar devedor: " + error.message);
        });
});

/**
 * Preenche e abre o modal de Adicionar/Editar Devedor.
 */
function openAddDebtorModal(id = null) {
    debtorForm.reset();
    if (id) {
        const debtor = currentDebtors.find(d => d.id === id);
        if (debtor) {
            modalTitle.textContent = "Editar Devedor";
            debtorIdInput.value = id;
            nameInput.value = debtor.name;
            contactInput.value = debtor.contact;
            loanAmountInput.value = parseFloat(debtor.loanAmount);
            notesInput.value = debtor.notes;
        }
    } else {
        modalTitle.textContent = "Adicionar Novo Devedor";
        debtorIdInput.value = '';
    }
    addDebtorModal.style.display = 'block';
}

/**
 * Excluir Devedor.
 */
function deleteDebtor(id) {
    if (confirm("Tem certeza que deseja EXCLUIR este devedor e todos os seus pagamentos? Esta ação é irreversível.")) {
        db.ref(`users/${userId}/debtors/${id}`).remove()
            .then(() => {
                alert("Devedor excluído com sucesso!");
                detailsModal.style.display = 'none';
            })
            .catch(error => {
                alert("Erro ao excluir devedor: " + error.message);
            });
    }
}

// ---------------------------------------------------------------------------------
// Lógica de Pagamentos (Corrigida)
// ---------------------------------------------------------------------------------

let currentDetailDebtorId = null;

/**
 * Renderiza o grid de pagamentos dentro do modal de detalhes.
 */
function renderPaymentsGrid(payments, debtorId) {
    const paymentsGridEl = document.getElementById('paymentsGrid');
    paymentsGridEl.innerHTML = '';
    
    if (payments.length === 0) {
        paymentsGridEl.innerHTML = '<p style="text-align: center; opacity: 0.7;">Nenhum pagamento registrado.</p>';
        return;
    }

    payments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .forEach(payment => {
        
        const isOverdue = !payment.isPaid && new Date(payment.dueDate) < new Date();
        const paymentClass = payment.isPaid ? 'paid' : (isOverdue ? 'overdue' : 'pending');
        const dueDate = new Date(payment.dueDate).toLocaleDateString('pt-BR');
        const paidDateText = payment.paidDate ? `Pago em: ${new Date(payment.paidDate).toLocaleDateString('pt-BR')}` : 'Pendente';
        
        const paymentItem = document.createElement('div');
        paymentItem.className = `payment-item ${paymentClass}`;
        paymentItem.innerHTML = `
            <h4>R$ ${parseFloat(payment.value).toFixed(2).replace('.', ',')}</h4>
            <p>Vencimento: ${dueDate}</p>
            <p>${paidDateText}</p>
            
            <button class="delete-payment-btn" data-payment-id="${payment.id}" data-debtor-id="${debtorId}" title="Excluir Pagamento">&times;</button>
        `;
        paymentsGridEl.appendChild(paymentItem);
        
        // Adiciona listener para exclusão
        paymentItem.querySelector('.delete-payment-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deletePayment(e.target.dataset.debtorId, e.target.dataset.paymentId);
        });
        
        // Adiciona listener para edição (clique no card)
        paymentItem.addEventListener('click', () => {
             openAddPaymentModal(debtorId, payment.id);
        });
    });
}

/**
 * Preenche e abre o modal de Adicionar/Editar Pagamento.
 */
openAddPaymentModalBtn.addEventListener('click', () => openAddPaymentModal(currentDetailDebtorId));

function openAddPaymentModal(debtorId, paymentId = null) {
    paymentForm.reset();
    document.getElementById('paymentDebtorId').value = debtorId;
    
    if (paymentId) {
        document.getElementById('paymentModalTitle').textContent = "Editar Pagamento";
        document.getElementById('paymentId').value = paymentId;
        
        const debtor = currentDebtors.find(d => d.id === debtorId);
        const payment = debtor.payments.find(p => p.id === paymentId);
        
        if (payment) {
            document.getElementById('paymentValue').value = parseFloat(payment.value);
            document.getElementById('paymentDueDate').value = payment.dueDate;
            document.getElementById('paymentPaidStatus').checked = payment.isPaid;
        }
    } else {
        document.getElementById('paymentModalTitle').textContent = "Adicionar Novo Pagamento";
        document.getElementById('paymentId').value = '';
    }
    
    addPaymentModal.style.display = 'block';
}

// Salvar/Editar Pagamento
paymentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const debtorId = document.getElementById('paymentDebtorId').value;
    const paymentId = document.getElementById('paymentId').value || db.ref().push().key; // Gera novo ID se for novo
    const isPaid = document.getElementById('paymentPaidStatus').checked;

    // LÓGICA DE DATA CORRIGIDA: A data de vencimento é FIXA. A data de pagamento é registrada SÓ quando é marcado como pago.
    const paymentData = {
        value: parseFloat(document.getElementById('paymentValue').value).toFixed(2),
        dueDate: document.getElementById('paymentDueDate').value, // Data de Vencimento é a data fixa
        isPaid: isPaid,
        // paidDate só é definido/atualizado se for marcado como pago. Se desmarcado, é removido.
        paidDate: isPaid ? (
            // Se já tem data de pago, mantém. Se não, usa a data atual.
            currentDebtors.find(d => d.id === debtorId)?.payments.find(p => p.id === paymentId)?.paidDate || new Date().toISOString().split('T')[0]
        ) : null
    };

    const ref = db.ref(`users/${userId}/debtors/${debtorId}/payments/${paymentId}`);
    ref.update(paymentData)
        .then(() => {
            addPaymentModal.style.display = 'none';
            alert(`Pagamento ${paymentId ? 'atualizado' : 'adicionado'} com sucesso!`);
            // Se estiver no modal de detalhes, atualiza-o
            if (detailsModal.style.display === 'block') {
                openDetailsModal(debtorId);
            }
        })
        .catch(error => {
            alert("Erro ao salvar pagamento: " + error.message);
        });
});

/**
 * Excluir Pagamento.
 */
function deletePayment(debtorId, paymentId) {
    if (confirm("Tem certeza que deseja EXCLUIR este pagamento?")) {
        db.ref(`users/${userId}/debtors/${debtorId}/payments/${paymentId}`).remove()
            .then(() => {
                alert("Pagamento excluído com sucesso!");
                // Reabre o modal de detalhes para atualizar a lista
                openDetailsModal(debtorId); 
            })
            .catch(error => {
                alert("Erro ao excluir pagamento: " + error.message);
            });
    }
}

/**
 * Abre e preenche o modal de detalhes do devedor.
 */
function openDetailsModal(id) {
    const debtor = currentDebtors.find(d => d.id === id);
    if (!debtor) return;

    currentDetailDebtorId = id;

    // Preenche informações do devedor
    detailDebtorName.textContent = debtor.name;
    document.getElementById('detailName').textContent = debtor.name;
    document.getElementById('detailContact').textContent = debtor.contact;
    document.getElementById('detailLoanAmount').textContent = `R$ ${parseFloat(debtor.loanAmount).toFixed(2).replace('.', ',')}`;
    document.getElementById('detailTotalPaid').textContent = `R$ ${debtor.totalPaid.toFixed(2).replace('.', ',')}`;
    document.getElementById('detailRemainingAmount').textContent = `R$ ${debtor.remainingAmount.toFixed(2).replace('.', ',')}`;
    document.getElementById('detailStatus').innerHTML = `<span class="status-badge status-${debtor.status}">${debtor.status.toUpperCase()}</span>`;
    document.getElementById('detailNotes').textContent = debtor.notes;

    // Preenche o botão de exclusão
    deleteDebtorButton.onclick = () => deleteDebtor(id);
    // Preenche o botão de edição
    editDebtorDetailsButton.onclick = () => {
        detailsModal.style.display = 'none';
        openAddDebtorModal(id);
    };

    // Renderiza a lista de pagamentos
    renderPaymentsGrid(debtor.payments, id);

    detailsModal.style.display = 'block';
}
