const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors({
    origin: '*', // O coloca 'https://obsessiondraft.shop'
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL, PORT } = process.env;

// Función para obtener el Access Token de PayPal
async function getAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const data = await response.json();
    return data.access_token;
}

const PRODUCTS = {
    solo: { name: 'Solo Explorer - 1x Astronaut', price: '29.99' },
    couple: { name: 'Cosmic Couple - 2x Astronauts', price: '49.99' }
};

// Endpoint para crear la orden de pago
app.post('/api/create-paypal-order', async (req, res) => {
    try {
        const { planId } = req.body;

        // Validar producto
        const product = PRODUCTS[planId];
        if (!product) {
            console.error(`[ERROR] Plan ID no válido recibido: "${planId}"`);
            return res.status(400).json({ error: 'Producto no válido en el servidor' });
        }

        const accessToken = await getAccessToken();

        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        description: product.name,
                        amount: {
                            currency_code: 'USD',
                            value: product.price,
                        },
                    },
                ],
            }),
        });

        const order = await response.json();

        // Validar si PayPal realmente devolvió el ID de la orden
        if (!response.ok || !order.id) {
            console.error('[PAYPAL ERROR] Falló la creación de la orden:', order);
            return res.status(response.status).json(order);
        }

        res.json({ id: order.id });
    } catch (error) {
        console.error('[SERVER ERROR] Error en /api/create-paypal-order:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para capturar el pago
app.post('/api/capture-paypal-order', async (req, res) => {
    try {
        const { orderID } = req.body;

        if (!orderID) {
            return res.status(400).json({ error: 'orderID es requerido' });
        }

        const accessToken = await getAccessToken();

        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const captureData = await response.json();

        if (!response.ok) {
            console.error('[PAYPAL ERROR] Falló la captura del pago:', captureData);
            return res.status(response.status).json(captureData);
        }

        res.json(captureData);
    } catch (error) {
        console.error('[SERVER ERROR] Error en /api/capture-paypal-order:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT || 3000, () => {
    console.log(`Servidor corriendo en el puerto ${PORT || 3000}`);
});