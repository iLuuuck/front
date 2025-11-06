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

// --- LÓGICA DE LOGIN (MANTENHA INALTERADA) ---
// ... (A lógica de login permanece a mesma) ...


// --- LÓGICA DO DASHBOARD (ATUALIZADA) ---
if (window.location.pathname.includes('portal-cliente-dashboard.html')) {
    const clientID = localStorage.getItem('clientID');

    if (!clientID) {
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

    // Função auxiliar para calcular datas de vencimento
    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    // NOVO CÓDIGO DA FUNÇÃO RENDER
    function renderClientDashboard(clientData, clientID) {
        // Formato de moeda para Real
        const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

        // 1. Painel de Informações do Cliente
        document.getElementById('welcomeMessage').textContent = `Olá, ${clientData.name || 'Cliente'}!`;
        document.getElementById('clientName').textContent = clientData.name || 'N/A';
        // Ajustado para o campo "description" do seu JSON
        document.getElementById('clientDescription').textContent = clientData.description || 'Nenhuma descrição fornecida.'; 
        // Não há "lastName" no novo JSON, pode-se usar N/A ou ignorar se não for mais necessário
        document.getElementById('clientLastName').textContent = 'N/A'; 

        // 2. Detalhes do Empréstimo
        const totalInstallmentsCount = clientData.installments || 0;
        
        document.getElementById('loanAmount').textContent = formatter.format(clientData.loanedAmount || 0);
        document.getElementById('loanFrequency').textContent = clientData.frequency || 'N/A'; 
        document.getElementById('totalInstallments').textContent = totalInstallmentsCount;

        // 3. Visualização das Parcelas (Quadradinhos)
        const container = document.getElementById('installmentsContainer');
        container.innerHTML = ''; // Limpa o "Carregando"

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
                daysToAdd = 30; // Aproximação para mensal
                break;
            default:
                daysToAdd = 0;
        }


        for (let i = 0; i < totalInstallmentsCount; i++) {
            // Calcula a data de vencimento da parcela i+1
            // Se for semanal, a 1ª parcela vence 7 dias após (ou na data de início, dependendo da sua regra. Aqui usamos a data de início como base)
            const dueDate = addDays(startDate, (i + 1) * daysToAdd);
            const dueDateString = dueDate.toLocaleDateString('pt-BR');
            
            // Verifica se esta parcela já foi paga. Assumimos que a ordem dos 'payments' corresponde à ordem das parcelas.
            // Se o array payments tiver 1 elemento, a parcela 1 está paga. Se tiver 2, a 1 e a 2 estão pagas, etc.
            const isPaid = paymentsArray.length > i; 

            const installmentDiv = document.createElement('div');
            
            installmentDiv.classList.add('installment-square');
            // Usa o atributo 'data-status' para aplicar o CSS (cores)
            installmentDiv.setAttribute('data-status', isPaid ? 'paid' : 'unpaid');

            // Conteúdo do quadradinho: Número e Status/Ação
            installmentDiv.innerHTML = `Nº ${i + 1}<br>${isPaid ? '✅ Paga' : 'PAGAR'}`;
            
            // Ação ao clicar (somente acompanhamento, como solicitado)
            installmentDiv.addEventListener('click', () => {
                const status = isPaid ? 'PAGA' : 'EM ABERTO';
                alert(`Parcela ${i + 1} (${status})\nValor: ${formatter.format(amountPerInstallment)}\nVencimento: ${dueDateString}\n\n*Funcionalidade de PIX será adicionada em breve.*`);
            });

            container.appendChild(installmentDiv);
        }
    }
}

// Função de Sair (Logout) (MANTENHA INALTERADA)
function logoutClient() {
    localStorage.removeItem('clientID');
    window.location.href = 'portal-cliente-login.html';
}
