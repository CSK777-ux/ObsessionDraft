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

// Permitir peticiones desde tu dominio de Cloudflare y pruebas
app.use(cors({
    origin: ['https://obsessiondraft.shop', 'https://www.obsessiondraft.shop', 'https://obsessiondraft-production.up.railway.app'],
    credentials: true
}));

app.get('/', (req, res) => {
    res.send('Backend ObsessionDraft activo');
});

const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID || '',
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    },
    environment: process.env.PAYPAL_ENV === 'live' ? Environment.Production : Environment.Sandbox,
});

const ordersController = new OrdersController(client);

app.post('/create-order', async (req, res) => {
    try {
        const { amount, title } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Producto no válido o no especificado.' });
        }

        const payload = {
            intent: 'CAPTURE',
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: 'USD',
                        value: String(amount)
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