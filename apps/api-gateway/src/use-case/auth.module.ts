import { Injectable, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { AuthController } from "../controller/auth.controller";
import { AuthService } from "apps/auth/src/service/auth.service";

@Module({

    imports: [
        ClientsModule.register([
            {
                name: 'AUTH_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3005
                }
            }
        ])
    ],
    controllers: [AuthController],
    providers: [AuthService],
})

export class AuthModule { }