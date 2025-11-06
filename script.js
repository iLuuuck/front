// --- Configuração e Inicialização do Firebase ---
// ATENÇÃO: Mantenha a sua configuração COMPLETA e REAL do Firebase aqui.
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M", // <-- MANTENHA O SEU VALOR REAL
    authDomain: "russo2.firebaseapp.com", // <-- MANTENHA O SEU VALOR REAL
    projectId: "russo2", // <-- MANTENHA O SEU VALOR REAL
    storageBucket: "russo2.firebasestorage.app",
    messagingSenderId: "590812147841",
    appId: "1:590812147841:web:da98880beb257e0de3dd80"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const DEBTORS_COLLECTION = 'debtors';

// --- FUNÇÕES AUXILIARES GLOBAIS ---

function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function formatDate(timestampOrString) {
    if (!timestampOrString) return 'N/A';
    let date;
    if (typeof timestampOrString === 'object' && typeof timestampOrString.toDate === 'function') {
        date = timestampOrString.toDate();
    } else if (typeof timestampOrString === 'string') {
        date = new Date(timestampOrString.replace(/-/g, '/')); // Corrigir para suportar formatos de data
    } else {
        date = new Date(timestampOrString);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Funções de Cálculo (Mantidas do Admin)
function calculateLoanDetails(loanedAmount, amountPerInstallment, installments, interestPercentage, calculationType) {
    let totalToReceive;
    let calculatedAmountPerInstallment;
    let calculatedInstallments = parseInt(installments); 

    if (isNaN(calculatedInstallments) || calculatedInstallments <= 0) {
        calculatedInstallments = 1; 
    }

    if (calculationType === 'perInstallment') {
        calculatedAmountPerInstallment = parseFloat(amountPerInstallment);
        totalToReceive = calculatedAmountPerInstallment * calculatedInstallments;
        interestPercentage = ((totalToReceive - loanedAmount) / loanedAmount * 100);
        if (isNaN(interestPercentage) || !isFinite(interestPercentage)) { 
            interestPercentage = 0;
        }
    } else { // percentage
        interestPercentage = parseFloat(interestPercentage);
        totalToReceive = loanedAmount * (1 + interestPercentage / 100);
        calculatedAmountPerInstallment = totalToReceive / calculatedInstallments;
    }

    return {
        totalToReceive: parseFloat(totalToReceive.toFixed(2)),
        amountPerInstallment: parseFloat(calculatedAmountPerInstallment.toFixed(2)),
        installments: calculatedInstallments,
        interestPercentage: parseFloat(interestPercentage.toFixed(2))
    };
}

// --- LÓGICA DE DETECÇÃO DE PÁGINA ---

// Lógica para login (index.html) e dashboard (dashboard.html)
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    
    // --- LÓGICA DE LOGIN DO CLIENTE (usa #clientLoginForm) ---
    const loginForm = document.getElementById('clientLoginForm');

    if (loginForm) {
        // Se este formulário existe, estamos na tela de login do CLIENTE
        const uniqueCodeInput = document.getElementById('uniqueCode');
        const errorMessageDiv = document.getElementById('errorMessage');

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorMessageDiv.style.display = 'none';
            errorMessageDiv.textContent = 'Carregando...';

            const accessCode = uniqueCodeInput.value.trim().toUpperCase();

            if (!accessCode || accessCode.length !== 6) {
                errorMessageDiv.textContent = 'O código deve ter 6 caracteres alfanuméricos.';
                errorMessageDiv.style.display = 'block';
                return;
            }

            try {
                // 1. Busca o devedor no Firestore pelo accessCode
                const snapshot = await db.collection(DEBTORS_COLLECTION)
                    .where('accessCode', '==', accessCode)
                    .limit(1)
                    .get();

                if (snapshot.empty) {
                    errorMessageDiv.textContent = 'Código de acesso incorreto ou devedor não encontrado.';
                    errorMessageDiv.style.display = 'block';
                    return;
                }

                // 2. Devedor encontrado!
                const debtorDoc = snapshot.docs[0];
                const debtorId = debtorDoc.id;

                // 3. Armazena o ID do devedor no Local Storage (ou Session Storage)
                // Usando Local Storage para persistir a sessão do cliente
                localStorage.setItem('clientID', debtorId);
                
                // 4. Redireciona para o portal do cliente
                window.location.href = 'dashboard.html';

            } catch (error) {
                console.error("Erro no login do devedor:", error);
                errorMessageDiv.textContent = 'Ocorreu um erro ao verificar o código. Tente novamente.';
                errorMessageDiv.style.display = 'block';
            }
        });
    } else {
        // --- LÓGICA DE LOGIN/REGISTRO DO ADMINISTRADOR (Se você ainda tiver index.html separado para o Admin) ---
        // Se você não tem mais login Admin aqui, remova este bloco "else".
    }

} else if (window.location.pathname.endsWith('dashboard.html')) {
    
    // --- DETECÇÃO DE ADMIN vs CLIENTE ---
    
    const clientMainContent = document.getElementById('clientMainContent');
    const clientID = localStorage.getItem('clientID');
    const isAdminDashboard = !clientID; // Se não houver clientID no localStorage, consideramos que é o Admin.
    
    if (isAdminDashboard) {
        // --- LÓGICA DO DASHBOARD DO ADMINISTRADOR (SEU CÓDIGO ORIGINAL COMPLETO) ---
        
        // --- VARIÁVEIS DO DOM EXISTENTES ---
        const logoutButton = document.getElementById('logoutButton');
        const addDebtorButton = document.getElementById('addDebtorButton');
        const debtorsList = document.getElementById('debtorsList');
        const errorMessageDiv = document.getElementById('errorMessage');

        // Modals e seus elementos
        const debtorDetailModal = document.getElementById('debtorDetailModal');
        const addEditDebtorModal = document.getElementById('addEditDebtorModal');
        const closeButtons = document.querySelectorAll('.modal .close-button');
        const telegramLinkModal = document.getElementById('telegramLinkModal'); 
        
        // Elementos do Modal de Detalhes do Devedor
        const detailDebtorName = document.getElementById('detailDebtorName');
        const detailDebtorDescription = document.getElementById('detailDebtorDescription');
        const detailLoanedAmount = document.getElementById('detailLoanedAmount');
        const detailTotalToReceive = document.getElementById('detailTotalToReceive');
        const detailInterestPercentage = document.getElementById('detailInterestPercentage');
        const toggleTotalToReceive = document.getElementById('toggleTotalToReceive');
        const detailInstallments = document.getElementById('detailInstallments');
        const detailAmountPerInstallment = document.getElementById('detailAmountPerInstallment');
        const detailStartDate = document.getElementById('detailStartDate');
        const detailFrequency = document.getElementById('detailFrequency'); 
        const paymentsGrid = document.getElementById('paymentsGrid');
        const paymentAmountInput = document.getElementById('paymentAmount');
        const paymentDateInput = document.getElementById('paymentDate');
        const addPaymentButton = document.getElementById('addPaymentButton');
        const fillAmountButton = document.getElementById('fillAmountButton');
        const showAllInstallmentsButton = document.getElementById('showAllInstallmentsButton'); 

        // Elementos do Modal de Adicionar/Editar Devedor
        const addEditModalTitle = document.getElementById('addEditModalTitle');
        const addEditDebtorForm = document.getElementById('addEditDebtorForm');
        const debtorNameInput = document.getElementById('debtorName');
        const debtorDescriptionInput = document.getElementById('debtorDescription');
        const loanedAmountInput = document.getElementById('loanedAmount');
        const frequencyInput = document.getElementById('frequency'); 
        const calculationTypeSelect = document.getElementById('calculationType');
        const perInstallmentFields = document.getElementById('perInstallmentFields');
        const percentageFields = document.getElementById('percentageFields');
        const amountPerInstallmentInput = document.getElementById('amountPerInstallmentInput');
        const installmentsInput = document.getElementById('installments');
        const interestPercentageInput = document.getElementById('interestPercentageInput');
        const startDateInput = document.getElementById('startDate');
        
        // Elementos do filtro
        const filterAllButton = document.getElementById('filterAllButton');
        const filterDailyButton = document.getElementById('filterDailyButton');
        const filterWeeklyButton = document.getElementById('filterWeeklyButton');
        const filterMonthlyButton = document.getElementById('filterMonthlyButton');

        // Variáveis de Estado
        let debtors = [];
        let currentDebtorId = null;
        let selectedPaymentIndex = null;
        let currentUserId = null; 
        let currentFilter = 'all'; 
        const linkCodeDurationMinutes = 5; 

        // --- FUNÇÕES DE GERAÇÃO E MODAL DE SUCESSO DO ACCESS CODE ---
        function generateAccessCode() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }

        const successModal = document.getElementById('successModal');

        function openSuccessModal(code) {
            if (!successModal) {
                 alert(`Sucesso! Devedor cadastrado. CÓDIGO DE ACESSO: ${code}`);
                 return; 
            }
            document.getElementById('displayedAccessCode').textContent = code;
            successModal.style.display = 'flex';
            successModal.style.zIndex = '1001'; 
        }

        function closeSuccessModal() {
            if (!successModal) return;
            successModal.style.display = 'none';
            addEditDebtorModal.style.display = 'none';
        }

        function copyAccessCode() {
            const code = document.getElementById('displayedAccessCode').textContent;
            navigator.clipboard.writeText(code).then(() => {
                alert("Código de Acesso copiado para a área de transferência!");
            }).catch(err => {
                 console.error('Erro ao copiar código:', err);
                 alert('Não foi possível copiar o código. Tente manualmente.');
            });
        }
        
        window.closeSuccessModal = closeSuccessModal;
        window.copyAccessCode = copyAccessCode;
        // --- FIM DAS FUNÇÕES DE GERAÇÃO E MODAL DE SUCESSO ---

        // --- Logout do Admin ---
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                try {
                    await auth.signOut();
                } catch (error) {
                    console.error("Erro ao fazer logout:", error);
                    alert("Erro ao fazer logout. Tente novamente.");
                }
            });
        }

        // --- Lógica de Cadastro/Edição de Devedor ---
        if (addDebtorButton) addDebtorButton.addEventListener('click', () => openAddEditDebtorModal());
        
        if (calculationTypeSelect) {
            // ... (Seu código original de toggle de cálculo)
        }

        if (addEditDebtorForm) {
            addEditDebtorForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                // ... (Seu código original de validação e cálculo)
                
                // NOVO CÓDIGO: ADICIONAR NOVO DEVEDOR (COM ACCESS CODE)
                if (!currentDebtorId) {
                    if (!currentUserId) {
                        showError("Erro: Usuário não autenticado. Não é possível adicionar devedor.");
                        return;
                    }

                    const accessCode = generateAccessCode(); 

                    const newDebtorData = {
                        name, description, loanedAmount, amountPerInstallment, installments, startDate, totalToReceive, interestPercentage, frequency, 
                        payments: [],
                        userId: currentUserId, 
                        accessCode: accessCode 
                    };

                    await db.collection(DEBTORS_COLLECTION).add(newDebtorData);
                    
                    addEditDebtorModal.style.display = 'none';
                    openSuccessModal(accessCode);
                } else {
                    // CÓDIGO EXISTENTE: ATUALIZAR DEVEDOR
                    // ... (Seu código original de atualização)
                }

                // ... (Seu código de tratamento de erro)
            });
        }

        // ... (Todas as outras funções do Admin: renderDebtors, updateStats, openAddEditDebtorModal, deleteDebtor, openDebtorDetailModal, renderPaymentsGrid, showAllInstallments, addPaymentButton, removeLastPayment, close buttons, generateLinkCode, setupFirestoreListener, updateFilterButtons, menu de 3 pontos...)
        
        // --- SETUP DO LISTENER DO FIREBASE DO ADMIN ---
        function setupFirestoreListener() {
             // ... (Seu código de setupFirestoreListener)
        }
        
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUserId = user.uid; 
                setupFirestoreListener(); 
                // Remove o clientID para garantir que é o Admin
                localStorage.removeItem('clientID');
            } else {
                currentUserId = null; 
                debtors = []; 
                // Redirecionamento de Admin deslogado
                if (window.location.pathname.endsWith('dashboard.html')) {
                    window.location.href = 'index.html';
                }
            }
        });


    } else if (clientMainContent && clientID) {
        
        // --- LÓGICA DO PORTAL DO CLIENTE (DEVEDOR) ---
        
        // Garante que o usuário Admin não está logado simultaneamente
        auth.signOut(); 
        
        const welcomeMessage = document.getElementById('welcomeMessage');
        const clientNameEl = document.getElementById('clientName');
        const clientDescriptionEl = document.getElementById('clientDescription');
        const loanAmountEl = document.getElementById('loanAmount');
        const totalToReceiveEl = document.getElementById('totalToReceive');
        const remainingAmountEl = document.getElementById('remainingAmount'); 
        const totalPaidEl = document.getElementById('totalPaid'); 
        const loanFrequencyEl = document.getElementById('loanFrequency');
        const totalInstallmentsEl = document.getElementById('totalInstallments');
        const installmentsContainer = document.getElementById('installmentsContainer');
        const clientLogoutButton = document.querySelector('header .button-secondary');
        
        // Função de Sair (Logout do Cliente)
        window.logoutClient = function() {
            localStorage.removeItem('clientID');
            window.location.href = 'index.html';
        };

        // Verifica se o ID está presente. Se não, redireciona. (Proteção de Rota)
        if (!clientID) {
            window.location.href = 'index.html';
            return;
        }

        async function loadClientData(debtorId) {
            try {
                const docRef = db.collection(DEBTORS_COLLECTION).doc(debtorId);
                const doc = await docRef.get();

                if (!doc.exists) {
                    welcomeMessage.textContent = 'Erro de Acesso';
                    clientNameEl.textContent = 'Devedor não encontrado.';
                    console.error("Devedor não encontrado para o clientID:", debtorId);
                    // Redireciona para o login se o ID não existir mais
                    logoutClient(); 
                    return;
                }

                const debtor = doc.data();
                
                // --- 1. Atualiza as Informações Principais ---
                welcomeMessage.textContent = `Olá, ${debtor.name}!`;
                clientNameEl.textContent = debtor.name;
                clientDescriptionEl.textContent = debtor.description || 'Sem descrição';
                loanAmountEl.textContent = formatCurrency(debtor.loanedAmount);
                loanFrequencyEl.textContent = debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal';
                totalInstallmentsEl.textContent = debtor.installments;

                // --- 2. Cálculos e Valores ---
                const payments = Array.isArray(debtor.payments) ? debtor.payments : [];
                const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                const remainingAmount = debtor.totalToReceive - totalPaid;

                totalToReceiveEl.textContent = formatCurrency(debtor.totalToReceive);
                totalPaidEl.textContent = formatCurrency(totalPaid);
                remainingAmountEl.textContent = formatCurrency(remainingAmount);
                remainingAmountEl.style.color = remainingAmount > 0 ? 'var(--error-color)' : 'var(--success-color)';

                // --- 3. Renderiza as Parcelas ---
                renderClientInstallments(debtor);

            } catch (error) {
                console.error("Erro ao carregar dados do cliente:", error);
                welcomeMessage.textContent = 'Erro ao carregar seus dados.';
                clientNameEl.textContent = 'Tente sair e entrar novamente.';
            }
        }

        // Função para calcular e exibir o status de cada parcela (quadradinhos)
        function renderClientInstallments(debtor) {
            installmentsContainer.innerHTML = '';
            
            const expectedAmountPerInstallment = debtor.amountPerInstallment;
            const payments = Array.isArray(debtor.payments) ? debtor.payments : [];

            // Cria uma cópia consumível dos pagamentos
            let consumablePayments = payments.map(p => ({ 
                ...p, 
                amountRemaining: p.amount 
            }));
            consumablePayments.sort((a, b) => new Date(a.date) - new Date(b.date));


            // Função auxiliar para calcular a data de vencimento
            function addDays(date, days) {
                const result = new Date(date);
                result.setDate(result.getDate() + days);
                return result;
            }

            for (let i = 0; i < debtor.installments; i++) {
                const installmentNumber = i + 1;
                let paidAmountForThisInstallment = 0;
                let paymentDateForThisInstallment = null; 
                let isPaid = false;

                // Tenta alocar os pagamentos existentes (consumablePayments) para esta parcela
                for (let j = 0; j < consumablePayments.length; j++) {
                    const payment = consumablePayments[j];
                    if (payment && payment.amountRemaining > 0) {
                        const amountNeeded = expectedAmountPerInstallment - paidAmountForThisInstallment;
                        const amountToApply = Math.min(amountNeeded, payment.amountRemaining);

                        paidAmountForThisInstallment += amountToApply;
                        payment.amountRemaining -= amountToApply;
                        
                        if (amountToApply > 0 && !paymentDateForThisInstallment) {
                             paymentDateForThisInstallment = payment.date;
                        }

                        if (paidAmountForThisInstallment >= expectedAmountPerInstallment - 0.005) {
                            isPaid = true;
                            break;
                        }
                    }
                }
                
                // Determina a data de vencimento da parcela
                let daysToAdd = 0;
                if (debtor.frequency === 'weekly') {
                    daysToAdd = 7;
                } else if (debtor.frequency === 'monthly') {
                    daysToAdd = 30; // Simplificação, pode ser ajustado
                } else { // daily
                    daysToAdd = 1;
                }
                
                const initialStartDate = new Date(debtor.startDate.replace(/-/g, '/'));
                const dueDate = addDays(initialStartDate, (i + 1) * daysToAdd);
                const dueDateString = formatDate(dueDate);

                const installmentDiv = document.createElement('div');
                installmentDiv.classList.add('installment-square');
                installmentDiv.setAttribute('data-status', isPaid ? 'paid' : 'unpaid');
                
                // Calcula o que foi pago ou o que resta (para exibição)
                const displayAmountPaid = Math.min(paidAmountForThisInstallment, expectedAmountPerInstallment);
                const displayStatus = isPaid ? '✅ Paga' : (paidAmountForThisInstallment > 0 ? 'PAGANDO' : 'PENDENTE');
                
                installmentDiv.innerHTML = `
                    <span>Nº ${installmentNumber}</span>
                    <strong>${formatCurrency(expectedAmountPerInstallment)}</strong>
                    <span class="status-text">${displayStatus}</span>
                `;
                
                // Detalhes no clique
                installmentDiv.addEventListener('click', () => {
                    let alertMessage = `Parcela ${installmentNumber} - ${displayStatus}\n`;
                    alertMessage += `Valor Esperado: ${formatCurrency(expectedAmountPerInstallment)}\n`;
                    alertMessage += `Valor Pago (Total alocado): ${formatCurrency(displayAmountPaid)}\n`;
                    
                    if (!isPaid) {
                        alertMessage += `Faltando: ${formatCurrency(expectedAmountPerInstallment - displayAmountPaid)}\n`;
                        alertMessage += `Vencimento Estimado: ${dueDateString}\n\n`;
                        alertMessage += `*Entre em contato com o administrador para realizar o pagamento.*`;
                    } else {
                         alertMessage += `Data do Primeiro Pagamento Alocado: ${paymentDateForThisInstallment ? formatDate(paymentDateForThisInstallment) : 'N/A'}`;
                    }
                    
                    alert(alertMessage);
                });

                installmentsContainer.appendChild(installmentDiv);
            }
        }

        // Inicia o carregamento dos dados do cliente
        loadClientData(clientID);

    } else {
        // --- PROTEÇÃO DE ROTA FINAL: NINGUÉM LOGADO, REDIRECIONA PARA LOGIN GERAL ---
        if (window.location.pathname.endsWith('dashboard.html')) {
            window.location.href = 'index.html';
        }
    }

}
