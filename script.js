// --- Configuração e Inicialização do Firebase ---
// ATENÇÃO: Mantenha a sua configuração COMPLETA e REAL do Firebase aqui.
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M", 
    authDomain: "russo2.firebaseapp.com",
    projectId: "russo2",
    storageBucket: "russo2.firebasestorage.app",
    messagingSenderId: "59081214787",
    appId: "1:59081214787:web:86f68c74a081a2608447d3"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const DEBTORS_COLLECTION = 'debtors'; 

// --- DETECTAÇÃO DE PÁGINA E EXECUÇÃO DE LÓGICA ---

// Lógica para login (index.html) e dashboard (dashboard.html)
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    // --- LÓGICA DE LOGIN DO CLIENTE (usa #clientLoginForm) ---
    const loginForm = document.getElementById('clientLoginForm');

    if (loginForm) {
        // Se este formulário existe, estamos na tela de login do CLIENTE
        const uniqueCodeInput = document.getElementById('uniqueCode');
        const errorMessage = document.getElementById('errorMessage');
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uniqueCode = uniqueCodeInput.value.trim();

            try {
                const docRef = db.collection(DEBTORS_COLLECTION).doc(uniqueCode);
                const doc = await docRef.get();

                if (doc.exists) {
                    localStorage.setItem('clientID', uniqueCode);
                    // Redireciona para o Painel do Cliente (dashboard.html)
                    window.location.href = 'dashboard.html'; 
                } else {
                    errorMessage.textContent = 'Código de acesso inválido. Tente novamente.';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                console.error("Erro ao tentar fazer login:", error);
                errorMessage.textContent = 'Erro de conexão. Tente novamente.';
                errorMessage.style.display = 'block';
            }
        });
    } else {
        // --- LÓGICA DE LOGIN DO ADMIN (usa #loginForm) ---
        // Se index.html não é o do cliente, ele deve ser o seu login original de Admin.
        // MANTENHA A LÓGICA ORIGINAL DO SEU script.js AQUI.
        // Por exemplo:
        // document.getElementById('loginForm').addEventListener('submit', (e) => { ... lógica de auth.signInWithEmailAndPassword ... });
        console.log("Executando lógica de Login do Admin.");
    }
}


if (window.location.pathname.endsWith('dashboard.html')) {
    const clientMainContent = document.getElementById('clientMainContent');

    if (clientMainContent) {
        // --- LÓGICA DO DASHBOARD DO CLIENTE (tem #clientMainContent) ---
        const clientID = localStorage.getItem('clientID');

        if (!clientID) {
            // Se não houver ID no armazenamento, redireciona para o login do cliente (index.html)
            window.location.href = 'index.html'; 
        } else {
            fetchClientData(clientID);
        }

        // Funções fetchClientData, addDays e renderClientDashboard
        // (Copie as funções atualizadas da minha resposta anterior)
        // ... (Insira as funções `fetchClientData`, `addDays` e `renderClientDashboard` aqui) ...
        
        async function fetchClientData(id) {
            try {
                const docRef = db.collection(DEBTORS_COLLECTION).doc(id);
                const doc = await docRef.get();

                if (doc.exists) {
                    const data = doc.data();
                    renderClientDashboard(data, id);
                } else {
                    alert('Sessão expirada ou cliente não encontrado.');
                    logoutClient();
                }
            } catch (error) {
                console.error("Erro ao buscar dados do cliente:", error);
                document.getElementById('welcomeMessage').textContent = 'Erro ao carregar dados.';
            }
        }

        function addDays(date, days) {
            const result = new Date(date);
            result.setDate(result.getDate() + days);
            return result;
        }

        function renderClientDashboard(clientData, clientID) {
            const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            document.getElementById('welcomeMessage').textContent = `Olá, ${clientData.name || 'Cliente'}!`;
            document.getElementById('clientName').textContent = clientData.name || 'N/A';
            document.getElementById('clientDescription').textContent = clientData.description || 'Nenhuma descrição fornecida.'; 
            document.getElementById('clientLastName').textContent = 'N/A'; 

            const totalInstallmentsCount = clientData.installments || 0;
            
            document.getElementById('loanAmount').textContent = formatter.format(clientData.loanedAmount || 0);
            document.getElementById('loanFrequency').textContent = clientData.frequency || 'N/A'; 
            document.getElementById('totalInstallments').textContent = totalInstallmentsCount;

            const container = document.getElementById('installmentsContainer');
            container.innerHTML = ''; 

            if (totalInstallmentsCount === 0) {
                container.innerHTML = '<p>Nenhuma parcela encontrada para este empréstimo.</p>';
                return;
            }

            const startDate = new Date(clientData.startDate);
            const amountPerInstallment = clientData.amountPerInstallment || 0;
            const paymentsArray = clientData.payments || [];

            let daysToAdd;
            switch (clientData.frequency.toLowerCase()) {
                case 'daily':
                    daysToAdd = 1;
                    break;
                case 'weekly':
                    daysToAdd = 7;
                    break;
                case 'monthly':
                    daysToAdd = 30; 
                    break;
                default:
                    daysToAdd = 0;
            }

            for (let i = 0; i < totalInstallmentsCount; i++) {
                const dueDate = addDays(startDate, (i + 1) * daysToAdd);
                const dueDateString = dueDate.toLocaleDateString('pt-BR');
                
                const isPaid = paymentsArray.length > i; 

                const installmentDiv = document.createElement('div');
                
                installmentDiv.classList.add('installment-square');
                installmentDiv.setAttribute('data-status', isPaid ? 'paid' : 'unpaid');

                installmentDiv.innerHTML = `Nº ${i + 1}<br>${isPaid ? '✅ Paga' : 'PAGAR'}`;
                
                installmentDiv.addEventListener('click', () => {
                    const status = isPaid ? 'PAGA' : 'EM ABERTO';
                    alert(`Parcela ${i + 1} (${status})\nValor: ${formatter.format(amountPerInstallment)}\nVencimento: ${dueDateString}\n\n*Funcionalidade de PIX será adicionada em breve.*`);
                });

                container.appendChild(installmentDiv);
            }
        }

        // Função de Sair (Logout)
        function logoutClient() {
            localStorage.removeItem('clientID');
            window.location.href = 'index.html';
        }

    } else {
        // --- LÓGICA DO DASHBOARD DO ADMIN (não tem #clientMainContent) ---
        // MANTENHA A LÓGICA ORIGINAL DO SEU script.js AQUI.
        // Por exemplo:
        // function fetchDebtors() { ... }
        console.log("Executando lógica do Dashboard do Admin.");
    }

}
