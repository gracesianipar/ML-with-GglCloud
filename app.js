const Hapi = require('@hapi/hapi');
const tf = require('@tensorflow/tfjs-node');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const sharp = require('sharp');
const path = require('path');
const admin = require('firebase-admin');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

const loadSecret = async() => {
    const [version] = await client.accessSecretVersion({
        name: 'projects/574569072549/secrets/firebase-credentials',
    });
    const payload = version.payload.data.toString('utf8');
    return JSON.parse(payload);
};

const loadModel = async() => {
    try {
        const modelPath = path.join(__dirname, 'models', 'model.json');
        model = await tf.loadGraphModel(`file://${modelPath}`);
        console.log('Model loaded successfully');
    } catch (error) {
        console.error('Error loading model:', error.message);
        process.exit(1); // Exit process if model fails to load
    }
};

const start = async() => {
    try {
        // Load service account credentials before initializing Firebase
        const serviceAccount = await loadSecret();

        // Initialize Firebase
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } else {
            admin.app();
        }

        const db = admin.firestore();

        // Load model before starting the server
        await loadModel();

        const server = Hapi.server({
            port: process.env.PORT || 8080, // Use dynamic port from environment variable
            host: '0.0.0.0',
            routes: {
                cors: {
                    origin: ['*'],
                },
            },
        });

        server.route({
            method: 'POST',
            path: '/predict',
            options: {
                payload: {
                    maxBytes: 1000000, // 1MB limit for the uploaded file
                    parse: true,
                    multipart: true,
                    output: 'stream',
                },
            },
            handler: async(request, h) => {
                const { image } = request.payload;

                if (!image) {
                    return h.response({
                        status: 'fail',
                        message: 'No image file uploaded',
                    }).code(400);
                }

                try {
                    const mimeType = image.hapi.headers['content-type'];
                    if (!mimeType.startsWith('image/')) {
                        return h.response({
                            status: 'fail',
                            message: 'Invalid image file uploaded',
                        }).code(400);
                    }

                    const imageBuffer = await sharp(image._data)
                        .resize(224, 224)
                        .toBuffer();

                    const result = await predictImage(imageBuffer);
                    const predictionId = uuidv4();

                    const response = {
                        id: predictionId,
                        result,
                        suggestion: result === 'Cancer' ? 'Segera periksa ke dokter!' : 'Penyakit kanker tidak terdeteksi.',
                        createdAt: moment().toISOString(),
                    };

                    await db.collection('predictions').doc(predictionId).set(response);

                    return h.response({
                        status: 'success',
                        data: response,
                    }).code(200);
                } catch (error) {
                    console.error('Prediction error:', error.message);
                    return h.response({
                        status: 'fail',
                        message: 'Terjadi kesalahan dalam melakukan prediksi',
                    }).code(500);
                }
            },
        });

        server.route({
            method: 'GET',
            path: '/predict/histories',
            handler: async(request, h) => {
                try {
                    const snapshot = await db.collection('predictions').get();

                    if (snapshot.empty) {
                        return h.response({
                            status: 'success',
                            data: [],
                        }).code(200);
                    }

                    const histories = snapshot.docs.map((doc) => {
                        const data = doc.data();
                        if (data.createdAt && data.createdAt._seconds) {
                            data.createdAt = new Date(data.createdAt._seconds * 1000).toISOString();
                        }
                        return {
                            id: doc.id,
                            history: data,
                        };
                    });

                    return h.response({
                        status: 'success',
                        data: histories,
                    }).code(200);
                } catch (error) {
                    console.error('Error fetching histories:', error.message);
                    return h.response({
                        status: 'fail',
                        message: 'Terjadi kesalahan dalam mengambil riwayat prediksi',
                    }).code(500);
                }
            },
        });

        await server.start();
        console.log('Server running on', server.info.uri);
    } catch (err) {
        console.error('Server error:', err.message);
        process.exit(1);
    }
};

start();
