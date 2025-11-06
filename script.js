// --- Configuração e Inicialização do Firebase ---
// ATENÇÃO: Mantenha a sua configuração COMPLETA e REAL do Firebase aqui.
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M", // <-- MANTENHA O SEU VALOR REAL
    authDomain: "russo2.firebaseapp.com", // <-- MANTENHA O SEU VALOR REAL
    projectId: "russo2", // <-- MANTENHA O SEU VALOR REAL
    storageBucket: "russo2.firebasestorage.app",
    messagingSenderId: "59081214787", // Ajustado para o ID da última configuração do usuário
    appId: "1:59081214787:web:86f68c74a081a2608447d3" // Ajustado para o ID da última configuração do usuário
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // Adiciona o Auth de volta para o Admin
const DEBTORS_COLLECTION = 'debtors';

// --- FUNÇÕES AUXILIARES GLOBAIS (essenciais para Admin e Cliente) ---

function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function formatDate(timestampOrString) {
    if (!timestampOrString) return 'N/A';
    let date;
    if (typeof timestampOrString === 'object' && typeof timestampOrString.toDate === 'function') {
        date = timestampOrString.toDate();
    } else if (typeof timestampOrString === 'string') {
        date = new Date(timestampOrString.replace(/-/g, '/'));
    } else {
        date = new Date(timestampOrString);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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

if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    
    // --- LÓGICA DE LOGIN DO CLIENTE (usa #clientLoginForm) ---
    const loginForm = document.getElementById('clientLoginForm');

    if (loginForm) {
        // Se este formulário existe, estamos na tela de login do CLIENTE
        const uniqueCodeInput = document.getElementById('uniqueCode');
        const errorMessageDiv = document.getElementById('errorMessage'); // Renomeado para div para consistência
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessageDiv.style.display = 'none';
            errorMessageDiv.textContent = 'Carregando...';

            const accessCode = uniqueCodeInput.value.trim().toUpperCase(); // Garante o formato correto

            if (!accessCode || accessCode.length !== 6) {
                errorMessageDiv.textContent = 'O código deve ter 6 caracteres alfanuméricos.';
                errorMessageDiv.style.display = 'block';
                return;
            }

            try {
                // CORRIGIDO: Usa a consulta .where() para buscar o DEBTOR ID correto.
                const snapshot = await db.collection(DEBTORS_COLLECTION)
                    .where('accessCode', '==', accessCode)
                    .limit(1)
                    .get();

                if (snapshot.empty) {
                    errorMessageDiv.textContent = 'Código de acesso incorreto ou devedor não encontrado.';
                    errorMessageDiv.style.display = 'block';
                    return;
                }

                const debtorDoc = snapshot.docs[0];
                const debtorId = debtorDoc.id; // Pega o ID REAL do documento (ex: sKTJOl7fV3...)
                
                localStorage.setItem('clientID', debtorId);
                
                // Redireciona para o Painel do Cliente (dashboard.html)
                window.location.href = 'dashboard.html'; 

            } catch (error) {
                console.error("Erro ao tentar fazer login:", error);
                errorMessageDiv.textContent = 'Erro de conexão. Tente novamente.';
                errorMessageDiv.style.display = 'block';
            }
        });
    } else {
        // --- LÓGICA DE LOGIN DO ADMIN (Mantida) ---
        // Se houver lógica de Login/Registro do Administrador aqui, ela deve ser mantida.
        // A lógica do Admin geralmente usa `auth.signInWithEmailAndPassword`.
        // Este bloco é um placeholder para garantir que o seu código de Admin (se estiver aqui) permaneça.
        
        // Exemplo:
        // auth.onAuthStateChanged((user) => {
        //     if (user) {
        //         window.location.href = 'dashboard.html'; // Redireciona o Admin
        //     }
        // });
        console.log("Executando lógica de Login do Admin (sem corpo definido no snippet).");
    }
}


if (window.location.pathname.endsWith('dashboard.html')) {
    const clientMainContent = document.getElementById('clientMainContent');
    const clientID = localStorage.getItem('clientID');
    const isAdminDashboard = !clientMainContent || !clientID; // Detecta se é o Dashboard do Admin

    if (isAdminDashboard) {
        
        // --- LÓGICA DO DASHBOARD DO ADMINISTRADOR (INÍCIO) ---
        // *** ESTE É O SEU CÓDIGO MAIOR QUE CONTÉM TODAS AS FUNÇÕES DE CRUD DO ADMIN ***
        
        // --- VARIÁVEIS DO DOM E FUNÇÕES DO ADMIN (EXEMPLOS INICIAIS) ---
        const logoutButton = document.getElementById('logoutButton');
        const addDebtorButton = document.getElementById('addDebtorButton');
        const debtorsList = document.getElementById('debtorsList');
        const errorMessageDiv = document.getElementById('errorMessage');
        
        // ... (Todas as outras variáveis e modais do Admin) ...

        let debtors = [];
        let currentDebtorId = null;
        let selectedPaymentIndex = null;
        let currentUserId = null; 
        let currentFilter = 'all'; 

        // --- Funções de Admin (Ex: openAddEditDebtorModal, renderDebtors, etc.)
        // [Aqui estaria o corpo completo de todas as suas funções de Admin]

        // --- Lógica de Cadastro/Edição de Devedor (INSERÇÃO DO ACCESS CODE) ---
        // if (addEditDebtorForm) {
        //     addEditDebtorForm.addEventListener('submit', async (event) => {
        //         // ... (Lógica de validação e cálculo)
        //         if (!currentDebtorId) {
        //             // GERAÇÃO DO CÓDIGO DE ACESSO
        //             const accessCode = generateAccessCode(); 
        //             const newDebtorData = { /* ... campos ... */ accessCode: accessCode };
        //             await db.collection(DEBTORS_COLLECTION).add(newDebtorData);
        //             openSuccessModal(accessCode);
        //         } 
        //         // ...
        //     });
        // }
        // ... (O restante da lógica de Admin, incluindo logout, listeners, etc.) ...
        
        // --- Proteção de Rota do Admin ---
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUserId = user.uid; 
                // Exclui o ID do cliente se o Admin logar
                localStorage.removeItem('clientID');
                // setupFirestoreListener(); // Ativa o listener do Admin
            } else {
                currentUserId = null; 
                if (window.location.pathname.endsWith('dashboard.html') && !clientID) {
                     window.location.href = 'index.html'; // Redireciona o Admin deslogado
                }
            }
        });
        
        // *** FIM DA LÓGICA DO DASHBOARD DO ADMINISTRADOR ***
        
    } else {
        
        // --- LÓGICA DO PORTAL DO CLIENTE (DEVEDOR) ---
        
        // --- VARIÁVEIS DO CLIENTE ---
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
        if (clientLogoutButton) clientLogoutButton.addEventListener('click', window.logoutClient);

        // --- PROTEÇÃO DE ROTA DO CLIENTE ---
        if (!clientID) {
            window.location.href = 'index.html';
        }
        
        // --- FUNÇÃO DE BUSCA DE DADOS DO CLIENTE ---
        async function fetchClientData(debtorId) {
            try {
                const docRef = db.collection(DEBTORS_COLLECTION).doc(debtorId);
                // Usa onSnapshot para atualizações em tempo real
                docRef.onSnapshot(doc => {
                    if (!doc.exists) {
                        alert('Sessão expirada ou devedor não encontrado. Faça login novamente.');
                        logoutClient();
                        return;
                    }

                    const debtor = doc.data();
                    renderClientDashboard(debtor);
                }, error => {
                    console.error("Erro ao buscar dados do cliente:", error);
                    welcomeMessage.textContent = 'Erro ao carregar seus dados.';
                });

            } catch (error) {
                console.error("Erro ao buscar dados do cliente:", error);
                welcomeMessage.textContent = 'Erro ao carregar dados.';
            }
        }

        // --- FUNÇÃO AUXILIAR DE DATA ---
        function addDays(date, days) {
            const result = new Date(date);
            // Corrige o bug de adicionar dias
            result.setDate(result.getDate() + days); 
            return result;
        }

        // --- FUNÇÃO DE RENDERIZAÇÃO DO CLIENTE ---
        function renderClientDashboard(debtor) {
            
            // 1. Atualiza as Informações Principais
            document.getElementById('welcomeMessage').textContent = `Olá, ${debtor.name || 'Cliente'}!`;
            clientNameEl.textContent = debtor.name || 'N/A';
            clientDescriptionEl.textContent = debtor.description || 'Sem descrição';
            
            loanAmountEl.textContent = formatCurrency(debtor.loanedAmount || 0);
            loanFrequencyEl.textContent = debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal';
            totalInstallmentsEl.textContent = debtor.installments || 0;

            // 2. Cálculos e Valores
            const payments = Array.isArray(debtor.payments) ? debtor.payments : [];
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const remainingAmount = debtor.totalToReceive - totalPaid;

            totalToReceiveEl.textContent = formatCurrency(debtor.totalToReceive);
            totalPaidEl.textContent = formatCurrency(totalPaid);
            remainingAmountEl.textContent = formatCurrency(remainingAmount);
            remainingAmountEl.style.color = remainingAmount > 0 ? 'var(--error-color)' : 'var(--success-color)';

            // 3. Renderiza as Parcelas
            renderClientInstallments(debtor);
        }
        
        // Função para calcular e exibir o status de cada parcela (quadradinhos)
        function renderClientInstallments(debtor) {
            installmentsContainer.innerHTML = '';
            
            const expectedAmountPerInstallment = debtor.amountPerInstallment || 0;
            const payments = Array.isArray(debtor.payments) ? debtor.payments : [];

            let consumablePayments = payments.map(p => ({ 
                ...p, 
                amountRemaining: p.amount || 0 
            }));
            consumablePayments.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const initialStartDate = new Date(debtor.startDate.replace(/-/g, '/'));
            
            let daysToAdd = 0;
            if (debtor.frequency === 'weekly') {
                daysToAdd = 7;
            } else if (debtor.frequency === 'monthly') {
                daysToAdd = 30; 
            } else { // daily
                daysToAdd = 1;
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
                const dueDate = addDays(initialStartDate, (i + 1) * daysToAdd);
                const dueDateString = formatDate(dueDate);

                const installmentDiv = document.createElement('div');
                installmentDiv.classList.add('installment-square');
                installmentDiv.setAttribute('data-status', isPaid ? 'paid' : 'unpaid');
                
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
                    alertMessage += `Valor Pago (Alocado): ${formatCurrency(displayAmountPaid)}\n`;
                    
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

        // Inicia o carregamento dos dados do cliente em tempo real
        fetchClientData(clientID);

    } 
}

