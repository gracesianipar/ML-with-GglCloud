const Hapi = require('@hapi/hapi');
const tf = require('@tensorflow/tfjs-node');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const sharp = require('sharp');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./config/submissionmlgc-gracesianipar-ab75553a34a5.json');

// Initialize Firebase only once
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
} else {
    admin.app();
}

const db = admin.firestore();

let model;
const loadModel = async() => {
    try {
        const modelPath = path.join(__dirname, 'models', 'model.json');
        model = await tf.loadGraphModel(`file://${modelPath}`);
        console.log('Model loaded successfully');
    } catch (error) {
        console.error('Error loading model:', error);
    }
};

loadModel();

const predictImage = async(imageBuffer) => {
    try {
        const tensor = tf.node.decodeImage(imageBuffer, 3);
        const resizedTensor = tf.image.resizeBilinear(tensor, [224, 224]);
        const input = resizedTensor.expandDims(0).toFloat().div(tf.scalar(255));

        const predictions = await model.predict(input);
        const result = predictions.dataSync()[0] > 0.5 ? 'Cancer' : 'Non-cancer';
        return result;
    } catch (error) {
        console.error('Error during prediction:', error);
        return 'Error during prediction';
    }
};

const server = Hapi.server({
    port: 8080,
    host: '0.0.0.0',
    routes: {
        cors: {
            origin: ['*'],
        },
    },
});

const start = async() => {
    try {
        server.route({
            method: 'POST',
            path: '/predict',
            options: {
                payload: {
                    maxBytes: 1000000, // 1MB limit for the uploaded file
                    parse: true,
                    multipart: true,
                    output: 'stream', // This allows us to directly stream the uploaded file
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

                // Log headers for debugging
                console.log('Image headers:', image.hapi.headers);

                // Check the image type and log it for debugging purposes
                const mimeType = image.hapi ? image.hapi.headers['content-type'] : 'unknown';
                console.log('Received image MIME type:', mimeType);

                if (!mimeType.startsWith('image/')) {
                    return h.response({
                        status: 'fail',
                        message: 'Invalid image file uploaded',
                    }).code(400);
                }

                try {
                    // Resize and process image with sharp
                    const imageBuffer = await sharp(image._data)
                        .resize(224, 224)
                        .toBuffer()
                        .catch(err => {
                            console.error('Error processing image with sharp:', err);
                            throw new Error('Invalid image data');
                        });

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
                    console.error('Prediction error:', error);
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

                    const histories = snapshot.docs.map((doc) => (doc.data()));

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
        console.log(err);
        process.exit(1);
    }
};

start();