import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { IdentityModule } from './identity/identity.module';
import { AdminIdentityModule } from './admin-identity/admin-identity.module';
import { FestivalsModule } from './festivals/festivals.module';
import { RegistrationsModule } from './registrations/registrations.module';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    IdentityModule,
    AdminIdentityModule,
    FestivalsModule,
    RegistrationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
