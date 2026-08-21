import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    Client,
    Environment,
    OrdersController
} from '@paypal/paypal-server-sdk';

dotenv.config();

const app = express();
app.use(express.json());

// Orígenes permitidos (incluye entorno local y producción)
const allowedOrigins = [
    'https://obsessiondraft-production.up.railway.app',
    'http://obsessiondraft.shop',
    'null',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false); // Bloquea suavemente sin tumbar el servidor
        }
    },
    credentials: true
}));

// Instancia del cliente PayPal
const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID || '',
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    },
    environment: process.env.PAYPAL_ENV === 'live' ? Environment.Production : Environment.Sandbox,
});

const ordersController = new OrdersController(client);

// 1. ENDPOINT PARA CREAR LA ORDEN
app.post('/create-order', async (req, res) => {
    try {
        const { amount, title } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'El monto es requerido' });
        }

        const payload = {
            intent: 'CAPTURE',
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: 'USD',
                        value: String(amount),
                    },
                    description: title || 'Compra en ObsessionDraft'
                },
            ],
        };

        const { result, statusCode } = await ordersController.ordersCreate({ body: payload });
        res.status(statusCode).json({ id: result.id });
    } catch (error) {
        console.error('Error creando orden:', error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// 2. ENDPOINT PARA CAPTURAR EL PAGO
app.post('/capture-order', async (req, res) => {
    try {
        const { orderID } = req.body;

        if (!orderID) {
            return res.status(400).json({ error: 'El orderID es requerido' });
        }

        const { result, statusCode } = await ordersController.ordersCapture({
            id: orderID,
            prefer: 'return=representation'
        });

        res.status(statusCode).json(result);
    } catch (error) {
        console.error('Error capturando la orden:', error);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en puerto ${PORT}`);
});