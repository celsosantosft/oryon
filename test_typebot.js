const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('http://127.0.0.1:8080/typebot/find/AtosVendas', {
      headers: { 'apikey': 'AtosZap2026' }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
