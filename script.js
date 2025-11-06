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
// Altere o nome da coleção se for diferente
const DEBTORS_COLLECTION = 'debtors'; 

// --- DETECTAÇÃO DE PÁGINA E EXECUÇÃO DE LÓGICA ---

// Lógica para login (index.html)
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    
    const loginForm = document.getElementById('clientLoginForm');

    if (loginForm) {
        // --- LÓGICA DE LOGIN DO CLIENTE (CORRIGIDA) ---
        const uniqueCodeInput = document.getElementById('uniqueCode');
        const errorMessage = document.getElementById('errorMessage');
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uniqueCode = uniqueCodeInput.value.trim();
            errorMessage.style.display = 'none'; 

            if (!uniqueCode) {
                errorMessage.textContent = 'Por favor, insira o código de acesso.';
                errorMessage.style.display = 'block';
                return;
            }

            try {
                // CORREÇÃO: Busca o documento onde o CAMPO 'accessCode' corresponde ao código digitado
                const snapshot = await db.collection(DEBTORS_COLLECTION)
                                          .where('accessCode', '==', uniqueCode)
                                          .limit(1) // Otimiza a consulta
                                          .get();
                
                if (!snapshot.empty) {
                    // Código de acesso válido: Pega o ID REAL do documento (ID do Cliente)
                    const clientDoc = snapshot.docs[0];
                    const clientID = clientDoc.id; 

                    // Salva o ID real do documento para uso no dashboard
                    localStorage.setItem('clientID', clientID); 
                    
                    // Redireciona para o Painel do Cliente
                    window.location.href = 'dashboard.html'; 
                } else {
                    // Código de acesso inválido
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
        // --- LÓGICA DE LOGIN DO ADMIN (Mantenha seu código original aqui, se houver) ---
        console.log("Executando lógica de Login do Admin.");
    }
}


// Lógica para Dashboard (dashboard.html)
if (window.location.pathname.endsWith('dashboard.html')) {
    const clientMainContent = document.getElementById('clientMainContent');
    const clientID = localStorage.getItem('clientID');

    // --- VERIFICAÇÃO DE SESSÃO DO CLIENTE ---
    if (clientMainContent && !clientID) {
        // Se não houver ID, redireciona para o login
        window.location.href = 'index.html'; 
    }

    if (clientMainContent && clientID) {
        // --- LÓGICA DO DASHBOARD DO CLIENTE ---
        
        // Chamada inicial para buscar e renderizar os dados
        fetchClientData(clientID);

        // Adiciona o evento de logout ao botão, se ele existir no dashboard.html
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
             logoutButton.addEventListener('click', logoutClient);
        }
        
        // --- FUNÇÕES AUXILIARES ---

        // 1. Função para buscar os dados do cliente no Firestore
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

        // 2. Função para calcular datas futuras
        function addDays(date, days) {
            const result = new Date(date);
            result.setDate(result.getDate() + days);
            return result;
        }

        // 3. Função para renderizar o painel com os dados
        function renderClientDashboard(clientData, clientID) {
            const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            // Exibição dos dados principais
            document.getElementById('welcomeMessage').textContent = `Olá, ${clientData.name || 'Cliente'}!`;
            document.getElementById('clientName').textContent = clientData.name || 'N/A';
            document.getElementById('clientDescription').textContent = clientData.description || 'Nenhuma descrição fornecida.'; 
            // document.getElementById('clientLastName').textContent = 'N/A'; // Este campo não existe no seu objeto, mantido N/A

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

            // Lógica para gerar as parcelas
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
                
                // Verifica se o índice da parcela (i) é menor que o número de pagamentos registrados
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

        // 4. Função de Sair (Logout)
        function logoutClient() {
            localStorage.removeItem('clientID');
            window.location.href = 'index.html';
        }

    } else if (!clientMainContent) {
        // --- LÓGICA DO DASHBOARD DO ADMIN (Mantenha seu código original aqui, se houver) ---
        console.log("Executando lógica do Dashboard do Admin.");
    }

}
