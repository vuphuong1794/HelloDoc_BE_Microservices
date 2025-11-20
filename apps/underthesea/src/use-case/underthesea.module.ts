import { Module } from '@nestjs/common';
import { UndertheseaService } from '../service/underthesea.service';
import { UndertheseaController } from '../controller/underthesea.controller';

@Module({
  providers: [UndertheseaService],
  controllers: [UndertheseaController],
  exports: [UndertheseaService],
})
export class UndertheseaModule { }