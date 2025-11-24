import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { PostFavoriteModule } from './use-case/post-favorite.module';
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
       // Local development - try to find it in project root
       // Assuming running from apps/post-favorite or root, need to find the file
       // The path in api-gateway was '../../../firebase-service-account.json' relative to src/main.ts
       // Here it is also src/main.ts, so same relative path should work if running from root
       const localPath = '../../../firebase-service-account.json';
       if (fs.existsSync(localPath)) {
         serviceAccount = require(localPath);
       }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized in PostFavorite service');
    } else {
      console.warn('Firebase service account not found, skipping Firebase init');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PostFavoriteModule,
    {
      transport: Transport.TCP,
      options: {
        port: 3014,
      },
    },
  );
  await app.listen();
  console.log('PostFavorite service is listening on port 3014');
}
bootstrap();
