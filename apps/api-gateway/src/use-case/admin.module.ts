import { Injectable, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { Admin } from "typeorm";
import { AdminController } from "../controller/admin.controller";
import { AdminService } from "../services/admin.service";


@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'ADMIN_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: 'localhost',
                    port: 3010
                }
            }
        ])
    ],
    controllers: [AdminController],
    providers: [AdminService],
})

export class AdminModule { }