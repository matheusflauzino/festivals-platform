import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { IdentityModule } from './identity/identity.module';
import { AdminIdentityModule } from './admin-identity/admin-identity.module';

@Module({
  imports: [PrismaModule, TenantsModule, IdentityModule, AdminIdentityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
