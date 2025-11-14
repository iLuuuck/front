// --- Configuração e Inicialização do Firebase ---
// ATENÇÃO: Mantenha a sua configuração COMPLETA e REAL do Firebase aqui.
const firebaseConfig = {
    apiKey: "AIzaSyAEZVCbz39BiqTj5f129PcrVHxfS6OnzLc",
    authDomain: "gerenciadoremprestimos.firebaseapp.com",
    projectId: "gerenciadoremprestimos",
    storageBucket: "gerenciadoremprestimos.firebasestorage.app",
    messagingSenderId: "365277402196",
    appId: "1:365277402196:web:65016aa2dd316e718a89c1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Nome da coleção
const DEBTORS_COLLECTION = 'debtors'; 

// ----------- Funções Auxiliares -----------

function addDays(date, days) {
    const result = new Date(date);
    const newDate = new Date(result.getFullYear(), result.getMonth(), result.getDate());
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

// =========================== LOGIN ===============================
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    
    const loginForm = document.getElementById('clientLoginForm');

    if (loginForm) {
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
                const snapshot = await db.collection(DEBTORS_COLLECTION)
                                          .where('accessCode', '==', uniqueCode)
                                          .limit(1)
                                          .get();
                
                if (!snapshot.empty) {
                    const clientDoc = snapshot.docs[0];
                    const clientID = clientDoc.id; 

                    localStorage.setItem('clientID', clientID); 
                    
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
    }
}

// =========================== DASHBOARD ===============================
if (window.location.pathname.endsWith('dashboard.html')) {
    const clientMainContent = document.getElementById('clientMainContent');
    const clientID = localStorage.getItem('clientID');

    if (clientMainContent && !clientID) {
        window.location.href = 'index.html'; 
    }

    if (clientMainContent && clientID) {
        fetchClientData(clientID);

        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
             logoutButton.addEventListener('click', logoutClient);
        }
        
        // ===== Buscar cliente =====
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

        // Frequência
        function translateFrequency(frequency) {
            switch (frequency.toLowerCase()) {
                case 'daily': return 'Diário';
                case 'weekly': return 'Semanal';
                case 'monthly': return 'Mensal';
                default: return 'N/A';
            }
        }

        // ===== Renderização do Dashboard =====
        function renderClientDashboard(clientData, clientID) {
            const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

            window.currentClientUserId = clientData.userId;

            document.getElementById('welcomeMessage').textContent = `Olá, ${clientData.name || 'Cliente'}!`;
            document.getElementById('clientName').textContent = clientData.name || 'N/A';
            document.getElementById('clientDescription').textContent = clientData.description || 'Nenhuma descrição fornecida.'; 
            
            document.getElementById('loanAmount').textContent = formatter.format(clientData.loanedAmount || 0);
            document.getElementById('loanFrequency').textContent = translateFrequency(clientData.frequency || 'N/A'); 
            
            const totalInstallmentsCount = clientData.installments || 0;
            document.getElementById('totalInstallments').textContent = totalInstallmentsCount;

            const container = document.getElementById('installmentsContainer');
            container.innerHTML = ''; 

            if (totalInstallmentsCount === 0) {
                container.innerHTML = '<p>Nenhuma parcela encontrada para este empréstimo.</p>';
                return;
            }

            const amountPerInstallment = clientData.amountPerInstallment || 0;
            const paymentsArray = clientData.payments || [];

            const totalPaidAmount = paymentsArray.reduce((sum, payment) => sum + (payment.amount || 0), 0);
            const fullyPaidInstallments = Math.floor(totalPaidAmount / amountPerInstallment);
            const remainingOnNext = totalPaidAmount % amountPerInstallment;
            
            const lastPaymentDateGlobal = paymentsArray.length > 0 
                ? new Date(paymentsArray[paymentsArray.length - 1].date || new Date()).toLocaleDateString('pt-BR') 
                : 'N/A';

            const startDate = new Date(clientData.startDate);
            let daysToAdd;
            switch (clientData.frequency.toLowerCase()) {
                case 'daily': daysToAdd = 1; break;
                case 'weekly': daysToAdd = 7; break;
                case 'monthly': daysToAdd = 30; break;
                default: daysToAdd = 0;
            }

            for (let i = 0; i < totalInstallmentsCount; i++) {
                const installmentNumber = i + 1;
                const dueDate = addDays(startDate, installmentNumber * daysToAdd);
                
                let status, paidAmount, remainingAmount, lastPaymentDate;

                if (installmentNumber <= fullyPaidInstallments) {
                    status = 'paid';
                    paidAmount = amountPerInstallment;
                    remainingAmount = 0;
                    lastPaymentDate = lastPaymentDateGlobal; 
                } else if (installmentNumber === fullyPaidInstallments + 1 && remainingOnNext > 0) {
                    status = 'partial';
                    paidAmount = remainingOnNext;
                    remainingAmount = amountPerInstallment - remainingOnNext;
                    lastPaymentDate = lastPaymentDateGlobal;
                } else {
                    status = 'unpaid';
                    paidAmount = 0;
                    remainingAmount = amountPerInstallment;
                    lastPaymentDate = 'N/A';
                }

                const installmentDiv = document.createElement('div');
                installmentDiv.classList.add('installment-square');
                installmentDiv.setAttribute('data-status', status);

                let squareText = `Nº ${installmentNumber}<br>`;
                if (status === 'paid') {
                    squareText += '✅ Paga';
                } else if (status === 'partial') {
                    squareText += `⚠️ Pg: ${formatter.format(paidAmount)}`;
                } else {
                    squareText += 'PAGAR';
                }
                installmentDiv.innerHTML = squareText;
                
                const modalData = {
                    number: installmentNumber,
                    value: amountPerInstallment,
                    status: status,
                    paid: paidAmount,
                    remaining: remainingAmount,
                    lastPayment: lastPaymentDate
                };

                installmentDiv.addEventListener('click', () => {
                    openInstallmentModal(modalData, formatter);
                });

                container.appendChild(installmentDiv);
            }

            const modal = document.getElementById('installmentModal');
            const closeButton = document.querySelector('#installmentModal .close-button');
            
            closeButton.onclick = () => { modal.style.display = 'none'; };
            window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };
        }

        // ==================== MODAL DA PARCELA ===================
        function openInstallmentModal(data, formatter) {
            const modal = document.getElementById('installmentModal');
            document.getElementById('modalInstallmentNumber').textContent = data.number;
            document.getElementById('modalInstallmentValue').textContent = formatter.format(data.value);
          
            const statusBadge = document.getElementById('modalInstallmentStatus');
            statusBadge.textContent = data.status === 'paid' ? 'PAGA' :
                                      data.status === 'partial' ? 'PARCIAL' :
                                      'EM ABERTO';
            statusBadge.className = `status-badge ${data.status}`;

            document.getElementById('modalPaidAmount').textContent = formatter.format(data.paid);
            document.getElementById('modalRemainingAmount').textContent = formatter.format(data.remaining);
            document.getElementById('modalLastPaymentDate').textContent = data.lastPayment;
            
            modal.style.display = 'flex';
            
            const payButton = document.getElementById('modalPayButton');
            const pixArea = document.getElementById('pixArea');

            payButton.disabled = false;
            payButton.textContent = 'PAGAR AGORA VIA PIX';

            payButton.onclick = () => {
                pixArea.style.display = "block";

                pixArea.innerHTML = `
                    <h3 style="margin-top:10px;">💸 Pagar Parcela #${data.number}</h3>
                    <p>Valor da parcela: <strong>${formatter.format(data.value)}</strong></p>

                    <label style="display:block;margin-top:10px;">Digite o valor desejado:</label>
                    <input id="pixValueInput" 
                        type="number"
                        min="1"
                        value="${data.remaining || data.value}"
                        style="width:100%;padding:10px;border-radius:8px;background:#2c2c2c;color:white;border:1px solid #444;">

                    <small>*Você pode pagar mais, menos ou o valor exato.</small>

                    <button id="generatePixButton" class="button" style="margin-top:15px;width:100%;">
                        GERAR PIX
                    </button>

                    <div id="pixResult" style="margin-top:20px;text-align:center;display:none;"></div>
                `;

                document.getElementById("generatePixButton").onclick = async () => {
                    const chosenValue = Number(document.getElementById("pixValueInput").value);
                    const pixResult = document.getElementById("pixResult");
                    const clientID = localStorage.getItem("clientID");

                    if (!chosenValue || chosenValue <= 0) {
                        pixResult.innerHTML = "<p>Digite um valor válido.</p>";
                        pixResult.style.display = "block";
                        return;
                    }

                    pixResult.innerHTML = "<p>Gerando QR Code...</p>";
                    pixResult.style.display = "block";

                    try {
                        const response = await fetch("https://meu-pix-backend.onrender.com/pix/generate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                loanId: clientID,
                                parcelaNumber: data.number,
                                userId: window.currentClientUserId,
                                valorEscolhido: chosenValue
                            })
                        });

                        const result = await response.json();

                        if (response.ok && result.qrBase64) {
                            pixResult.innerHTML = `
                                <img src="${result.qrBase64}" style="width:230px;height:230px;">
                                <p style="margin-top:10px;word-break:break-all;">
                                    <strong>Copia e Cola:</strong><br>${result.emv}
                                </p>
                            `;
                        } else {
                            pixResult.innerHTML = "<p>Erro ao gerar PIX.</p>";
                        }

                    } catch (err) {
                        console.error("Erro no fetch:", err);
                        pixResult.innerHTML = "<p>Erro ao gerar PIX (falha de conexão).</p>";
                    }
                };
            };
        }

        // ===== Logout =====
        function logoutClient() {
            localStorage.removeItem('clientID');
            window.location.href = 'index.html';
        }
    }
}
