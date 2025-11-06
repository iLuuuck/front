// ATENÇÃO: COLOQUE SUA CONFIGURAÇÃO COMPLETA E REAL DO FIREBASE AQUI
// Esta configuração é um PLACEHOLDER copiado do seu arquivo, MANTENHA A SUA REAL.
const firebaseConfig = {
    apiKey: "AIzaSyAH0w8X7p6D6c5Ga4Ma0eIJx5J4BtdlG2M", 
    authDomain: "russo2.firebaseapp.com",
    projectId: "russo2",
    storageBucket: "russo2.firebasestorage.app",
    messagingSenderId: "59081214787",
    appId: "1:59081214787:web:86f68c74a081a2608447d3"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const DEBTORS_COLLECTION = 'debtors'; // Coleção onde os dados dos clientes estão

// --- LÓGICA DE LOGIN ---
if (window.location.pathname.includes('portal-cliente-login.html')) {
    const loginForm = document.getElementById('clientLoginForm');
    const uniqueCodeInput = document.getElementById('uniqueCode');
    const errorMessage = document.getElementById('errorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uniqueCode = uniqueCodeInput.value.trim();

            if (!uniqueCode) {
                errorMessage.textContent = 'Por favor, insira o código de acesso.';
                errorMessage.style.display = 'block';
                return;
            }

            // O código único do cliente deve ser o ID do documento no Firestore
            try {
                // Tenta buscar o documento pelo ID (que é o código único)
                const docRef = db.collection(DEBTORS_COLLECTION).doc(uniqueCode);
                const doc = await docRef.get();

                if (doc.exists) {
                    // Login bem-sucedido: Armazena o ID e redireciona
                    localStorage.setItem('clientID', uniqueCode);
                    window.location.href = 'portal-cliente-dashboard.html';
                } else {
                    // Cliente não encontrado
                    errorMessage.textContent = 'Código de acesso inválido. Tente novamente.';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                console.error("Erro ao tentar fazer login:", error);
                errorMessage.textContent = 'Erro de conexão. Tente novamente.';
                errorMessage.style.display = 'block';
            }
        });
    }
}


// --- LÓGICA DO DASHBOARD ---
if (window.location.pathname.includes('portal-cliente-dashboard.html')) {
    const clientID = localStorage.getItem('clientID');

    if (!clientID) {
        // Se não houver ID no armazenamento, redireciona para o login
        window.location.href = 'portal-cliente-login.html';
    } else {
        fetchClientData(clientID);
    }

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

    function renderClientDashboard(clientData, clientID) {
        // Formato de moeda para Real
        const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

        // 1. Painel de Informações do Cliente
        document.getElementById('welcomeMessage').textContent = `Olá, ${clientData.name || 'Cliente'}!`;
        document.getElementById('clientName').textContent = clientData.name || 'N/A';
        // Assumindo que você guarda o sobrenome separadamente
        document.getElementById('clientLastName').textContent = clientData.lastName || 'N/A'; 
        // Assumindo que a 'descrição' é um campo de 'notes' ou 'details' no Firestore
        document.getElementById('clientDescription').textContent = clientData.notes || 'Nenhuma descrição fornecida.'; 

        // 2. Detalhes do Empréstimo
        // Assumindo que os detalhes do empréstimo estão no objeto 'loan'
        const loan = clientData.loan || {}; 
        
        document.getElementById('loanAmount').textContent = formatter.format(loan.amount || 0);
        document.getElementById('loanFrequency').textContent = loan.frequency || 'N/A'; // Ex: 'diario', 'semanal', 'mensal'
        
        const installments = loan.installments || [];
        document.getElementById('totalInstallments').textContent = installments.length;

        // 3. Visualização das Parcelas (Quadradinhos)
        const container = document.getElementById('installmentsContainer');
        container.innerHTML = ''; // Limpa o "Carregando"

        if (installments.length === 0) {
            container.innerHTML = '<p>Nenhuma parcela encontrada para este empréstimo.</p>';
            return;
        }

        installments.forEach((installment, index) => {
            const isPaid = installment.paid === true;
            const installmentDiv = document.createElement('div');
            
            installmentDiv.classList.add('installment-square');
            // Usa o atributo 'data-status' para aplicar o CSS (cores)
            installmentDiv.setAttribute('data-status', isPaid ? 'paid' : 'unpaid');

            // Conteúdo do quadradinho: Número e Status/Ação
            installmentDiv.innerHTML = `Nº ${index + 1}<br>${isPaid ? '✅ Paga' : 'PAGAR'}`;
            
            // Ação ao clicar (somente acompanhamento, como solicitado)
            installmentDiv.addEventListener('click', () => {
                const status = isPaid ? 'PAGA' : 'EM ABERTO';
                alert(`Parcela ${index + 1} (${status})\nValor: ${formatter.format(installment.amount || 0)}\nVencimento: ${installment.dueDate || 'N/A'}\n\n*Funcionalidade de PIX será adicionada em breve.*`);
            });

            container.appendChild(installmentDiv);
        });
    }
}

// Função de Sair (Logout)
function logoutClient() {
    localStorage.removeItem('clientID');
    window.location.href = 'portal-cliente-login.html';
}
