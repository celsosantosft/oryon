# Infraestrutura de Produção

- O SSH de produção aceita administração por chave pública; autenticação por senha de `root` deve permanecer desativada.
- Fail2ban protege o SSH e o UFW usa bloqueio de entrada por padrão, liberando apenas SSH, HTTP, HTTPS e a porta atualmente necessária para a Evolution API.
- Os backends internos do Oryon e do PD não devem ficar acessíveis diretamente pela internet; o tráfego público passa pelo Nginx.
- O contêiner opcional `evolution_frontend` foi interrompido por reiniciar continuamente com dependência ausente. Evolution API, PostgreSQL e Redis permanecem ativos.
- Quando SSH, HTTP e HTTPS ficam simultaneamente inacessíveis sem reinício ou erro no sistema convidado, investigar primeiro a rede ou o host da provedora.
