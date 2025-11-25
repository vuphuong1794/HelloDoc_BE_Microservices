import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NewsCommentModule } from './use-case/news-comment.module';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

async function bootstrap() {
  dotenv.config();

  // Initialize Firebase Admin
  const isProduction = process.env.NODE_ENV === 'production';
  let serviceAccount;
  
  try {
    if (isProduction) {
       const serviceAccountPath = '/etc/secrets/firebase-service-account.json';
       if (fs.existsSync(serviceAccountPath)) {
         serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
       }
    } else {
       // Local development
       const localPath = '../../../firebase-service-account.json';
       if (fs.existsSync(localPath)) {
         serviceAccount = require(localPath);
       }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized in NewsComment service');
    } else {
      console.warn('Firebase service account not found, skipping Firebase init');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NewsCommentModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3016,
      },
    },
  );
  await app.listen();
  console.log('NewsComment service is listening on port 3016');
}
bootstrap();
