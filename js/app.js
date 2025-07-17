
// Configurações da aplicação
const CONFIG = {
    META_TOTAL: 10000,
    DATA_CASAMENTO: new Date('2026-02-28'),
    JSONBIN: {
        BIN_ID: '676d2b95acd3cb34a8c50ba7',
        API_KEY: '$2a$10$VoBt43USdhGYfEGiusRTkeoegwckwoYFj77Er4MKw1yk772gXcNZq',
        BASE_URL: 'https://api.jsonbin.io/v3/b'
    }
};

// Classe para gerenciar o banco de dados
class DatabaseManager {
    constructor() {
        this.ganhos = [];
        this.ultimaAtualizacao = null;
    }

    async carregarDados() {
        try {
            // Carregar cache local primeiro
            this.carregarCache();

            // Buscar dados do servidor
            const response = await fetch(`${CONFIG.JSONBIN.BASE_URL}/${CONFIG.JSONBIN.BIN_ID}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': CONFIG.JSONBIN.API_KEY
                }
            });

            if (response.ok) {
                const data = await response.json();
                const dadosServidor = data.record;
                
                if (dadosServidor && dadosServidor.ganhos) {
                    this.ganhos = dadosServidor.ganhos;
                    this.salvarCache();
                }
            } else {
                console.warn('Resposta não OK do servidor:', response.status);
            }
        } catch (error) {
            console.warn('Erro ao carregar dados do servidor:', error);
            NotificationManager.show('Usando dados locais - sem conexão', 'info');
        }
    }

    async salvarDados() {
        try {
            const dadosParaSalvar = {
                ganhos: this.ganhos,
                ultimaAtualizacao: new Date().toISOString()
            };

            const response = await fetch(`${CONFIG.JSONBIN.BASE_URL}/${CONFIG.JSONBIN.BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.JSONBIN.API_KEY
                },
                body: JSON.stringify(dadosParaSalvar)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro na resposta:', response.status, errorText);
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }

            this.salvarCache();
            return true;
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            // Salvar localmente mesmo se o servidor falhar
            this.salvarCache();
            throw error;
        }
    }

    async adicionarGanho(ganho) {
        const novoGanho = {
            id: Date.now(),
            ...ganho
        };

        this.ganhos.push(novoGanho);
        
        try {
            await this.salvarDados();
            return novoGanho;
        } catch (error) {
            // Se falhar no servidor, manter localmente
            this.salvarCache();
            throw error;
        }
    }

    async removerGanho(id) {
        this.ganhos = this.ganhos.filter(ganho => ganho.id !== id);
        
        try {
            await this.salvarDados();
        } catch (error) {
            // Se falhar no servidor, manter localmente
            this.salvarCache();
            throw error;
        }
    }

    async zerarDados() {
        this.ganhos = [];
        
        try {
            await this.salvarDados();
        } catch (error) {
            // Se falhar no servidor, manter localmente
            this.salvarCache();
            throw error;
        }
    }

    carregarCache() {
        try {
            const cache = localStorage.getItem('casamento_ganhos');
            if (cache) {
                const dados = JSON.parse(cache);
                this.ganhos = dados.ganhos || dados || [];
            }
        } catch (error) {
            console.warn('Erro ao carregar cache:', error);
            this.ganhos = [];
        }
    }

    salvarCache() {
        try {
            const dados = {
                ganhos: this.ganhos,
                ultimaAtualizacao: new Date().toISOString()
            };
            localStorage.setItem('casamento_ganhos', JSON.stringify(dados));
        } catch (error) {
            console.warn('Erro ao salvar cache:', error);
        }
    }

    getTotalEconomizado() {
        return this.ganhos.reduce((total, ganho) => total + ganho.valor, 0);
    }

    getGanhosOrdenados() {
        return [...this.ganhos].sort((a, b) => new Date(b.data) - new Date(a.data));
    }
}

// Classe para gerenciar notificações
class NotificationManager {
    static show(mensagem, tipo = 'info') {
        const cores = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };

        const notificacao = document.createElement('div');
        notificacao.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 fade-in ${cores[tipo]}`;
        notificacao.textContent = mensagem;
        
        document.body.appendChild(notificacao);
        
        setTimeout(() => notificacao.remove(), 4000);
    }
}

// Classe para formatação
class FormatHelper {
    static moeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }

    static data(data) {
        return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}

// Classe principal da aplicação
class CasamentoApp {
    constructor() {
        this.db = new DatabaseManager();
        this.elementos = {};
        this.inicializarElementos();
        this.configurarEventListeners();
    }

    inicializarElementos() {
        this.elementos = {
            totalEconomizado: document.getElementById('total-economizado'),
            falta: document.getElementById('falta'),
            porcentagem: document.getElementById('porcentagem'),
            barraProgresso: document.getElementById('barra-progresso'),
            mensagemMotivacional: document.getElementById('mensagem-motivacional'),
            diasRestantes: document.getElementById('dias-restantes'),
            valorMensal: document.getElementById('valor-semanal'),
            listaGanhos: document.getElementById('lista-ganhos'),
            formGanho: document.getElementById('form-ganho'),
            countdown: document.getElementById('countdown'),
            modalConfirmacao: document.getElementById('modal-confirmacao')
        };
    }

    configurarEventListeners() {
        // Form de ganho
        this.elementos.formGanho.addEventListener('submit', (e) => this.handleSubmitGanho(e));
        
        // Botão zerar
        document.getElementById('btn-zerar').addEventListener('click', () => this.mostrarModalConfirmacao());
        
        // Modal de confirmação
        document.getElementById('confirmar-zerar').addEventListener('click', () => this.confirmarZerarDados());
        document.getElementById('cancelar-zerar').addEventListener('click', () => this.fecharModal());
        
        // Atualizar contador a cada minuto
        setInterval(() => this.atualizarContador(), 60000);
    }

    async inicializar() {
        // Definir data atual como padrão
        document.getElementById('data-ganho').valueAsDate = new Date();
        
        // Carregar dados
        await this.db.carregarDados();
        
        // Atualizar interface
        this.atualizarInterface();
        this.atualizarContador();
    }

    async handleSubmitGanho(e) {
        e.preventDefault();
        
        const valor = parseFloat(document.getElementById('valor-ganho').value);
        const descricao = document.getElementById('descricao-ganho').value;
        const data = document.getElementById('data-ganho').value;

        if (!valor || valor <= 0) {
            NotificationManager.show('Por favor, insira um valor válido.', 'warning');
            return;
        }

        if (!descricao.trim()) {
            NotificationManager.show('Por favor, insira uma descrição.', 'warning');
            return;
        }

        try {
            NotificationManager.show('Salvando...', 'info');
            
            await this.db.adicionarGanho({ valor, descricao, data });
            
            this.elementos.formGanho.reset();
            document.getElementById('data-ganho').valueAsDate = new Date();
            this.atualizarInterface();
            
            NotificationManager.show('Ganho salvo com sucesso!', 'success');
        } catch (error) {
            NotificationManager.show('Salvo localmente - problema na conexão', 'warning');
            this.atualizarInterface();
        }
    }

    async removerGanho(id) {
        try {
            await this.db.removerGanho(id);
            this.atualizarInterface();
            NotificationManager.show('Ganho removido!', 'info');
        } catch (error) {
            NotificationManager.show('Removido localmente - problema na conexão', 'warning');
            this.atualizarInterface();
        }
    }

    mostrarModalConfirmacao() {
        this.elementos.modalConfirmacao.classList.remove('hidden');
        this.elementos.modalConfirmacao.classList.add('flex');
    }

    fecharModal() {
        this.elementos.modalConfirmacao.classList.add('hidden');
        this.elementos.modalConfirmacao.classList.remove('flex');
    }

    async confirmarZerarDados() {
        try {
            await this.db.zerarDados();
            this.atualizarInterface();
            NotificationManager.show('Dados zerados!', 'info');
        } catch (error) {
            NotificationManager.show('Dados zerados localmente - problema na conexão', 'warning');
            this.atualizarInterface();
        }
        this.fecharModal();
    }

    atualizarInterface() {
        const totalEconomizado = this.db.getTotalEconomizado();
        const falta = CONFIG.META_TOTAL - totalEconomizado;
        const porcentagem = Math.min((totalEconomizado / CONFIG.META_TOTAL) * 100, 100);

        // Atualizar valores
        this.elementos.totalEconomizado.textContent = FormatHelper.moeda(totalEconomizado);
        this.elementos.falta.textContent = FormatHelper.moeda(Math.max(falta, 0));
        this.elementos.porcentagem.textContent = porcentagem.toFixed(1) + '%';
        this.elementos.barraProgresso.style.width = porcentagem + '%';

        // Atualizar previsão
        this.atualizarPrevisao(falta);

        // Atualizar mensagem motivacional
        this.atualizarMensagemMotivacional(porcentagem);

        // Atualizar lista de ganhos
        this.atualizarListaGanhos();
    }

    atualizarPrevisao(falta) {
        const hoje = new Date();
        const diasRestantes = Math.ceil((CONFIG.DATA_CASAMENTO - hoje) / (1000 * 60 * 60 * 24));
        const mesesRestantes = diasRestantes / 30.44;
        const valorMensal = mesesRestantes > 0 ? falta / mesesRestantes : 0;

        this.elementos.diasRestantes.textContent = diasRestantes > 0 ? diasRestantes : '0';
        this.elementos.valorMensal.textContent = FormatHelper.moeda(Math.max(valorMensal, 0));
    }

    atualizarMensagemMotivacional(porcentagem) {
        const mensagens = {
            0: 'Vamos começar essa jornada! 💪',
            25: 'Ótimo começo! Continue assim! 🌟',
            50: 'Você está no caminho certo! 🚀',
            75: 'Mais da metade! Você consegue! 💎',
            100: 'Quase lá! O casamento está chegando! 💕'
        };

        let mensagem = 'Meta alcançada! Parabéns! 🎉💒';
        
        for (const [limite, msg] of Object.entries(mensagens)) {
            if (porcentagem < limite) {
                mensagem = msg;
                break;
            }
        }

        this.elementos.mensagemMotivacional.textContent = mensagem;
    }

    atualizarListaGanhos() {
        const ganhos = this.db.getGanhosOrdenados();
        
        if (ganhos.length === 0) {
            this.elementos.listaGanhos.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="ri-inbox-line text-4xl mb-4"></i>
                    <p>Nenhum ganho registrado ainda.</p>
                    <p class="text-sm">Adicione seu primeiro ganho acima!</p>
                </div>
            `;
            return;
        }

        this.elementos.listaGanhos.innerHTML = ganhos.map(ganho => `
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors fade-in">
                <div class="flex-1">
                    <div class="flex items-center space-x-3">
                        <div class="text-lg font-semibold text-green-600">${FormatHelper.moeda(ganho.valor)}</div>
                        <div class="text-gray-900">${ganho.descricao}</div>
                    </div>
                    <div class="text-sm text-gray-500 mt-1">${FormatHelper.data(ganho.data)}</div>
                </div>
                <button onclick="app.removerGanho(${ganho.id})" 
                        class="text-red-500 hover:text-red-700 transition-colors p-2">
                        <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `).join('');
    }

    atualizarContador() {
        const hoje = new Date();
        const diferenca = CONFIG.DATA_CASAMENTO - hoje;
        
        if (diferenca > 0) {
            const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24));
            const horas = Math.floor((diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
            
            this.elementos.countdown.textContent = `⏰ Faltam ${dias} dias, ${horas}h e ${minutos}min para o grande dia!`;
        } else {
            this.elementos.countdown.textContent = '🎉 O grande dia chegou! Parabéns!';
        }
    }
}

// Inicializar aplicação quando o DOM estiver carregado
let app;
document.addEventListener('DOMContentLoaded', async () => {
    app = new CasamentoApp();
    await app.inicializar();
});
