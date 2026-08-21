require('dotenv').config();
const express = require('express');
const paypal = require('@paypal/checkout-server-sdk');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let environment = new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
let client = new paypal.core.PayPalHttpClient(environment);

// Catálogo seguro en el servidor (evita que manipulen precios desde el navegador)
const PRODUCTS = {
    'single': '29.99',
    'couple': '49.99'
};

app.post('/create-order', async (req, res) => {
    const { productId } = req.body;
    const itemPrice = PRODUCTS[productId];

    if (!itemPrice) {
        return res.status(400).json({ error: 'Producto no válido' });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: itemPrice
            }
        }]
    });

    try {
        const order = await client.execute(request);
        res.json({ id: order.result.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));