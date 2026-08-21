import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Selección de Entorno (Live vs Sandbox)
const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_API = PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// Obtener Access Token de PayPal
async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Faltan las credenciales PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data.access_token;
}

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ status: 'ok', mode: PAYPAL_ENV });
});

// 1. Crear Orden
app.post('/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        const accessToken = await getAccessToken();

        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'USD',
                        value: parseFloat(amount).toFixed(2)
                    }
                }]
            })
        });

        const order = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(order));

        res.status(200).json({ id: order.id });
    } catch (error) {
        console.error('Error al crear orden:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. Capturar Orden
app.post('/capture-order', async (req, res) => {
    try {
        const { orderID } = req.body;
        const accessToken = await getAccessToken();

        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const captureData = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(captureData));

        res.status(200).json(captureData);
    } catch (error) {
        console.error('Error al capturar orden:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Escuchar en el puerto de Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en puerto ${PORT} | Modo: ${PAYPAL_ENV}`);
});