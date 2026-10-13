import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  getAll(@Req() req: any): Promise<any> {
    return this.assignmentsService.getAll(req.user.id, req.user.role);
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<any> {
    return this.assignmentsService.getOne(id);
  }

  @Post()
  create(@Body() data: any, @Req() req: any): Promise<any> {
    return this.assignmentsService.create(data, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any, @Req() req: any): Promise<any> {
    return this.assignmentsService.update(id, data, req.user.id, req.user.role);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.assignmentsService.delete(id, req.user.id, req.user.role);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() data: any, @Req() req: any): Promise<any> {
    return this.assignmentsService.submit(id, req.user.id, data);
  }

  @Patch('submissions/:id/grade')
  gradeSubmission(@Param('id') id: string, @Body() data: any): Promise<any> {
    return this.assignmentsService.gradeSubmission(id, data);
  }
}
