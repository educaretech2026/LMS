import { Injectable, OnModuleInit, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

const ALLOWED_FIELD_TYPES = new Set([
  'text',
  'tel',
  'email',
  'number',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'file',
  'date',
  'image',
]);

const PROTECTED_FORM_FIELDS = new Set(['id', '_id', 'createdAt', 'updatedAt', 'responses', '_count']);

export function validateFormFields(fields: any): void {
  if (!Array.isArray(fields)) {
    throw new BadRequestException('Form fields must be an array.');
  }
  if (fields.length > 50) {
    throw new BadRequestException('A form cannot contain more than 50 fields.');
  }

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      throw new BadRequestException(`Field at index ${i} must be an object.`);
    }

    if (!field.id || typeof field.id !== 'string' || field.id.trim().length === 0) {
      throw new BadRequestException(`Field at index ${i} must have a valid non-empty string id.`);
    }
    if (field.id.length > 100) {
      throw new BadRequestException(`Field id at index ${i} exceeds maximum length of 100 characters.`);
    }

    if (!field.label || typeof field.label !== 'string' || field.label.trim().length === 0) {
      throw new BadRequestException(`Field at index ${i} must have a valid non-empty label.`);
    }
    if (field.label.length > 255) {
      throw new BadRequestException(`Field label at index ${i} exceeds maximum length of 255 characters.`);
    }

    if (!field.type || typeof field.type !== 'string' || !ALLOWED_FIELD_TYPES.has(field.type)) {
      throw new BadRequestException(
        `Field at index ${i} has an invalid type "${field.type}". Allowed types: ${Array.from(ALLOWED_FIELD_TYPES).join(', ')}.`
      );
    }

    if (field.required !== undefined && typeof field.required !== 'boolean') {
      throw new BadRequestException(`Field required property at index ${i} must be a boolean.`);
    }

    if (field.options !== undefined) {
      if (!Array.isArray(field.options)) {
        throw new BadRequestException(`Options for field at index ${i} must be an array.`);
      }
      if (field.options.length > 100) {
        throw new BadRequestException(`Field at index ${i} exceeds maximum allowed options (100).`);
      }
      for (let j = 0; j < field.options.length; j++) {
        if (typeof field.options[j] !== 'string') {
          throw new BadRequestException(`Option at index ${j} in field ${i} must be a string.`);
        }
        if (field.options[j].length > 255) {
          throw new BadRequestException(`Option at index ${j} in field ${i} exceeds maximum length of 255 characters.`);
        }
      }
    }

    if (field.imageUrl !== undefined && field.imageUrl !== null) {
      if (typeof field.imageUrl !== 'string' || field.imageUrl.length > 1000) {
        throw new BadRequestException(`Invalid imageUrl for field at index ${i}.`);
      }
    }
  }
}

@Injectable()
export class FormsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private storageService: StorageService
  ) {}

  async onModuleInit() {
    await this.ensureImageUrlColumn();
  }

  private async ensureImageUrlColumn(): Promise<void> {
    try {
      if (this.prisma?.$executeRawUnsafe) {
        await this.prisma.$executeRawUnsafe(`
          DO $$
          BEGIN
              IF NOT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_schema = CURRENT_SCHEMA
                  AND table_name = 'custom_forms'
                  AND column_name = 'imageUrl'
              ) THEN
                  ALTER TABLE "custom_forms" ADD COLUMN "imageUrl" TEXT;
              END IF;
          END $$;
        `);
      }
    } catch (err) {
      console.warn('[FormsService] Note on ensureImageUrlColumn:', (err as any)?.message || err);
    }
  }

  async createForm(data: { title: string; description?: string; imageUrl?: string; isActive?: boolean; fields: any; centreId?: string }, user?: any): Promise<any> {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new BadRequestException('Form title is required and must be a non-empty string.');
    }
    if (data.title.length > 255) {
      throw new BadRequestException('Form title cannot exceed 255 characters.');
    }

    if (data.description !== undefined && data.description !== null) {
      if (typeof data.description !== 'string') {
        throw new BadRequestException('Form description must be a string.');
      }
      if (data.description.length > 2000) {
        throw new BadRequestException('Form description cannot exceed 2000 characters.');
      }
    }

    if (data.imageUrl !== undefined && data.imageUrl !== null) {
      if (typeof data.imageUrl !== 'string') {
        throw new BadRequestException('Form imageUrl must be a string.');
      }
      if (data.imageUrl.length > 1000) {
        throw new BadRequestException('Form imageUrl cannot exceed 1000 characters.');
      }
    }

    if (data.isActive !== undefined && data.isActive !== null) {
      if (typeof data.isActive !== 'boolean') {
        throw new BadRequestException('isActive must be a boolean (true or false).');
      }
    }

    validateFormFields(data.fields);

    let centreId = data.centreId;
    if (user && !isSuperAdmin(user)) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      if (centreId) {
        assertCentreAccess(user, centreId);
      } else if (authorizedCentres.length > 0) {
        centreId = authorizedCentres[0];
      } else {
        throw new ForbiddenException('A centre assignment is required to create a form.');
      }
    }

    const payload = {
      title: data.title.trim(),
      description: data.description ? data.description.trim() : null,
      imageUrl: data.imageUrl ? data.imageUrl.trim() : null,
      isActive: data.isActive ?? true,
      fields: data.fields,
      centreId: centreId || null,
    };

    try {
      return await this.prisma.customForm.create({
        data: payload,
      });
    } catch (err: any) {
      if (err?.message?.includes('imageUrl') || err?.code === 'P2021' || err?.code === 'P2022') {
        await this.ensureImageUrlColumn();
        return await this.prisma.customForm.create({
          data: payload,
        });
      }
      throw err;
    }
  }

  async getForms(user?: any): Promise<any> {
    const where: any = {};
    if (user && !isSuperAdmin(user)) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      where.centreId = { in: authorizedCentres };
    }

    try {
      return await this.prisma.customForm.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { responses: true },
          },
        },
      });
    } catch (err: any) {
      if (err?.message?.includes('imageUrl') || err?.code === 'P2021' || err?.code === 'P2022') {
        await this.ensureImageUrlColumn();
        return await this.prisma.customForm.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { responses: true },
            },
          },
        });
      }
      throw err;
    }
  }

  async getFormById(id: string): Promise<any> {
    try {
      const form = await this.prisma.customForm.findUnique({
        where: { id },
      });
      if (!form) throw new NotFoundException('Form not found');
      return form;
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      if (err?.message?.includes('imageUrl') || err?.code === 'P2021' || err?.code === 'P2022') {
        await this.ensureImageUrlColumn();
        const form = await this.prisma.customForm.findUnique({
          where: { id },
        });
        if (!form) throw new NotFoundException('Form not found');
        return form;
      }
      throw err;
    }
  }

  async updateForm(id: string, data: { title?: string; description?: string; imageUrl?: string; isActive?: boolean; fields?: any; centreId?: string }, user?: any): Promise<any> {
    const existing = await this.prisma.customForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form not found');

    if (user && !isSuperAdmin(user)) {
      if (!existing.centreId) {
        throw new ForbiddenException('Only super administrators can modify global forms.');
      }
      assertCentreAccess(user, existing.centreId);

      if (data.centreId !== undefined) {
        if (!data.centreId) {
          throw new ForbiddenException('Cannot convert a centre form to a global form.');
        }
        assertCentreAccess(user, data.centreId);
      }
    }

    if (data.title !== undefined) {
      if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new BadRequestException('Form title must be a non-empty string.');
      }
      if (data.title.length > 255) {
        throw new BadRequestException('Form title cannot exceed 255 characters.');
      }
    }

    if (data.description !== undefined && data.description !== null) {
      if (typeof data.description !== 'string') {
        throw new BadRequestException('Form description must be a string.');
      }
      if (data.description.length > 2000) {
        throw new BadRequestException('Form description cannot exceed 2000 characters.');
      }
    }

    if (data.imageUrl !== undefined && data.imageUrl !== null) {
      if (typeof data.imageUrl !== 'string') {
        throw new BadRequestException('Form imageUrl must be a string.');
      }
      if (data.imageUrl.length > 1000) {
        throw new BadRequestException('Form imageUrl cannot exceed 1000 characters.');
      }
    }

    if (data.isActive !== undefined && data.isActive !== null) {
      if (typeof data.isActive !== 'boolean') {
        throw new BadRequestException('isActive must be a boolean (true or false).');
      }
    }

    if (data.fields !== undefined) {
      validateFormFields(data.fields);
    }

    const updatePayload: any = {};
    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.description !== undefined) updatePayload.description = data.description ? data.description.trim() : null;
    if (data.imageUrl !== undefined) updatePayload.imageUrl = data.imageUrl ? data.imageUrl.trim() : null;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.fields !== undefined) updatePayload.fields = data.fields;
    if (data.centreId !== undefined) updatePayload.centreId = data.centreId || null;

    try {
      return await this.prisma.customForm.update({
        where: { id },
        data: updatePayload,
      });
    } catch (err: any) {
      if (err?.message?.includes('imageUrl') || err?.code === 'P2021' || err?.code === 'P2022') {
        await this.ensureImageUrlColumn();
        return await this.prisma.customForm.update({
          where: { id },
          data: updatePayload,
        });
      }
      throw err;
    }
  }

  async deleteForm(id: string, user?: any): Promise<any> {
    const existing = await this.prisma.customForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form not found');

    if (user && !isSuperAdmin(user)) {
      if (!existing.centreId) {
        throw new ForbiddenException('Only super administrators can delete global forms.');
      }
      assertCentreAccess(user, existing.centreId);
    }

    return this.prisma.customForm.delete({
      where: { id },
    });
  }

  async submitResponse(formId: string, data: any): Promise<any> {
    // Validate form exists and is active
    const form = await this.prisma.customForm.findUnique({ where: { id: formId } });
    if (!form || !form.isActive) {
      throw new BadRequestException('Form is not active or does not exist');
    }

    // Validate uploaded file attachments in submitted form response data
    if (data && typeof data === 'object') {
      if (!this.storageService) {
        throw new BadRequestException('Storage service is not available to validate uploaded form attachments.');
      }
      const customFormLimit = (form as any).maxFileSizeBytes;
      const expectedPrefix = `forms/${formId}/`;

      const traverseAndCheck = async (obj: any) => {
        for (const [key, val] of Object.entries(obj)) {
          if (typeof val === 'string') {
            const trimmed = val.trim();
            const validatedKey = this.storageService.extractAndValidateObjectKey(trimmed);

            if (validatedKey || trimmed.includes('forms/') || trimmed.includes('/forms/')) {
              // Ensure it is a valid managed storage key
              if (!validatedKey) {
                throw new BadRequestException(`Invalid storage reference for field "${key}".`);
              }

              // Validate key belongs strictly to this form ID and namespace
              if (!validatedKey.startsWith(expectedPrefix)) {
                throw new BadRequestException(
                  `Cross-form upload rejected: File does not belong to form "${formId}".`
                );
              }

              // Check if object is already claimed by another record.
              // If claimed, do not allow reuse across form submissions or deletion via purge!
              const isClaimed = await this.storageService.isStorageUrlInUse(validatedKey);
              if (isClaimed) {
                throw new BadRequestException(
                  `File "${key}" has already been claimed or referenced by another record.`
                );
              }

              // Validate size and purge oversized file only after proving it is an unclaimed upload belonging to this form
              await this.storageService.validateAndEnforceObjectSize(validatedKey, customFormLimit);
            }
          } else if (val && typeof val === 'object') {
            await traverseAndCheck(val);
          }
        }
      };

      await traverseAndCheck(data);
    }

    const response = await this.prisma.customFormResponse.create({
      data: {
        formId,
        data,
      },
    });

    // Notify Admins
    try {
      const admins = await this.prisma.user.findMany({ where: { role: { name: 'SUPER_ADMIN' } } });
      for (const admin of admins) {
        await this.notificationsService.sendNotification({
          userId: admin.id,
          title: 'New Form Response',
          message: `A new response was submitted for "${form.title}"`,
          type: 'INFO',
          link: `/forms/${form.id}/responses`,
        });
      }
    } catch (e) {}

    return response;
  }

  async getFormResponses(formId: string, user?: any): Promise<any> {
    const form = await this.prisma.customForm.findUnique({ where: { id: formId } });
    if (!form) throw new NotFoundException('Form not found');

    if (user && !isSuperAdmin(user)) {
      if (!form.centreId) {
        throw new ForbiddenException('Only super administrators can view responses to global forms.');
      }
      assertCentreAccess(user, form.centreId);
    }

    return this.prisma.customFormResponse.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
