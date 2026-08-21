require('dotenv').config();
const express = require('express');
const paypal = require('@paypal/checkout-server-sdk');
const cors = require('cors');

const app = express();

// 1. Configuración de CORS segura (reemplaza 'https://tu-dominio.com' por el dominio real de tu tienda)
const allowedOrigins = ['https://obsessiondraft.shop', 'https://obsessiondraft-production.up.railway.app'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por política de CORS'));
        }
    }
}));

app.use(express.json());

// 2. Selección de entorno basada en variables (Sandbox o Live)
function environment() {
    let clientId = process.env.PAYPAL_CLIENT_ID;
    let clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    // Si la variable NODE_ENV es 'production', usa Live, de lo contrario Sandbox para pruebas
    if (process.env.NODE_ENV === 'production') {
        return new paypal.core.LiveEnvironment(clientId, clientSecret);
    }
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

function client() {
    return new paypal.core.PayPalHttpClient(environment());
}

// Catálogo de productos seguro en el servidor
const PRODUCTS = {
    'single': '29.99',
    'couple': '49.99'
};

app.post('/create-order', async (req, res) => {
    try {
        const { productId } = req.body;

        // Validación estricta del producto
        if (!productId || !PRODUCTS[productId]) {
            return res.status(400).json({ error: 'Producto no válido o no especificado.' });
        }

        const itemPrice = PRODUCTS[productId];

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return-representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: itemPrice
                }
            }]
        });

        const paypalClient = client();
        const order = await paypalClient.execute(request);

        res.json({ id: order.result.id });
    } catch (err) {
        // Registro detallado del error en la consola de Railway para depuración
        console.error("Error al crear la orden de PayPal:", err);
        res.status(500).json({ error: 'Ocurrió un error al procesar el pago con PayPal.' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});