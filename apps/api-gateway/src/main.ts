import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './use-case/api-gateway.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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
      serviceAccount = require('../../../firebase-service-account.json');
    } catch (error) {
      console.error('Error loading Firebase service account locally:', error);
      process.exit(1);
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const app = await NestFactory.create(ApiGatewayModule);

  //Thêm CORS vào để FE access BE
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));

  const port = process.env.port || 4000;
  await app.listen(port);
  console.log(`API Gateway is running on http://localhost:${port}`);
}
bootstrap();