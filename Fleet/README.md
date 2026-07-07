# FleetTrack Dashboard

Dashboard moderno para acompanhamento de frota utilizando a API Fulltrack.

## Como Executar

1.  **Configuração**:
    Abra o arquivo `frontend/.env` e insira suas credenciais:
    ```env
    VITE_API_KEY=SUA_API_KEY
    VITE_SECRET_KEY=SUA_SECRET_KEY
    ```

2.  **Instalação**:
    Navegue até a pasta `frontend` e instale as dependências (caso ainda não tenha feito):
    ```bash
    cd frontend
    npm install
    ```

3.  **Execução**:
    Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```

## Funcionalidades
- **Visualização em Mapa**: Veja a posição de todos os seus veículos em tempo real.
- **Lista de Status**: Acompanhe ignição, velocidade e nível de combustível.
- **Filtro Rápido**: Busque veículos por placa ou modelo.
- **Design Responsivo**: Otimizado para desktop e tablets.
