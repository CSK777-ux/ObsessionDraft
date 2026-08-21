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

// Permitir peticiones desde tu web de Railway y desde tu PC local para pruebas
const allowedOrigins = [
    'https://obsessiondraft-production.up.railway.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por política CORS'));
        }
    }
}));

// Configurar el Cliente de PayPal
const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET,
    },
    environment: process.env.PAYPAL_ENV === 'live' ? Environment.Production : Environment.Sandbox,
});

const ordersController = new OrdersController(client);

// 1. ENDPOINT PARA CREAR LA ORDEN
app.post('/create-order', async (req, res) => {
    try {
        const { amount, title } = req.body;

        const collect = {
            body: {
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
            },
        };

        const { result, statusCode } = await ordersController.ordersCreate(collect);
        res.status(statusCode).json({ id: result.id });
    } catch (error) {
        console.error('Error creando orden:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. ENDPOINT QUE FALTABA: PARA CAPTURAR / COBRAR EL DINERO
app.post('/capture-order', async (req, res) => {
    try {
        const { orderID } = req.body;

        const collect = {
            id: orderID,
            prefer: 'return=representation'
        };

        const { result, statusCode } = await ordersController.ordersCapture(collect);

        // Aquí puedes verificar si result.status === 'COMPLETED'
        res.status(statusCode).json(result);
    } catch (error) {
        console.error('Error capturando la orden:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});