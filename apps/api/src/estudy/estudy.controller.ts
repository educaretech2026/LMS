import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { EstudyService } from './estudy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('estudy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('ESTUDY')
export class EstudyController {
  constructor(private readonly estudyService: EstudyService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getMaterials() {
    return this.estudyService.getMaterials();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  createMaterial(@Body() data: any) {
    return this.estudyService.createMaterial(data);
  }
}
