import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { CentresModule } from './centres/centres.module';
import { DatabaseModule } from './database/database.module';
import { StudentsModule } from './students/students.module';
import { StaffModule } from './staff/staff.module';
import { SetupModule } from './setup/setup.module';
import { ExamsModule } from './exams/exams.module';
import { CloudflareModule } from './cloudflare/cloudflare.module';
import { EstudyModule } from './estudy/estudy.module';
import { LiveClassModule } from './live-class/live-class.module';
import { StudyMaterialModule } from './study-materials/study-materials.module';
import { FeeModule } from './fee/fee.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SyllabusModule } from './syllabus/syllabus.module';
import { EnquiryModule } from './enquiry/enquiry.module';
import { SmsModule } from './sms/sms.module';
import { FinanceModule } from './finance/finance.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ReportModule } from './report/report.module';
import { PublicAuthModule } from './public-auth/public-auth.module';
import { CoursesModule } from './courses/courses.module';
import { SupportModule } from './support/support.module';
import { NoticesModule } from './notices/notices.module';
import { FormsModule } from './forms/forms.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DoubtsModule } from './doubts/doubts.module';
import { RedisModule } from './redis/redis.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        return {
          throttlers: [
            {
              ttl: 60000,
              limit: 100, // 100 requests per minute by default
            },
          ],
          storage: redisUrl ? new ThrottlerStorageRedisService(redisUrl) : undefined,
        };
      },
    }),
    RedisModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    CentresModule,
    StudentsModule,
    StaffModule,
    SetupModule,
    ExamsModule,
    CloudflareModule,
    EstudyModule,
    LiveClassModule,
    StudyMaterialModule,
    FeeModule,
    AssignmentsModule,
    SyllabusModule,
    EnquiryModule,
    SmsModule,
    FinanceModule,
    AttendanceModule,
    ReportModule,
    PublicAuthModule,
    CoursesModule,
    SupportModule,
    NoticesModule,
    FormsModule,
    NotificationsModule,
    DoubtsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
