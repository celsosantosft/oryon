import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Endereço IP do seu computador na rede local (confirmado no Passo 206)
const NETWORK_HOST = 'https://atosfardamentos.com.br/api';

export default defineConfig({
  plugins: [react()],
  server: {
    // Permite que qualquer interface de rede (IP) acesse o servidor de desenvolvimento
    host: true, 
    // Porta padrão do Front-end
    port: 5173, 
    // Define a porta como estritamente 5173
    strictPort: true, 
    // Configuração para garantir que o Front-end use o IP correto na rede
    cors: {
      origin: '*', // Permite que o Front-end aceite requisições de qualquer origem (necessário para o celular)
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    // base base é útil para garantir que os caminhos sejam corretos
  },
  base: '/',
});