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

// Listener para o botão de alternar tema (este é o antigo botão, que será substituído no dashboard)
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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // Referência ao serviço de autenticação

// --- Lógica de Autenticação (Login) ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError'); // Para exibir erros de login

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (loginError) loginError.textContent = ''; // Limpa a mensagem de erro anterior

            const email = loginForm.loginEmail.value;
            const password = loginForm.loginPassword.value;

            try {
                await auth.signInWithEmailAndPassword(email, password);
                // Redirecionamento será tratado pelo auth.onAuthStateChanged
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
                if (loginError) loginError.textContent = errorMessage; // Define o texto de erro
                console.error("Erro de login:", error);
            }
        });
    }

    // Listener de estado de autenticação: Redireciona quando o usuário loga/desloga
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Usuário logado
            if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
                window.location.href = 'dashboard.html';
            }
            // Se já estiver no dashboard, o script continuará
        } else {
            // Usuário deslogado
            if (window.location.pathname.endsWith('dashboard.html')) {
                window.location.href = 'index.html'; // Redireciona para login
            }
        }
    });
});


// --- Lógica do Dashboard (agora dependente da autenticação Firebase) ---
// Este código só será executado se estivermos no dashboard.html
if (window.location.pathname.endsWith('dashboard.html')) {
    // --- Variáveis e Elementos do Dashboard ---
    // O logoutButton original foi removido e substituído por logoutMenuItem
    // const logoutButton = document.getElementById('logoutButton'); 
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
    const detailFrequency = document.getElementById('detailFrequency'); // Novo elemento de frequência
    const paymentsGrid = document.getElementById('paymentsGrid');
    const paymentAmountInput = document.getElementById('paymentAmount');
    const paymentDateInput = document.getElementById('paymentDate');
    const addPaymentButton = document.getElementById('addPaymentButton');
    const fillAmountButton = document.getElementById('fillAmountButton');
    const showAllInstallmentsButton = document.getElementById('showAllInstallmentsButton'); // NOVO: Botão para exibir todas as parcelas

    // Elementos do Modal de Adicionar/Editar Devedor
    const addEditModalTitle = document.getElementById('addEditModalTitle');
    const addEditDebtorForm = document.getElementById('addEditDebtorForm');
    const debtorNameInput = document.getElementById('debtorName');
    const debtorDescriptionInput = document.getElementById('debtorDescription');
    const loanedAmountInput = document.getElementById('loanedAmount');
    const frequencyInput = document.getElementById('frequency'); // Novo campo de frequência
    const calculationTypeSelect = document.getElementById('calculationType');
    const perInstallmentFields = document.getElementById('perInstallmentFields');
    const percentageFields = document.getElementById('percentageFields');
    const amountPerInstallmentInput = document.getElementById('amountPerInstallmentInput');
    const installmentsInput = document.getElementById('installments'); // Este campo agora está sempre visível
    const interestPercentageInput = document.getElementById('interestPercentageInput');
    const startDateInput = document.getElementById('startDate');
    const saveDebtorButton = document.getElementById('saveDebtorButton');

    // Elementos do filtro
    const filterAllButton = document.getElementById('filterAllButton');
    const filterDailyButton = document.getElementById('filterDailyButton');
    const filterWeeklyButton = document.getElementById('filterWeeklyButton');
    const filterMonthlyButton = document.getElementById('filterMonthlyButton');

    // --- NOVO: Variáveis e Lógica do Menu de Configurações ---
    const settingsButton = document.getElementById('settingsButton');
    const settingsMenu = document.getElementById('settingsMenu');
    const themeToggleButtonMenu = document.getElementById('themeToggleButton'); // Botão Mudar Tema dentro do menu
    const logoutMenuItem = document.getElementById('logoutMenuItem'); // Botão Sair dentro do menu

    if (settingsButton && settingsMenu) {
        // 1. Alterna a visibilidade do menu
        settingsButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Impede o clique de fechar o menu imediatamente
            settingsMenu.classList.toggle('hidden');
        });

        // 2. Fecha o menu se o usuário clicar fora dele
        document.addEventListener('click', (event) => {
            if (!settingsMenu.contains(event.target) && !settingsButton.contains(event.target)) {
                settingsMenu.classList.add('hidden');
            }
        });

        // 3. Lógica para Mudar Tema
        if (themeToggleButtonMenu) {
            themeToggleButtonMenu.addEventListener('click', () => {
                if (body.classList.contains('light-theme')) {
                    applyTheme('dark');
                } else {
                    applyTheme('light');
                }
                settingsMenu.classList.add('hidden'); // Fecha o menu após mudar o tema
            });
        }

        // 4. Lógica para Sair (Deslogar)
        if (logoutMenuItem) {
            logoutMenuItem.addEventListener('click', () => {
                auth.signOut().then(() => {
                    window.location.href = 'index.html';
                }).catch((error) => {
                    console.error("Erro ao sair:", error);
                    alert('Erro ao sair. Tente novamente.');
                });
            });
        }
    }
    // --- FIM Lógica do Menu de Configurações ---


    let debtors = [];
    let currentDebtorId = null;
    let selectedPaymentIndex = null;
    let currentUserId = null; // Para armazenar o ID do usuário logado
    let currentFilter = 'all'; // Variável para controlar o filtro atual

    // --- Funções Auxiliares ---

    function formatCurrency(amount) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    // Calcula o total a receber e a porcentagem de juros
    function calculateLoanDetails(loanedAmount, amountPerInstallment, installments, interestPercentage, calculationType) {
        let totalToReceive;
        let calculatedAmountPerInstallment;
        let calculatedInstallments = parseInt(installments); // Sempre usa o valor do input de parcelas

        if (isNaN(calculatedInstallments) || calculatedInstallments <= 0) {
            calculatedInstallments = 1; // Garante que o número de parcelas seja pelo menos 1
        }

        if (calculationType === 'perInstallment') {
            calculatedAmountPerInstallment = parseFloat(amountPerInstallment);
            totalToReceive = calculatedAmountPerInstallment * calculatedInstallments;
            interestPercentage = ((totalToReceive - loanedAmount) / loanedAmount * 100);
            if (isNaN(interestPercentage) || !isFinite(interestPercentage)) { // Trata divisão por zero ou infinito
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
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        setTimeout(() => {
            errorMessageDiv.style.display = 'none';
        }, 5000);
    }

    // --- Renderização de Devedores na Lista Principal ---
    function renderDebtors() {
        debtorsList.innerHTML = '';
        if (debtors.length === 0) {
            debtorsList.innerHTML = '<p class="loading-message">Nenhum devedor cadastrado. Clique em "Adicionar Novo Devedor" para começar.</p>';
            return;
        }

        debtors.forEach(debtor => {
            const debtorPayments = Array.isArray(debtor.payments) ? debtor.payments : [];
            const totalPaid = debtorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const remainingAmount = debtor.totalToReceive - totalPaid;

            const debtorItem = document.createElement('div');
            debtorItem.className = 'debtor-item';
            debtorItem.setAttribute('data-id', debtor.id);

            debtorItem.innerHTML = `
                <div class="debtor-info">
                    <h2>${debtor.name}</h2>
                    <p>${debtor.description || 'Sem descrição'}</p>
                    <p>Emprestado: ${formatCurrency(debtor.loanedAmount)}</p>
                    <p>Total a Receber: ${formatCurrency(debtor.totalToReceive)}</p>
                    <p>Restante: <span style="color: ${remainingAmount > 0 ? 'var(--error-color)' : 'var(--success-color)'}">${formatCurrency(remainingAmount)}</span></p>
                </div>
                <div class="debtor-actions">
                    <button class="edit-debtor-btn small-button">Editar</button>
                    <button class="delete-debtor-btn small-button">Excluir</button>
                </div>
            `;

            debtorItem.querySelector('.debtor-info').addEventListener('click', (event) => {
                if (!event.target.closest('.debtor-actions')) {
                     openDebtorDetailModal(debtor.id);
                }
            });

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
    addDebtorButton.addEventListener('click', () => openAddEditDebtorModal());

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
            // O campo installmentsInput agora está sempre visível e required no HTML
        });
    }

    addEditDebtorForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = debtorNameInput.value;
        const description = debtorDescriptionInput.value;
        const loanedAmount = parseFloat(loanedAmountInput.value);
        const startDate = startDateInput.value;
        const inputInstallments = parseInt(installmentsInput.value); // Sempre lê o número de parcelas
        const frequency = frequencyInput.value; // Pega o novo campo de frequência

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
                    // Verifica se o devedor pertence ao usuário logado ANTES de modificar
                    if (oldDebtor.userId !== currentUserId) {
                        showError("Você não tem permissão para modificar este devedor.");
                        return;
                    }

                    let updatedPayments = Array.isArray(oldDebtor.payments) ? [...oldDebtor.payments] : [];

                    // Se o número de parcelas mudou e é menor que o anterior, truncar pagamentos
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
                        frequency, // Salva o novo campo de frequência
                        payments: updatedPayments // Mantém ou trunca os pagamentos existentes
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

                await db.collection('debtors').add({
                    userId: currentUserId,
                    name,
                    description,
                    loanedAmount,
                    amountPerInstallment,
                    installments,
                    startDate,
                    totalToReceive,
                    interestPercentage,
                    frequency, // Salva o novo campo de frequência
                    payments: [], // Começa sem pagamentos
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            closeModal(addEditDebtorModal);
            // O listener do Firestore (setupDebtorsListener) irá recarregar a lista
            currentDebtorId = null; // Limpa o ID para garantir que o próximo seja uma adição
        } catch (error) {
            console.error("Erro ao salvar devedor:", error);
            showError('Erro ao salvar devedor. Verifique o console para mais detalhes.');
        }
    });

    function openAddEditDebtorModal(id = null) {
        addEditDebtorForm.reset();
        currentDebtorId = id;

        // Resetar para o tipo de cálculo padrão ao abrir o modal
        if (calculationTypeSelect) {
            calculationTypeSelect.value = 'perInstallment';
            perInstallmentFields.style.display = 'block';
            amountPerInstallmentInput.setAttribute('required', 'required');
            percentageFields.style.display = 'none';
            interestPercentageInput.removeAttribute('required');
        }
        if(installmentsInput) installmentsInput.setAttribute('required', 'required'); // Garante que parcelas seja sempre obrigatório

        if (id) {
            addEditModalTitle.textContent = 'Editar Devedor';
            const debtor = debtors.find(d => d.id === id);
            if (debtor) {
                debtorNameInput.value = debtor.name;
                debtorDescriptionInput.value = debtor.description;
                loanedAmountInput.value = debtor.loanedAmount;
                startDateInput.value = debtor.startDate;
                installmentsInput.value = debtor.installments; // Preenche o número de parcelas
                if (frequencyInput) frequencyInput.value = debtor.frequency; // Preenche a frequência

                // Preencher campos com base nos dados existentes
                // Se o devedor já tem amountPerInstallment, presume-se que foi calculado assim
                if (debtor.amountPerInstallment && debtor.totalToReceive && debtor.loanedAmount) {
                    // Tenta inferir o tipo de cálculo original para preencher corretamente
                    const calculatedInterestFromInstallment = ((debtor.totalToReceive - debtor.loanedAmount) / debtor.loanedAmount * 100);

                    // Se a porcentagem armazenada for próxima da calculada por parcela, ou se a porcentagem for 0
                    if (Math.abs(calculatedInterestFromInstallment - debtor.interestPercentage) < 0.01 || debtor.interestPercentage === 0) {
                        if(calculationTypeSelect) calculationTypeSelect.value = 'perInstallment';
                        amountPerInstallmentInput.value = debtor.amountPerInstallment;
                        if(perInstallmentFields) perInstallmentFields.style.display = 'block';
                        if(amountPerInstallmentInput) amountPerInstallmentInput.setAttribute('required', 'required');
                        if(percentageFields) percentageFields.style.display = 'none';
                        if(interestPercentageInput) interestPercentageInput.removeAttribute('required');
                    } else {
                        // Caso contrário, assume que foi por porcentagem
                        if(calculationTypeSelect) calculationTypeSelect.value = 'percentage';
                        interestPercentageInput.value = debtor.interestPercentage;
                        if(perInstallmentFields) perInstallmentFields.style.display = 'none';
                        if(amountPerInstallmentInput) amountPerInstallmentInput.removeAttribute('required');
                        if(percentageFields) percentageFields.style.display = 'block';
                        if(interestPercentageInput) interestPercentageInput.setAttribute('required', 'required');
                    }
                }
            }
        } else {
            addEditModalTitle.textContent = 'Adicionar Novo Devedor';
            // Define a data inicial como hoje
            startDateInput.valueAsDate = new Date(); 
        }

        addEditDebtorModal.style.display = 'flex';
    }

    // --- Excluir Devedor ---
    async function deleteDebtor(id) {
        try {
            const debtorRef = db.collection('debtors').doc(id);
            const doc = await debtorRef.get();
            if (doc.exists && doc.data().userId === currentUserId) {
                await debtorRef.delete();
            } else if (doc.exists) {
                showError("Você não tem permissão para excluir este devedor.");
            } else {
                showError("Devedor não encontrado.");
            }
            // O listener do Firestore irá atualizar a lista
        } catch (error) {
            console.error("Erro ao excluir devedor:", error);
            showError('Erro ao excluir devedor. Verifique o console para mais detalhes.');
        }
    }

    // --- Modais ---
    function closeModal(modal) {
        modal.style.display = 'none';
    }

    closeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal');
            if (modal) {
                closeModal(modal);
            }
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === addEditDebtorModal) {
            closeModal(addEditDebtorModal);
        }
        if (event.target === debtorDetailModal) {
            closeModal(debtorDetailModal);
        }
    });

    // --- Detalhes do Devedor e Pagamentos ---
    function openDebtorDetailModal(id) {
        currentDebtorId = id;
        const debtor = debtors.find(d => d.id === id);
        if (debtor) {
            detailDebtorName.textContent = debtor.name;
            detailDebtorDescription.textContent = debtor.description || 'Sem descrição';
            detailLoanedAmount.textContent = formatCurrency(debtor.loanedAmount);
            detailTotalToReceive.textContent = formatCurrency(debtor.totalToReceive);
            detailInterestPercentage.textContent = `${debtor.interestPercentage}%`;
            detailInstallments.textContent = debtor.installments;
            detailAmountPerInstallment.textContent = formatCurrency(debtor.amountPerInstallment);
            detailStartDate.textContent = formatDate(debtor.startDate);
            detailFrequency.textContent = debtor.frequency === 'daily' ? 'Diário' : debtor.frequency === 'weekly' ? 'Semanal' : 'Mensal';
            
            const hideTotalToReceivePref = localStorage.getItem('hideTotalToReceive');
            if (hideTotalToReceivePref === 'true') {
                toggleTotalToReceive.checked = true;
                detailTotalToReceive.classList.add('hidden-value');
            } else {
                toggleTotalToReceive.checked = false;
                detailTotalToReceive.classList.remove('hidden-value');
            }
            
            renderPaymentsGrid(debtor);
            debtorDetailModal.style.display = 'flex';
        }
    }

    if(toggleTotalToReceive) {
        toggleTotalToReceive.addEventListener('change', () => {
            if (toggleTotalToReceive.checked) {
                detailTotalToReceive.classList.add('hidden-value');
                localStorage.setItem('hideTotalToReceive', 'true');
            } else {
                detailTotalToReceive.classList.remove('hidden-value');
                localStorage.setItem('hideTotalToReceive', 'false');
            }
        });
    }

    // --- RENDERIZAÇÃO E LÓGICA DOS QUADRADINHOS DE PAGAMENTO ---
    function renderPaymentsGrid(debtor) {
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
                    
                    if (amountToApply > 0) {
                        paidAmountForThisInstallment += amountToApply;
                        payment.amountRemaining -= amountToApply;

                        if (paidAmountForThisInstallment >= expectedAmountForThisInstallment * 0.99) { // Considera pago se for muito próximo
                            isPaid = true;
                            // Se for a primeira vez que a parcela é paga, registra a data
                            if (paymentDateForThisInstallment === 'Pendente') {
                                paymentDateForThisInstallment = formatDate(payment.date);
                            }
                            break; // Vai para a próxima parcela
                        }
                    }
                }
            }

            const remainingInInstallment = expectedAmountForThisInstallment - paidAmountForThisInstallment;

            const paymentSquare = document.createElement('div');
            paymentSquare.className = `payment-square ${isPaid ? 'paid' : 'pending'}`;
            if (!isPaid) {
                 paymentSquare.setAttribute('data-index', installmentNumber);
            }
            
            paymentSquare.innerHTML = `
                <p>Parcela #${installmentNumber}</p>
                <p>Valor: ${formatCurrency(expectedAmountForThisInstallment)}</p>
                ${isPaid ? `<p class="paid-date">${paymentDateForThisInstallment}</p>` : `<p class="remaining-amount">Falta: ${formatCurrency(remainingInInstallment)}</p>`}
            `;

            // Adiciona listener para selecionar a parcela e preencher o formulário (se não estiver paga)
            if (!isPaid) {
                paymentSquare.addEventListener('click', () => {
                    const index = parseInt(paymentSquare.getAttribute('data-index'));
                    document.querySelectorAll('.payment-square').forEach(sq => sq.classList.remove('selected'));
                    paymentSquare.classList.add('selected');
                    selectedPaymentIndex = index;
                    
                    const amountToFill = remainingInInstallment;
                    paymentAmountInput.value = amountToFill.toFixed(2);
                    paymentDateInput.valueAsDate = new Date();
                });
            }

            paymentsGrid.appendChild(paymentSquare);
        }

        // Tenta pré-selecionar a próxima parcela pendente
        const nextPendingSquare = paymentsGrid.querySelector('.payment-square:not(.paid)');
        if (nextPendingSquare) {
            const amountText = nextPendingSquare.querySelector('.remaining-amount').textContent;
            const amountMatch = amountText.match(/[\d,.]+/);
            const nextExpectedAmount = amountMatch ? parseFloat(amountMatch[0].replace('.', '').replace(',', '.')) : debtor.amountPerInstallment;
            
            paymentAmountInput.value = nextExpectedAmount.toFixed(2);
            paymentDateInput.valueAsDate = new Date();
            document.querySelectorAll('.payment-square').forEach(sq => sq.classList.remove('selected'));
            nextPendingSquare.classList.add('selected');
            selectedPaymentIndex = parseInt(nextPendingSquare.getAttribute('data-index'));
        } else {
            paymentAmountInput.value = '';
            paymentDateInput.valueAsDate = null;
            selectedPaymentIndex = null;
        }
    }

    // --- Lógica para o botão "Exibir Todas as Parcelas" ---
    if(showAllInstallmentsButton) {
        showAllInstallmentsButton.addEventListener('click', showAllInstallments);
    }

    function showAllInstallments() {
        if (!currentDebtorId) return;
        const debtor = debtors.find(d => d.id === currentDebtorId);
        if (!debtor) return;

        // Cria e insere o modal
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

        // Lógica de fechar o modal
        const closeButton = modal.querySelector('.close-button');
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        const installmentsGrid = modal.querySelector('.all-installments-grid');
        const debtorPayments = Array.isArray(debtor.payments) ? debtor.payments : [];
        
        const validPayments = (Array.isArray(debtor.payments) ? debtor.payments : []).filter(p => p && typeof p.amount === 'number' && p.amount > 0);
        let consumablePayments = validPayments.map(p => ({ ...p, amountRemaining: p.amount }));
        consumablePayments.sort((a, b) => new Date(a.date) - new Date(b.date));


        for (let i = 0; i < debtor.installments; i++) {
            const installmentNumber = i + 1;
            const expectedAmountForThisInstallment = debtor.amountPerInstallment;
            let paidAmountForThisInstallment = 0;
            let paymentsDetails = [];
            let isPaid = false;

            // Recalcula o status da parcela com base nos pagamentos consumíveis
            for (let j = 0; j < consumablePayments.length; j++) {
                const payment = consumablePayments[j];
                if (payment && payment.amountRemaining > 0) {
                    const amountNeededForThisInstallment = expectedAmountForThisInstallment - paidAmountForThisInstallment;
                    const amountToApply = Math.min(amountNeededForThisInstallment, payment.amountRemaining);
                    
                    if (amountToApply > 0) {
                        paidAmountForThisInstallment += amountToApply;
                        payment.amountRemaining -= amountToApply;
                        paymentsDetails.push({ amount: amountToApply, date: formatDate(payment.date) });

                        if (paidAmountForThisInstallment >= expectedAmountForThisInstallment * 0.99) {
                            isPaid = true;
                            break;
                        }
                    }
                }
            }

            const remainingInInstallment = expectedAmountForThisInstallment - paidAmountForThisInstallment;

            const installmentSquare = document.createElement('div');
            installmentSquare.className = `installment-square ${isPaid ? 'paid' : 'pending'}`;
            installmentSquare.style.borderLeftColor = isPaid ? 'var(--success-color)' : 'var(--error-color)';
            
            let paymentsHtml = paymentsDetails.map(p => `
                <p class="payment-detail">
                    ${formatCurrency(p.amount)} em ${p.date}
                </p>
            `).join('');

            installmentSquare.innerHTML = `
                <h4>Parcela #${installmentNumber}</h4>
                <p><strong>Valor:</strong> ${formatCurrency(expectedAmountForThisInstallment)}</p>
                <div class="payments-details-container">
                    ${paymentsDetails.length > 0 ? `<h5>Pagamentos Aplicados:</h5>${paymentsHtml}` : '<h5>Sem pagamentos</h5>'}
                </div>
                ${!isPaid ? `<p class="remaining-amount"><strong>Falta:</strong> ${formatCurrency(remainingInInstallment)}</p>` : '<p class="status-paid">PAGA</p>'}
            `;

            installmentsGrid.appendChild(installmentSquare);
        }
    }


    // --- Lógica de Adicionar Pagamento ---
    if (addPaymentButton) {
        addPaymentButton.addEventListener('click', async () => {
            if (currentDebtorId === null) {
                showError("Selecione um devedor para adicionar o pagamento.");
                return;
            }

            const paymentAmount = parseFloat(paymentAmountInput.value);
            const paymentDate = paymentDateInput.value;

            if (isNaN(paymentAmount) || paymentAmount <= 0) {
                showError("Insira um valor de pagamento válido.");
                return;
            }
            if (!paymentDate) {
                showError("Selecione a data do pagamento.");
                return;
            }

            try {
                const debtorRef = db.collection('debtors').doc(currentDebtorId);
                const doc = await debtorRef.get();
                if (doc.exists) {
                    const debtorData = doc.data();

                    // Verifica se o devedor pertence ao usuário logado ANTES de modificar
                    if (debtorData.userId !== currentUserId) {
                        showError("Você não tem permissão para modificar este devedor.");
                        return;
                    }

                    let updatedPayments = Array.isArray(debtorData.payments) ? [...debtorData.payments] : [];
                    
                    // Adiciona o novo pagamento
                    updatedPayments.push({ amount: paymentAmount, date: paymentDate });
                    updatedPayments.sort((a, b) => new Date(a.date) - new Date(b.date)); // Garante que a ordem seja cronológica

                    await debtorRef.update({ payments: updatedPayments });

                    paymentAmountInput.value = '';
                    paymentDateInput.valueAsDate = new Date();
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
                const nextPendingSquare = paymentsGrid.querySelector('.payment-square.selected');
                if (nextPendingSquare) {
                    // O valor já é preenchido automaticamente ao selecionar, mas garante que a data seja hoje
                    paymentDateInput.valueAsDate = new Date();
                } else {
                    // Se não houver parcela selecionada/pendente, preenche com o valor da parcela padrão
                    paymentAmountInput.value = debtor.amountPerInstallment.toFixed(2);
                    paymentDateInput.valueAsDate = new Date();
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

                // Verifica se o devedor pertence ao usuário logado ANTES de modificar
                if (debtorData.userId !== currentUserId) {
                    showError("Você não tem permissão para modificar este devedor.");
                    return;
                }

                let updatedPayments = Array.isArray(debtorData.payments) ? [...debtorData.payments] : [];
                if (updatedPayments.length > 0) {
                    // Remove o último pagamento, que é o último item na ordem cronológica (assumindo que já está ordenado)
                    updatedPayments.pop(); 
                    await debtorRef.update({ payments: updatedPayments });
                } else {
                    showError("Não há pagamentos para remover.");
                }
            } else {
                showError("Devedor não encontrado.");
            }
        } catch (error) {
            console.error("Erro ao remover último pagamento:", error);
            showError('Erro ao remover último pagamento. Verifique o console para mais detalhes.');
        }
    }


    // --- Lógica de Filtro ---
    function filterDebtorsByFrequency(frequency) {
        return debtors.filter(debtor => frequency === 'all' || debtor.frequency === frequency);
    }

    function setActiveFilter(filter) {
        currentFilter = filter;
        let filteredList;
        if (filter === 'all') {
            filteredList = debtors;
        } else {
            filteredList = filterDebtorsByFrequency(filter);
        }
        
        renderFilteredDebtors(filteredList);
        // Atualiza a visualização dos botões (função implementada mais abaixo)
        updateFilterButtons(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}Button`);
    }

    function renderFilteredDebtors(filteredList) {
        debtorsList.innerHTML = '';
        if (filteredList.length === 0) {
            debtorsList.innerHTML = '<p class="loading-message">Nenhum devedor encontrado com este filtro.</p>';
            return;
        }

        filteredList.forEach(debtor => {
            const debtorPayments = Array.isArray(debtor.payments) ? debtor.payments : [];
            const totalPaid = debtorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const remainingAmount = debtor.totalToReceive - totalPaid;

            const debtorItem = document.createElement('div');
            debtorItem.className = 'debtor-item';
            debtorItem.setAttribute('data-id', debtor.id);

            debtorItem.innerHTML = `
                <div class="debtor-info">
                    <h2>${debtor.name}</h2>
                    <p>${debtor.description || 'Sem descrição'}</p>
                    <p>Emprestado: ${formatCurrency(debtor.loanedAmount)}</p>
                    <p>Total a Receber: ${formatCurrency(debtor.totalToReceive)}</p>
                    <p>Restante: <span style="color: ${remainingAmount > 0 ? 'var(--error-color)' : 'var(--success-color)'}">${formatCurrency(remainingAmount)}</span></p>
                </div>
                <div class="debtor-actions">
                    <button class="edit-debtor-btn small-button">Editar</button>
                    <button class="delete-debtor-btn small-button">Excluir</button>
                </div>
            `;

            debtorItem.querySelector('.debtor-info').addEventListener('click', (event) => {
                if (!event.target.closest('.debtor-actions')) {
                     openDebtorDetailModal(debtor.id);
                }
            });

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
    if (filterAllButton) filterAllButton.addEventListener('click', () => setActiveFilter('all'));
    if (filterDailyButton) filterDailyButton.addEventListener('click', () => setActiveFilter('daily'));
    if (filterWeeklyButton) filterWeeklyButton.addEventListener('click', () => setActiveFilter('weekly'));
    if (filterMonthlyButton) filterMonthlyButton.addEventListener('click', () => setActiveFilter('monthly'));


    // --- Inicialização do Dashboard (Após autenticação) ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserId = user.uid;
            setupDebtorsListener(); // Inicia o listener de dados
            setActiveFilter(currentFilter); // Aplica o filtro inicial

            // Tenta obter o nome do usuário do Firestore para mensagem de boas-vindas
            db.collection('users').doc(currentUserId).get().then(doc => {
                const welcomeMessage = document.getElementById('welcomeMessage');
                if (doc.exists && doc.data().name) {
                    if (welcomeMessage) welcomeMessage.textContent = `Bem-vindo(a), ${doc.data().name}!`;
                } else {
                    if (welcomeMessage) welcomeMessage.textContent = 'Bem-vindo(a)!';
                }
            }).catch(console.error);

        } else {
            // Se o usuário deslogar nesta página, ele será redirecionado pelo listener no DOMContentLoaded
        }
    });

    // --- Configuração do Listener do Firestore ---
    function setupDebtorsListener() {
        if (!currentUserId) return;

        db.collection('debtors')
        .where('userId', '==', currentUserId)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            debtors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Re-renderiza a lista principal com o filtro ativo
            setActiveFilter(currentFilter); 

            // Se o modal de detalhes estiver aberto, atualiza a grade de pagamentos
            if (debtorDetailModal.style.display === 'flex' && currentDebtorId) {
                const currentDebtorInModal = debtors.find(d => d.id === currentDebtorId);
                if (currentDebtorInModal) {
                    renderPaymentsGrid(currentDebtorInModal);
                } else {
                    // Se o devedor foi excluído enquanto o modal estava aberto, feche-o
                    debtorDetailModal.style.display = 'none';
                }
            }
        }, (error) => {
            console.error("Erro ao carregar devedores do Firestore:", error);
            showError("Erro ao carregar dados. Verifique sua conexão ou as regras do Firebase.");
            debtorsList.innerHTML = '<p class="loading-message error">Erro ao carregar dados. Tente novamente mais tarde.</p>';
        });
    }


    // --- Lógica do Telegram (Se houver elementos de vínculo) ---
    const generateLinkCodeButton = document.getElementById('generateLinkCodeButton');
    const linkCodeDisplay = document.getElementById('linkCodeDisplay');

    function generateRandomCode(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    if (generateLinkCodeButton) {
        generateLinkCodeButton.addEventListener('click', async () => {
            if (!currentUserId) {
                alert("Usuário não autenticado.");
                return;
            }

            try {
                // 1. Gera um código único
                const code = generateRandomCode(6);

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
 // FIM do document.addEventListener('DOMContentLoaded', ...)
