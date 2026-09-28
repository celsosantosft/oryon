import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('entregas da semana oferece Google Agenda apenas ao administrador', () => {
    const source = fs.readFileSync(new URL('./WeeklyDeliveries.jsx', import.meta.url), 'utf8');
    assert.match(source, /GoogleCalendarIntegrationPanel/);
    assert.match(source, /isCalendarAdmin/);
    assert.match(source, /Google Agenda/);
});

test('painel usa a base da API sem duplicar o prefixo api', () => {
    const source = fs.readFileSync(new URL('../components/GoogleCalendarIntegrationPanel.jsx', import.meta.url), 'utf8');
    assert.match(source, /\$\{apiBaseUrl\}\/calendar\/integration/);
    assert.doesNotMatch(source, /\$\{apiBaseUrl\}\/api\/calendar/);
});

test('administrador pode usar de um a cinco lembretes', () => {
    const source = fs.readFileSync(new URL('../components/GoogleCalendarIntegrationPanel.jsx', import.meta.url), 'utf8');
    assert.match(source, /Adicionar lembrete/);
    assert.match(source, /Remover lembrete/);
});

test('administrador configura as credenciais Google dentro do painel', () => {
    const source = fs.readFileSync(new URL('../components/GoogleCalendarIntegrationPanel.jsx', import.meta.url), 'utf8');
    assert.match(source, /Client ID/);
    assert.match(source, /Client Secret/);
    assert.match(source, /Copiar URI/);
    assert.match(source, /calendar\/configuration/);
});
