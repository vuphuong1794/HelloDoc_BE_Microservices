import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ReviewController } from '../controller/review.controller';
import { ReviewService } from '../services/review.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'REVIEW_CLIENT',
                transport: Transport.TCP,
                options: {
                    port: 3018,
                },
            },
        ]),
    ],
    controllers: [ReviewController],
    providers: [ReviewService],
})
export class ReviewModule {}
