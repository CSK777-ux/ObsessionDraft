import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    Client,
    Environment,
    OrdersController,
    CheckoutPaymentIntent
} from '@paypal/paypal-server-sdk';

dotenv.config();

const app = express();

// Configuración de CORS permitiendo solicitudes desde tu frontend
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Verificación de variables de entorno requeridas
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    console.error('ERROR CRÍTICO: Las variables de entorno PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET no están definidas.');
}

// Configuración del entorno de PayPal
const paypalEnvironment = process.env.PAYPAL_ENV === 'live'
    ? Environment.Production
    : Environment.Sandbox;

// Configuración del cliente oficial de PayPal
const paypalClient = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID || '',
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || ''
    },
    environment: paypalEnvironment
});

const ordersController = new OrdersController(paypalClient);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor de Obsession Draft activo.' });
});

// 1. Ruta para CREAR la orden
app.post('/create-order', async (req, res) => {
    try {
        const { cart } = req.body;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: 'Producto no válido o no especificado.' });
        }

        // Calcular total
        const total = cart.reduce((sum, item) => {
            const price = parseFloat(item.price);
            const quantity = parseInt(item.quantity || 1, 10);

            if (isNaN(price) || isNaN(quantity)) {
                throw new Error(`Valores inválidos en el producto: ${item.name || 'Desconocido'}`);
            }

            return sum + (price * quantity);
        }, 0);

        if (total <= 0) {
            return res.status(400).json({ error: 'El total de la orden debe ser mayor a 0.' });
        }

        const body = {
            intent: CheckoutPaymentIntent.Capture,
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: 'USD',
                        value: total.toFixed(2)
                    },
                    description: 'Compra en Obsession Draft'
                }
            ]
        };

        const { result } = await ordersController.ordersCreate({ body });

        return res.status(200).json({ id: result.id });
    } catch (error) {
        console.error('Error al crear la orden en PayPal:', error);
        return res.status(500).json({
            error: 'Error interno al procesar la orden con PayPal.',
            details: error.message || error
        });
    }
});

// 2. Ruta para CAPTURAR el pago tras la aprobación del cliente
app.post('/capture-order', async (req, res) => {
    try {
        const { orderID } = req.body;

        if (!orderID) {
            return res.status(400).json({ error: 'Se requiere el orderID para capturar el pago.' });
        }

        const { result } = await ordersController.ordersCapture({ id: orderID });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error al capturar la orden en PayPal:', error);
        return res.status(500).json({
            error: 'Error al procesar el pago con PayPal.',
            details: error.message || error
        });
    }
});

// Escuchar en PORT asignado por Railway y host '0.0.0.0'
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});