import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DoctorModule } from './use-case/doctor.module';

async function bootstrap() {
  dotenv.config();

  // Check if running in Render environment
  const isProduction = process.env.NODE_ENV === 'production';

  let serviceAccount;
  if (isProduction) {
    // Render environment - read from /etc/secrets
    try {
      const serviceAccountPath = '/etc/secrets/firebase-service-account.json';
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } catch (error) {
      console.error('Error loading Firebase service account from Render secrets:', error);
      process.exit(1);
    }
  } else {
    // Local development - read from project directory
    try {
      const serviceAccountPath = path.join(__dirname, '..', '..', '..', 'firebase-service-account.json');
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } catch (error) {
      console.error('Error loading Firebase service account locally:', error);
      process.exit(1);
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    DoctorModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqps://udjevvyv:fJMVuL7NXdi1cHx42OZAXRRLjYnPX3os@campbell.lmq.cloudamqp.com/udjevvyv'],
        queue: 'doctor_queue',
        queueOptions: {
          durable: true
        },
      },
    },
  );
  await app.listen();
  console.log('Doctor service is listening on port 3003');
}
bootstrap();