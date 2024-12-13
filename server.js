import puppeteer from 'puppeteer';
import express from 'express';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 5000;  // Usar el puerto dinámico proporcionado por Render

// URL base de SysAid
const sysaidBaseUrl = 'https://bionordiccsc.sysaidit.com';
const sysaidSRUrl = `${sysaidBaseUrl}/api/v1/sr`; // Endpoint para los SR

// Lista de campos requeridos
const requiredFields = [
    "Request time",
    "Company",
    "Admin group",
    "Category",
    "Survey Status",
    "Service Record Type",
    "Status",
    "Close time",
    "Due Date",
    "Time to Repair",
    "Time Waiting on End User",
    "Time waiting on Vendor",
    "Assigned to",
    "Priority"
];

// Función para obtener las cookies después del inicio de sesión
const getSysAidCookies = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser', 
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.goto('https://bionordiccsc.sysaidit.com/Login.jsp?manual=true');

    // Completa el formulario de inicio de sesión
    await page.type('input[name="userName"]', 'prueba');
    await page.type('input[name="password"]', 'Prueba123*');
    await page.click('#loginBtn');

    await page.waitForNavigation();

    // Obtiene las cookies
    const cookies = await page.cookies();

    await browser.close();

    const cookieObject = {};
    cookies.forEach(cookie => {
        cookieObject[cookie.name] = cookie.value;
    });

    return cookieObject;
};

// Función para obtener todos los tickets usando paginación
const getAllTickets = async (cookieHeader) => {
    let tickets = [];
    let offset = 0; // Inicio de los registros
    const limit = 500; // Máximo por solicitud
    let hasMoreData = true;

    while (hasMoreData) {
        const response = await axios.get(`${sysaidSRUrl}?limit=${limit}&offset=${offset}`, {
            headers: {
                'Cookie': cookieHeader,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (response.data && response.data.length > 0) {
            tickets = tickets.concat(response.data); // Agrega los tickets obtenidos
            offset += limit; // Avanza al siguiente lote
        } else {
            hasMoreData = false; // Detiene la iteración cuando no hay más datos
        }
    }

    return tickets;
};

// Función para extraer campos específicos de los tickets
const extractFields = (data) => {
    return data.map(record => {
        const extracted = {};
        if (record.info && Array.isArray(record.info)) {
            record.info.forEach(field => {
                if (requiredFields.includes(field.keyCaption)) {
                    extracted[field.keyCaption] = field.valueCaption || null; // Usa valueCaption como valor
                }
            });
        }
        return extracted;
    });
};

// Ruta raíz para comprobar que el servidor funciona
app.get('/', (req, res) => {
  res.send('¡Servidor funcionando!');
});

// Endpoint para obtener los SR
app.get('/api/sysaid/sr', async (req, res) => {
    try {
        const cookies = await getSysAidCookies();
        const cookieHeader = Object.entries(cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');

        // Obtiene todos los tickets con paginación
        const allTickets = await getAllTickets(cookieHeader);

        // Extrae los campos requeridos
        const extractedData = extractFields(allTickets);

        res.json(extractedData);
    } catch (error) {
        console.error('Error al obtener los SR:', error.message);
        res.status(500).json({ error: 'Error al obtener los registros de servicio de SysAid' });
    }
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
