async function run() {
    try {
        const res = await fetch('http://localhost:8080/instance/restart/AtosVendas', {
            method: 'PUT',
            headers: { apikey: 'AtosZap2026' }
        });
        console.log(await res.text());
    } catch(e) {
        console.error(e);
    }
}
run();
