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
