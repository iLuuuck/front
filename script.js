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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth(); 

// --- EXECUÇÃO PRINCIPAL: Espera o carregamento completo do DOM ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Lógica de Autenticação (Login) - Executada apenas em index.html ---
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        
        const loginForm = document.getElementById('loginForm');
        const loginError = document.getElementById('loginError');

        if (loginForm) {
            loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (loginError) loginError.textContent = ''; 

                const email = loginForm.loginEmail.value;
                const password = loginForm.loginPassword.value;

                try {
                    await auth.signInWithEmailAndPassword(email, password);
                } catch (error) {
                    let errorMessage = 'Ocorreu um erro ao fazer login.';
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                        errorMessage = 'E-mail ou senha inválidos.';
                    } else if (error.code === 'auth/invalid-email') {
                        errorMessage = 'Formato de e-mail inválido.';
                    } else if (error.code === 'auth/too-many-requests') {
                        errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
                    } else {
                        errorMessage = `Erro: ${error.message}`;
                    }
                    if (loginError) loginError.textContent = errorMessage; 
                    console.error("Erro de login:", error);
                }
            });
        }
    }


    // --- Lógica do Dashboard - Executada apenas em dashboard.html ---
    if (window.location.pathname.endsWith('dashboard.html')) {
        
        // --- Variáveis e Elementos do Dashboard ---
        const logoutButton = document.getElementById('logoutButton');
        const addDebtorButton = document.getElementById('addDebtorButton');
        const debtorsList = document.getElementById('debtorsList');
        const errorMessageDiv = document.getElementById('errorMessage');

        // Modals e seus elementos
        const debtorDetailModal = document.getElementById('debtorDetailModal');
        const addEditDebtorModal = document.getElementById('addEditDebtorModal');
        const closeButtons = document.querySelectorAll('.modal .close-button');

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
        const saveDebtorButton = document.getElementById('saveDebtorButton');

        // Elementos do filtro
        const filterAllButton = document.getElementById('filterAllButton');
        const filterDailyButton = document.getElementById('filterDailyButton');
        const filterWeeklyButton = document.getElementById('filterWeeklyButton');
        const filterMonthlyButton = document.getElementById('filterMonthlyButton');

        // Elementos de Toggle de Visualização
        const viewModeListButton = document.getElementById('viewModeListButton');
        const viewModeCardButton = document.getElementById('viewModeCardButton');

        let debtors = [];
        let currentDebtorId = null;
        let selectedPaymentIndex = null;
        let currentUserId = null; 
        let currentFilter = 'all'; 
        let currentViewMode = localStorage.getItem('debtorsViewMode') || 'card'; 

        // --- Funções Auxiliares (Simplificadas) ---

        function formatCurrency(amount) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
        }

        function formatDate(dateString) {
            if (!dateString) return '';
            // Assume format YYYY-MM-DD from input[type="date"]
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
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


        function showError(message) {
            if(!errorMessageDiv) return;
            errorMessageDiv.textContent = message;
            errorMessageDiv.style.display = 'block';
            setTimeout(() => {
                errorMessageDiv.style.display = 'none';
            }, 5000);
        }
        
        // --- Lógica de View Mode (Lista vs. Card) (NOVO) ---
        function applyViewMode(mode) {
            if (!debtorsList) return; 

            debtorsList.classList.remove('list-view', 'card-view');
            debtorsList.classList.add(mode + '-view');
            
            if (viewModeListButton && viewModeCardButton) {
                viewModeListButton.classList.toggle('button-secondary', mode !== 'list');
                viewModeCardButton.classList.toggle('button-secondary', mode !== 'card');
            }
            
            currentViewMode = mode;
            localStorage.setItem('debtorsViewMode', mode);
        }


        // --- Renderização de Devedores na Lista Principal ---
        function renderDebtors() {
            if (!debtorsList) return; 
            
            applyViewMode(currentViewMode);

            let filteredDebtors = debtors;
            if (currentFilter !== 'all') {
                filteredDebtors = debtors.filter(d => d.frequency === currentFilter);
            }

            debtorsList.innerHTML = '';
            
            if (filteredDebtors.length === 0) {
                debtorsList.innerHTML = '<p class="loading-message">Nenhum devedor encontrado para o filtro atual.</p>';
                return;
            }

            filteredDebtors.forEach(debtor => {
                const debtorPayments = Array.isArray(debtor.payments) ? debtor.payments : [];
                const totalPaid = debtorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                const remainingAmount = debtor.totalToReceive - totalPaid;
                const progress = Math.min(100, (totalPaid / debtor.totalToReceive) * 100); 
                const status = remainingAmount <= 0.01 ? 'Quitado' : 'Ativo';


                const debtorItem = document.createElement('div');
                debtorItem.className = 'debtor-item';
                debtorItem.setAttribute('data-id', debtor.id);
                debtorItem.setAttribute('data-frequency', debtor.frequency); 

                debtorItem.innerHTML = `
                    <div class="debtor-info">
                        <h2>${debtor.name}</h2>
                        <p>${debtor.description || 'Sem descrição'}</p>
                        <p>Total a Receber: ${formatCurrency(debtor.totalToReceive)}</p>
                        <p>Restante: <span style="color: ${remainingAmount > 0 ? 'var(--error-color)' : 'var(--success-color)'}">${formatCurrency(remainingAmount)}</span></p>
                    </div>
                    <div class="debtor-status-text">
                        ${status} (${progress.toFixed(0)}% Pago)
                    </div>
                    <div class="debtor-status-bar" style="--progress: ${progress}%;">
                    </div>
                    <div class="debtor-actions">
                        <button class="button button-small view-details-btn">Ver Detalhes</button>
                        <button class="button button-secondary button-small edit-debtor-btn">Editar</button>
                        <button class="button button-danger button-small delete-debtor-btn">Excluir</button>
                    </div>
                `;

                // CORRIGIDO: Novo Listener para o botão "Ver Detalhes"
                debtorItem.querySelector('.view-details-btn').addEventListener('click', (event) => {
                    event.stopPropagation(); // Evita que o clique do botão abra o modal duas vezes
                    openDebtorDetailModal(debtor.id);
                });
                
                // Listener para o clique na área de info (se não for nas ações)
                debtorItem.querySelector('.debtor-info').addEventListener('click', (event) => {
                    if (!event.target.closest('.debtor-actions')) {
                         openDebtorDetailModal(debtor.id);
                    }
                });

                // Listener para o botão "Editar" (MANTIDO E CONFIRMADO)
                debtorItem.querySelector('.edit-debtor-btn').addEventListener('click', (event) => {
                    event.stopPropagation();
                    openAddEditDebtorModal(debtor.id);
                });

                debtorItem.querySelector('.delete-debtor-btn').addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (confirm(`Tem certeza que deseja excluir ${debtor.name}?`)) {
                        deleteDebtor(debtor.id);
                    }
                });

                debtorsList.appendChild(debtorItem);
            });
        }

        // --- Adicionar/Editar Devedor ---
        if(addDebtorButton) {
             addDebtorButton.addEventListener('click', () => openAddEditDebtorModal());
        }

        // Lógica para alternar campos de cálculo
        if (calculationTypeSelect) {
            calculationTypeSelect.addEventListener('change', () => {
                if (calculationTypeSelect.value === 'perInstallment') {
                    perInstallmentFields.style.display = 'block';
                    amountPerInstallmentInput.setAttribute('required', 'required');
                    percentageFields.style.display = 'none';
                    interestPercentageInput.removeAttribute('required');
                } else { // percentage
                    perInstallmentFields.style.display = 'none';
                    amountPerInstallmentInput.removeAttribute('required');
                    percentageFields.style.display = 'block';
                    interestPercentageInput.setAttribute('required', 'required');
                }
            });
        }

        if(addEditDebtorForm) {
            addEditDebtorForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                const name = debtorNameInput.value;
                const description = debtorDescriptionInput.value;
                const loanedAmount = parseFloat(loanedAmountInput.value);
                const startDate = startDateInput.value;
                const inputInstallments = parseInt(installmentsInput.value); 
                const frequency = frequencyInput.value; 

                if (isNaN(loanedAmount) || loanedAmount <= 0) {
                    showError('Por favor, insira um valor emprestado válido e maior que zero.');
                    return;
                }
                if (isNaN(inputInstallments) || inputInstallments <= 0) {
                    showError('Por favor, insira um número de parcelas válido e maior que zero.');
                    return;
                }

                let totalToReceive, amountPerInstallment, installments, interestPercentage;

                if (calculationTypeSelect.value === 'perInstallment') {
                    const inputAmountPerInstallment = parseFloat(amountPerInstallmentInput.value);
                    if (isNaN(inputAmountPerInstallment) || inputAmountPerInstallment <= 0) {
                        showError('Por favor, insira um valor válido e maior que zero para "Valor por Parcela".');
                        return;
                    }
                    ({ totalToReceive, amountPerInstallment, installments, interestPercentage } =
                        calculateLoanDetails(loanedAmount, inputAmountPerInstallment, inputInstallments, 0, 'perInstallment'));
                } else { // percentage
                    const inputInterestPercentage = parseFloat(interestPercentageInput.value);
                    if (isNaN(inputInterestPercentage) || inputInterestPercentage < 0) {
                        showError('Por favor, insira uma porcentagem de juros válida e não negativa.');
                        return;
                    }
                    ({ totalToReceive, amountPerInstallment, installments, interestPercentage } =
                        calculateLoanDetails(loanedAmount, 0, inputInstallments, inputInterestPercentage, 'percentage'));
                }


                try {
                    if (currentDebtorId) {
                        // Atualizar devedor existente no Firestore
                        const debtorRef = db.collection('debtors').doc(currentDebtorId);
                        const doc = await debtorRef.get();
                        if (doc.exists) {
                            const oldDebtor = doc.data();
                            if (oldDebtor.userId !== currentUserId) {
                                showError("Você não tem permissão para modificar este devedor.");
                                return;
                            }

                            let updatedPayments = Array.isArray(oldDebtor.payments) ? [...oldDebtor.payments] : [];

                            if (installments < updatedPayments.length) {
                                updatedPayments = updatedPayments.slice(0, installments);
                            }

                            await debtorRef.update({
                                name,
                                description,
                                loanedAmount,
                                amountPerInstallment,
                                installments,
                                startDate,
                                totalToReceive,
                                interestPercentage,
                                frequency, 
                                payments: updatedPayments 
                            });
                        } else {
                            showError("Devedor não encontrado para atualização.");
                        }
                    } else {
                        // Adicionar novo devedor ao Firestore
                        if (!currentUserId) {
                            showError("Erro: Usuário não autenticado. Não é possível adicionar devedor.");
                            return;
                        }

                        const newDebtorData = {
                            name,
                            description,
                            loanedAmount,
                            amountPerInstallment,
                            installments,
                            startDate,
                            totalToReceive,
                            interestPercentage,
                            frequency, 
                            payments: [],
                            userId: currentUserId 
                        };

                        await db.collection('debtors').add(newDebtorData);
                    }
                    if(addEditDebtorModal) addEditDebtorModal.style.display = 'none';
                } catch (error) {
                    console.error("Erro ao salvar devedor:", error);
                    showError('Erro ao salvar devedor. Verifique o console para mais detalhes.');
                }
            });
        }


        function openAddEditDebtorModal(id = null) {
            if (addEditDebtorForm) {
                 addEditDebtorForm.reset(); 
            } else {
                console.error("Formulário de Devedor não encontrado.");
                return;
            }
            
            currentDebtorId = id;

            if (calculationTypeSelect) {
                calculationTypeSelect.value = 'perInstallment';
                if(perInstallmentFields) perInstallmentFields.style.display = 'block';
                if(amountPerInstallmentInput) amountPerInstallmentInput.setAttribute('required', 'required');
                if(percentageFields) percentageFields.style.display = 'none';
                if(interestPercentageInput) interestPercentageInput.removeAttribute('required');
            }
            if(installmentsInput) installmentsInput.setAttribute('required', 'required'); 

            if (id) {
                addEditModalTitle.textContent = 'Editar Devedor';
                const debtor = debtors.find(d => d.id === id);
                if (debtor) {
                    debtorNameInput.value = debtor.name;
                    debtorDescriptionInput.value = debtor.description;
                    loanedAmountInput.value = debtor.loanedAmount;
                    startDateInput.value = debtor.startDate;
                    installmentsInput.value = debtor.installments; 
                    if (frequencyInput) frequencyInput.value = debtor.frequency; 

                    // Lógica para preencher o tipo de cálculo
                    if (debtor.amountPerInstallment && debtor.totalToReceive && debtor.loanedAmount) {
                        const calculatedInterestFromInstallment = ((debtor.totalToReceive - debtor.loanedAmount) / debtor.loanedAmount * 100);
                        if (Math.abs(calculatedInterestFromInstallment - debtor.interestPercentage) < 0.01 || debtor.interestPercentage === 0) {
                            if(calculationTypeSelect) calculationTypeSelect.value = 'perInstallment';
                            if(amountPerInstallmentInput) amountPerInstallmentInput.value = debtor.amountPerInstallment;
                            if(perInstallmentFields) perInstallmentFields.style.display = 'block';
                            if(percentageFields) percentageFields.style.display = 'none';
                        } else {
                            if(calculationTypeSelect) calculationTypeSelect.value = 'percentage';
                            if(interestPercentageInput) interestPercentageInput.value = debtor.interestPercentage;
                            if(perInstallmentFields) perInstallmentFields.style.display = 'none';
                            if(percentageFields) percentageFields.style.display = 'block';
                        }
                    } else if (debtor.interestPercentage) {
                        if(calculationTypeSelect) calculationTypeSelect.value = 'percentage';
                        if(interestPercentageInput) interestPercentageInput.value = debtor.interestPercentage;
                        if(perInstallmentFields) perInstallmentFields.style.display = 'none';
                        if(percentageFields) percentageFields.style.display = 'block';
                    }
                    
                    if (calculationTypeSelect) {
                        if (calculationTypeSelect.value === 'perInstallment') {
                             if(amountPerInstallmentInput) amountPerInstallmentInput.setAttribute('required', 'required');
                             if(interestPercentageInput) interestPercentageInput.removeAttribute('required');
                        } else {
                             if(amountPerInstallmentInput) amountPerInstallmentInput.removeAttribute('required');
                             if(interestPercentageInput) interestPercentageInput.setAttribute('required', 'required');
                        }
                    }
                }
            } else {
                addEditModalTitle.textContent = 'Adicionar Novo Devedor';
            }
            if(addEditDebtorModal) addEditDebtorModal.style.display = 'flex';
        }

        async function deleteDebtor(id) {
            try {
                await db.collection('debtors').doc(id).delete();
            } catch (error) {
                console.error("Erro ao excluir devedor:", error);
                showError('Erro ao excluir devedor. Verifique o console para mais detalhes.');
            }
        }

        // --- Modal de Detalhes do Devedor ---
        function openDebtorDetailModal(id) {
            currentDebtorId = id;
            const debtor = debtors.find(d => d.id === id);

            if (debtor) {
                if(detailDebtorName) detailDebtorName.textContent = debtor.name;
                if(detailDebtorDescription) detailDebtorDescription.textContent = debtor.description;
                if(detailLoanedAmount) detailLoanedAmount.textContent = formatCurrency(debtor.loanedAmount);
                if(detailTotalToReceive) detailTotalToReceive.textContent = formatCurrency(debtor.totalToReceive);
                if(detailInterestPercentage) detailInterestPercentage.textContent = `${debtor.interestPercentage || 0}%`; 
                if(detailInstallments) detailInstallments.textContent = debtor.installments;
                if(detailAmountPerInstallment) detailAmountPerInstallment.textContent = formatCurrency(debtor.amountPerInstallment);
                if(detailStartDate) detailStartDate.textContent = formatDate(debtor.startDate);
                if(detailFrequency) detailFrequency.textContent = debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal';

                const hideTotalToReceivePref = localStorage.getItem('hideTotalToReceive');
                if (hideTotalToReceivePref === 'true') {
                    if(toggleTotalToReceive) toggleTotalToReceive.checked = true;
                    if(detailTotalToReceive) detailTotalToReceive.classList.add('hidden-value');
                } else {
                    if(toggleTotalToReceive) toggleTotalToReceive.checked = false;
                    if(detailTotalToReceive) detailTotalToReceive.classList.remove('hidden-value');
                }

                renderPaymentsGrid(debtor);
                if(debtorDetailModal) debtorDetailModal.style.display = 'flex';
            }
        }

        if(toggleTotalToReceive) {
            toggleTotalToReceive.addEventListener('change', () => {
                if (toggleTotalToReceive.checked) {
                    if(detailTotalToReceive) detailTotalToReceive.classList.add('hidden-value');
                    localStorage.setItem('hideTotalToReceive', 'true');
                } else {
                    if(detailTotalToReceive) detailTotalToReceive.classList.remove('hidden-value');
                    localStorage.setItem('hideTotalToReceive', 'false');
                }
            });
        }

        // --- RENDERIZAÇÃO E LÓGICA DOS QUADRADINHOS DE PAGAMENTO ---
        function renderPaymentsGrid(debtor) {
            if(!paymentsGrid) return;
            paymentsGrid.innerHTML = '';
            selectedPaymentIndex = null;

            const validPayments = (Array.isArray(debtor.payments) ? debtor.payments : []).filter(p => p && typeof p.amount === 'number' && p.amount > 0);
            let consumablePayments = validPayments.map(p => ({ ...p, amountRemaining: p.amount }));
            consumablePayments.sort((a, b) => new Date(a.date) - new Date(b.date));

            for (let i = 0; i < debtor.installments; i++) {
                const installmentNumber = i + 1;
                const expectedAmountForThisInstallment = debtor.amountPerInstallment;
                let paidAmountForThisInstallment = 0;
                let paymentDateForThisInstallment = 'Pendente';
                let isPaid = false;

                for (let j = 0; j < consumablePayments.length; j++) {
                    const payment = consumablePayments[j];
                    if (payment && payment.amountRemaining > 0) {
                        const amountNeededForThisInstallment = expectedAmountForThisInstallment - paidAmountForThisInstallment;
                        const amountToApply = Math.min(amountNeededForThisInstallment, payment.amountRemaining);

                        paidAmountForThisInstallment += amountToApply;
                        payment.amountRemaining -= amountToApply;

                        if (amountToApply > 0 && paymentDateForThisInstallment === 'Pendente') {
                             paymentDateForThisInstallment = payment.date;
                        }

                        if (paidAmountForThisInstallment >= expectedAmountForThisInstallment - 0.005) { 
                            isPaid = true;
                            break;
                        }
                    }
                }

                const displayAmount = Math.min(paidAmountForThisInstallment, expectedAmountForThisInstallment);
                const displayRemaining = expectedAmountForThisInstallment - displayAmount;

                const paymentSquare = document.createElement('div');
                paymentSquare.className = `payment-square ${isPaid ? 'paid' : ''}`;
                paymentSquare.setAttribute('data-index', i);

                let valueHtml = `<span>${formatCurrency(expectedAmountForThisInstallment)}</span>`;
                if (!isPaid) {
                    valueHtml = `<span>${formatCurrency(displayAmount)} (Faltam: ${formatCurrency(displayRemaining)})</span>`;
                }

                let dateHtml = `<span style="font-size: 0.75em; color: ${isPaid ? 'rgba(255,255,255,0.8)' : 'var(--text-color)'};">` +
                                (paymentDateForThisInstallment === 'Pendente' ? 'Pendente' : `Pago: ${formatDate(paymentDateForThisInstallment)}`) +
                                `</span>`;

                paymentSquare.innerHTML = `
                    <span>Parc. ${installmentNumber}</span>
                    ${valueHtml}
                    ${dateHtml}
                    ${isPaid ? `<button class="delete-payment-btn" data-payment-original-index="${i}">X</button>` : ''}
                `;

                paymentSquare.addEventListener('click', () => {
                    document.querySelectorAll('.payment-square').forEach(sq => sq.classList.remove('selected'));
                    if (!isPaid) {
                        paymentSquare.classList.add('selected');
                        selectedPaymentIndex = i;
                        if(paymentAmountInput) paymentAmountInput.value = (expectedAmountForThisInstallment - paidAmountForThisInstallment).toFixed(2);
                        if(paymentDateInput) paymentDateInput.valueAsDate = new Date();
                    } else {
                        selectedPaymentIndex = null;
                        if(paymentAmountInput) paymentAmountInput.value = '';
                        if(paymentDateInput) paymentDateInput.valueAsDate = null;
                    }
                });

                const deleteBtn = paymentSquare.querySelector('.delete-payment-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm('Tem certeza que deseja remover o último pagamento registrado deste devedor?')) {
                            removeLastPayment(currentDebtorId);
                        }
                    });
                }
                paymentsGrid.appendChild(paymentSquare);
            }

            const nextPendingSquare = paymentsGrid.querySelector('.payment-square:not(.paid)');
            if (nextPendingSquare) {
                const nextExpectedAmount = debtor.amountPerInstallment;
                if(paymentAmountInput) paymentAmountInput.value = nextExpectedAmount.toFixed(2);
                if(paymentDateInput) paymentDateInput.valueAsDate = new Date();
                document.querySelectorAll('.payment-square').forEach(sq => sq.classList.remove('selected'));
                nextPendingSquare.classList.add('selected');
                selectedPaymentIndex = parseInt(nextPendingSquare.getAttribute('data-index'));
            } else {
                if(paymentAmountInput) paymentAmountInput.value = '';
                if(paymentDateInput) paymentDateInput.valueAsDate = null;
                selectedPaymentIndex = null;
            }
        }


        // --- Lógica para o botão "Exibir Todas as Parcelas" ---
        function showAllInstallments() {
            if (!currentDebtorId) return;

            const debtor = debtors.find(d => d.id === currentDebtorId);
            if (!debtor) return;

            const modal = document.createElement('div');
            modal.className = 'fullscreen-modal';
            modal.innerHTML = `
                <div class="fullscreen-modal-content">
                    <div class="fullscreen-modal-header">
                        <h2>Parcelas de ${debtor.name}</h2>
                        <span class="close-button">&times;</span>
                    </div>
                    <div class="all-installments-grid"></div>
                </div>
            `;

            document.body.appendChild(modal);
            const closeButton = modal.querySelector('.close-button');
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            const installmentsGrid = modal.querySelector('.all-installments-grid');

            const debtorPayments = Array.isArray(debtor.payments) ? debtor.payments : [];
            const consumablePayments = debtorPayments.map(p => ({ ...p, amountRemaining: p.amount }));
            consumablePayments.sort((a, b) => new Date(a.date) - new Date(b.date));

            for (let i = 0; i < debtor.installments; i++) {
                const installmentNumber = i + 1;
                const expectedAmountForThisInstallment = debtor.amountPerInstallment;
                let paidAmountForThisInstallment = 0;
                let isPaid = false;

                for (let j = 0; j < consumablePayments.length; j++) {
                    const payment = consumablePayments[j];
                    if (payment && payment.amountRemaining > 0) {
                        const amountNeededForThisInstallment = expectedAmountForThisInstallment - paidAmountForThisInstallment;
                        const amountToApply = Math.min(amountNeededForThisInstallment, payment.amountRemaining);

                        paidAmountForThisInstallment += amountToApply;
                        payment.amountRemaining -= amountToApply;

                        if (paidAmountForThisInstallment >= expectedAmountForThisInstallment - 0.005) {
                            isPaid = true;
                            break;
                        }
                    }
                }

                const installmentSquare = document.createElement('div');
                installmentSquare.className = `installment-square ${isPaid ? 'paid' : 'pending'}`;
                installmentSquare.innerHTML = `
                    <h4>Parc. ${installmentNumber}</h4>
                    <p>Valor: ${formatCurrency(expectedAmountForThisInstallment)}</p>
                    <p class="status">${isPaid ? 'PAGA' : 'PENDENTE'}</p>
                `;
                installmentsGrid.appendChild(installmentSquare);
            }
        }

        if(showAllInstallmentsButton) {
            showAllInstallmentsButton.addEventListener('click', showAllInstallments);
        }

        // --- Adicionar Pagamento ---
        if(addPaymentButton) {
            addPaymentButton.addEventListener('click', async () => {
                if (currentDebtorId === null) {
                    showError('Nenhum devedor selecionado para adicionar pagamento.');
                    return;
                }
                
                const paymentAmount = parseFloat(paymentAmountInput.value);
                const paymentDate = paymentDateInput.value;

                if (isNaN(paymentAmount) || paymentAmount <= 0 || !paymentDate) {
                    showError('Por favor, insira um valor e data válidos para o pagamento.');
                    return;
                }

                try {
                    const debtorRef = db.collection('debtors').doc(currentDebtorId);
                    const doc = await debtorRef.get();
                    if (doc.exists) {
                        const debtorData = doc.data();
                        if (debtorData.userId !== currentUserId) {
                            showError("Você não tem permissão para modificar este devedor.");
                            return;
                        }

                        let updatedPayments = Array.isArray(debtorData.payments) ? [...debtorData.payments] : [];
                        updatedPayments.push({ amount: paymentAmount, date: paymentDate });
                        updatedPayments.sort((a, b) => new Date(a.date) - new Date(b.date));

                        await debtorRef.update({ payments: updatedPayments });

                        if(paymentAmountInput) paymentAmountInput.value = '';
                        if(paymentDateInput) paymentDateInput.valueAsDate = new Date();
                        selectedPaymentIndex = null;
                    } else {
                        showError("Devedor não encontrado para adicionar pagamento.");
                    }
                } catch (error) {
                    console.error("Erro ao adicionar pagamento:", error);
                    showError('Erro ao adicionar pagamento. Verifique o console para mais detalhes.');
                }
            });
        }

        if(fillAmountButton) {
            fillAmountButton.addEventListener('click', () => {
                if (currentDebtorId === null) return;
                const debtor = debtors.find(d => d.id === currentDebtorId);
                if (debtor) {
                    const nextPendingSquare = paymentsGrid.querySelector('.payment-square:not(.paid)');
                    if (nextPendingSquare) {
                        const nextExpectedAmount = debtor.amountPerInstallment;
                        if(paymentAmountInput) paymentAmountInput.value = nextExpectedAmount.toFixed(2);
                        if(paymentDateInput) paymentDateInput.valueAsDate = new Date();
                        document.querySelectorAll('.payment-square').forEach(sq => sq.classList.remove('selected'));
                        nextPendingSquare.classList.add('selected');
                        selectedPaymentIndex = parseInt(nextPendingSquare.getAttribute('data-index'));
                    } else {
                        if(paymentAmountInput) paymentAmountInput.value = debtor.amountPerInstallment.toFixed(2);
                        if(paymentDateInput) paymentDateInput.valueAsDate = new Date();
                        selectedPaymentIndex = null;
                    }
                }
            });
        }

        async function removeLastPayment(debtorId) {
            try {
                const debtorRef = db.collection('debtors').doc(debtorId);
                const doc = await debtorRef.get();
                if (doc.exists) {
                    const debtorData = doc.data();
                    if (debtorData.userId !== currentUserId) {
                        showError("Você não tem permissão para modificar este devedor.");
                        return;
                    }

                    let updatedPayments = Array.isArray(debtorData.payments) ? [...debtorData.payments] : [];

                    if (updatedPayments.length === 0) {
                        showError('Não há pagamentos para remover.');
                        return;
                    }

                    updatedPayments.pop();
                    await debtorRef.update({ payments: updatedPayments });
                } else {
                    showError("Devedor não encontrado para remover pagamento.");
                }
            } catch (error) {
                console.error("Erro ao remover pagamento:", error);
                showError('Erro ao remover pagamento. Verifique o console para mais detalhes.');
            }
        }


        // --- Fechar Modals ---
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                if(debtorDetailModal) debtorDetailModal.style.display = 'none';
                if(addEditDebtorModal) addEditDebtorModal.style.display = 'none';
                selectedPaymentIndex = null;
            });
        });

        window.addEventListener('click', (event) => {
            if (event.target === debtorDetailModal) {
                if(debtorDetailModal) debtorDetailModal.style.display = 'none';
                selectedPaymentIndex = null;
            }
            if (event.target === addEditDebtorModal) {
                if(addEditDebtorModal) addEditDebtorModal.style.display = 'none';
            }
        });

        // --- Listener em Tempo Real do Firestore ---
        function setupFirestoreListener() {
            if (!currentUserId) {
                console.log("Usuário não logado, não é possível configurar o listener.");
                return;
            }

            let query = db.collection('debtors').where('userId', '==', currentUserId);

            if (currentFilter !== 'all') {
                query = query.where('frequency', '==', currentFilter);
            }

            query.onSnapshot((snapshot) => {
                debtors = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                renderDebtors();

                if (debtorDetailModal && debtorDetailModal.style.display === 'flex' && currentDebtorId) {
                    const currentDebtorInModal = debtors.find(d => d.id === currentDebtorId);
                    if (currentDebtorInModal) {
                        // Re-renderiza a grade de pagamentos no modal se ele estiver aberto
                        renderPaymentsGrid(currentDebtorInModal);
                    } else {
                        if(debtorDetailModal) debtorDetailModal.style.display = 'none';
                    }
                }
            }, (error) => {
                console.error("Erro ao carregar devedores do Firestore:", error);
                showError("Erro ao carregar dados. Verifique sua conexão ou as regras do Firebase.");
                if(debtorsList) debtorsList.innerHTML = '<p class="loading-message error">Erro ao carregar dados. Tente novamente mais tarde.</p>';
            });
        }

        // Função para atualizar o estado visual dos botões de filtro
        function updateFilterButtons(activeButtonId) {
            document.querySelectorAll('.filter-actions .button').forEach(button => {
                if (button.id === activeButtonId) {
                    button.classList.remove('button-secondary');
                } else {
                    button.classList.add('button-secondary');
                }
            });
        }

        // Event listeners para os botões de filtro
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
                currentUserId = user.uid; 
                console.log("Usuário logado:", user.email, "UID:", user.uid);
                setupFirestoreListener(); 
                updateFilterButtons('filterAllButton'); 
                applyViewMode(currentViewMode); 
            } else {
                currentUserId = null; 
                debtors = []; 
                renderDebtors(); 
                console.log("Nenhum usuário logado.");
            }
        });

        // Toggle de Visualização 
        if (viewModeListButton) {
            viewModeListButton.addEventListener('click', () => applyViewMode('list'));
        }

        if (viewModeCardButton) {
            viewModeCardButton.addEventListener('click', () => applyViewMode('card'));
        }
        

        // --- LÓGICA DO VÍNCULO TELEGRAM ---

        function generateRandomCode(length) {
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            return result;
        }

        const generateLinkCodeButton = document.getElementById('generateLinkCodeButton');
        const linkCodeDisplay = document.getElementById('linkCodeDisplay');

        if (generateLinkCodeButton) { 
            generateLinkCodeButton.addEventListener('click', async () => {
                if (!currentUserId) {
                    alert('Você precisa estar logado para gerar o código.');
                    return;
                }

                try {
                    const code = generateRandomCode(6);
                    
                    await db.collection('link_codes').add({
                        code: code,
                        userId: currentUserId,
                        email: auth.currentUser.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 5) 
                    });

                    if(linkCodeDisplay) linkCodeDisplay.textContent = code;
                    generateLinkCodeButton.textContent = 'Gerado! (5 min)';
                    generateLinkCodeButton.disabled = true;

                    alert(`Código gerado: ${code}\nUse o comando /vincular ${code} no Telegram. Expira em 5 minutos.`);
                    
                    setTimeout(() => {
                        generateLinkCodeButton.textContent = 'Gerar Código Telegram';
                        generateLinkCodeButton.disabled = false;
                        if(linkCodeDisplay) linkCodeDisplay.textContent = '';
                    }, 1000 * 60 * 5); 

                } catch (error) {
                    console.error("Erro ao gerar código de vínculo:", error);
                    alert('Erro ao gerar código. Tente novamente.');
                }
            });
        }

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

}); // FIM do document.addEventListener('DOMContentLoaded', ...
