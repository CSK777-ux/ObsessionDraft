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

// Permitir cualquier origen temporalmente para descartar bloqueos de CORS
app.use(cors({ origin: '*' }));

// Endpoint de prueba de vida
app.get('/', (req, res) => {
    res.send('Backend funcionando correctamente en Railway');
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
        const payload = {
            intent: 'CAPTURE',
            purchaseUnits: [
                {
                    amount: { currencyCode: 'USD', value: String(amount) },
                    description: title || 'Compra en ObsessionDraft'
                },
            ],
        };

        const { result, statusCode } = await ordersController.ordersCreate({ body: payload });
        res.status(statusCode).json({ id: result.id });
    } catch (error) {
        console.error('Error creando orden:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/capture-order', async (req, res) => {
    try {
        const { orderID } = req.body;
        const { result, statusCode } = await ordersController.ordersCapture({
            id: orderID,
            prefer: 'return=representation'
        });
        res.status(statusCode).json(result);
    } catch (error) {
        console.error('Error capturando orden:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en puerto ${PORT}`);
});